import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { pool, withTx, type Tx } from './db/index.js';
import { move } from './wallet.js';
import { requireUser } from './auth.js';
import * as pz from './games/pizote.js';

const GAME = 'pizote';
export const CHALLENGE = { winBoth: 5_000, consolation: 2_000, hours: 24, minMultiplier: 2 };

function httpError(code: number, msg: string) {
  const e = new Error(msg) as Error & { statusCode: number };
  e.statusCode = code;
  return e;
}

function publicRound(r: any) {
  const done = r.status !== 'playing';
  return {
    id: r.id,
    bet: Number(r.bet),
    pos: r.pos,
    status: r.status,
    multiplier: r.pos > 0 ? pz.multiplier(r.pos) : 1,
    payout: Number(r.payout),
    hash: undefined as string | undefined,
    seed: done ? r.server_seed : undefined,
    crashLane: done ? r.crash_lane : undefined,
  };
}

/** Revisa los retos aceptados por este jugador cuando termina una ronda. */
async function settleChallenges(tx: Tx, userId: number, roundMult: number, cashed: boolean) {
  const open = await tx.query(
    `SELECT e.code, c.owner_id, c.target, e.attempted FROM challenge_entries e JOIN challenges c ON c.code = e.code
     WHERE e.user_id = $1 AND e.won = false AND c.expires_at > now() FOR UPDATE OF e`,
    [userId],
  );
  const results: { code: string; won: boolean; coins: number }[] = [];
  for (const ch of open.rows) {
    if (cashed && roundMult > Number(ch.target)) {
      await tx.query('UPDATE challenge_entries SET won = true, attempted = true WHERE code = $1 AND user_id = $2', [ch.code, userId]);
      await move(tx, userId, CHALLENGE.winBoth, 'challenge', { game: GAME, ref: ch.code });
      await move(tx, ch.owner_id, CHALLENGE.winBoth, 'challenge', { game: GAME, ref: ch.code });
      results.push({ code: ch.code, won: true, coins: CHALLENGE.winBoth });
    } else if (!ch.attempted) {
      await tx.query('UPDATE challenge_entries SET attempted = true WHERE code = $1 AND user_id = $2', [ch.code, userId]);
      await move(tx, userId, CHALLENGE.consolation, 'challenge', { game: GAME, ref: ch.code });
      results.push({ code: ch.code, won: false, coins: CHALLENGE.consolation });
    }
  }
  return results;
}

async function finish(tx: Tx, r: any, status: 'cashed' | 'crashed', pos: number) {
  const mult = status === 'cashed' ? pz.multiplier(pos) : 0;
  const payout = status === 'cashed' ? Math.floor(Number(r.bet) * mult) : 0;
  await tx.query(
    `UPDATE pizote_rounds SET status = $2, pos = $3, multiplier = $4, payout = $5, ended_at = now() WHERE id = $1`,
    [r.id, status, pos, status === 'cashed' ? mult : null, payout],
  );
  let balance: number | undefined;
  if (payout > 0) balance = await move(tx, r.user_id, payout, 'win', { game: GAME, ref: r.id });
  const challenges = await settleChallenges(tx, r.user_id, mult, status === 'cashed');
  if (challenges.length) {
    const b = await tx.query('SELECT balance FROM users WHERE id = $1', [r.user_id]);
    balance = b.rows[0].balance;
  }
  return { ...publicRound({ ...r, status, pos, payout }), multiplier: status === 'cashed' ? mult : pz.multiplier(pos - 1), balance, challenges };
}

export function pizoteRoutes(app: FastifyInstance) {
  // Ver un reto no exige sesión: es la página que llega por WhatsApp
  app.get('/api/retos/:code', async (req, reply) => {
    const { code } = z.object({ code: z.string().max(20) }).parse(req.params);
    const r = await pool.query(
      `SELECT c.code, c.target, c.expires_at, u.display_name FROM challenges c JOIN users u ON u.id = c.owner_id WHERE c.code = $1`,
      [code.toUpperCase()],
    );
    if (!r.rowCount) return reply.code(404).send({ error: 'Ese reto no existe.' });
    const c = r.rows[0];
    return { code: c.code, target: Number(c.target), owner: c.display_name, expiresAt: c.expires_at, expired: new Date(c.expires_at) < new Date(), ...CHALLENGE };
  });

  app.register(async (r) => {
    r.addHook('preHandler', requireUser);

    r.get('/api/pizote/meta', async () => ({
      lanes: pz.LANES, laneNames: pz.LANE_NAMES, multipliers: pz.MULTIPLIERS,
      chance: pz.P, rtp: pz.EDGE * 100, minBet: pz.MIN_BET, maxBet: pz.MAX_BET,
    }));

    r.post('/api/pizote/start', async (req) => {
      const { bet } = z.object({ bet: z.number().int().min(pz.MIN_BET).max(pz.MAX_BET) }).parse(req.body);
      const uid = req.userId!;
      return withTx(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [uid]);
        // una ronda abandonada se cierra como perdida
        await tx.query(`UPDATE pizote_rounds SET status = 'crashed', ended_at = now() WHERE user_id = $1 AND status = 'playing'`, [uid]);
        const round = pz.newRound();
        const id = randomBytes(10).toString('hex');
        const balance = await move(tx, uid, -bet, 'bet', { game: GAME, ref: id });
        await tx.query(
          'INSERT INTO pizote_rounds (id, user_id, bet, crash_lane, server_seed) VALUES ($1,$2,$3,$4,$5)',
          [id, uid, bet, round.crashLane, round.seed],
        );
        return { id, hash: round.hash, bet, pos: 0, status: 'playing', multiplier: 1, balance };
      });
    });

    r.post('/api/pizote/step', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.body);
      return withTx(async (tx) => {
        const q = await tx.query('SELECT * FROM pizote_rounds WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, req.userId]);
        if (!q.rowCount) throw httpError(404, 'Ronda no existe.');
        const round = q.rows[0];
        if (round.status !== 'playing') throw httpError(409, 'La ronda ya terminó.');
        const next = round.pos + 1;
        if (next === round.crash_lane) return finish(tx, round, 'crashed', next);
        if (next === pz.LANES) return finish(tx, round, 'cashed', next);
        await tx.query('UPDATE pizote_rounds SET pos = $2 WHERE id = $1', [id, next]);
        return { ...publicRound({ ...round, pos: next }), multiplier: pz.multiplier(next) };
      });
    });

    r.post('/api/pizote/cashout', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.body);
      return withTx(async (tx) => {
        const q = await tx.query('SELECT * FROM pizote_rounds WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, req.userId]);
        if (!q.rowCount) throw httpError(404, 'Ronda no existe.');
        const round = q.rows[0];
        if (round.status !== 'playing') throw httpError(409, 'La ronda ya terminó.');
        if (round.pos === 0) throw httpError(400, 'Primero cruza al menos un carril.');
        return finish(tx, round, 'cashed', round.pos);
      });
    });

    // Crear un reto a partir de una jugada ganada
    r.post('/api/pizote/reto', async (req) => {
      const { roundId } = z.object({ roundId: z.string() }).parse(req.body);
      const q = await pool.query(`SELECT * FROM pizote_rounds WHERE id = $1 AND user_id = $2 AND status = 'cashed'`, [roundId, req.userId]);
      if (!q.rowCount) throw httpError(404, 'Solo puedes retar con una jugada ganada.');
      const round = q.rows[0];
      if (Number(round.multiplier) < CHALLENGE.minMultiplier) throw httpError(400, `Llega al menos a x${CHALLENGE.minMultiplier} para retar.`);
      const existing = await pool.query('SELECT code FROM challenges WHERE round_id = $1', [roundId]);
      const code = existing.rows[0]?.code ?? randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
      if (!existing.rowCount) {
        await pool.query(
          `INSERT INTO challenges (code, owner_id, round_id, target, expires_at) VALUES ($1,$2,$3,$4, now() + interval '${CHALLENGE.hours} hours')`,
          [code, req.userId, roundId, round.multiplier],
        );
      }
      return { code, target: Number(round.multiplier) };
    });

    r.post('/api/retos/:code/aceptar', async (req) => {
      const { code } = z.object({ code: z.string().max(20) }).parse(req.params);
      const c = await pool.query('SELECT owner_id, expires_at FROM challenges WHERE code = $1', [code.toUpperCase()]);
      if (!c.rowCount) throw httpError(404, 'Ese reto no existe.');
      if (c.rows[0].owner_id === req.userId) throw httpError(400, 'No puedes aceptar tu propio reto. ¡Compártelo!');
      if (new Date(c.rows[0].expires_at) < new Date()) throw httpError(410, 'Este reto ya venció.');
      await pool.query('INSERT INTO challenge_entries (code, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [code.toUpperCase(), req.userId]);
      return { ok: true };
    });

    r.get('/api/pizote/ranking', async (req) => {
      const top = await pool.query(
        `SELECT u.id, u.display_name, max(p.multiplier)::float AS best FROM pizote_rounds p JOIN users u ON u.id = p.user_id
         WHERE p.status = 'cashed' AND p.ended_at >= date_trunc('week', now()) GROUP BY u.id ORDER BY best DESC LIMIT 10`,
      );
      return { top: top.rows.map((x, i) => ({ rank: i + 1, name: x.display_name, best: x.best, me: x.id === req.userId })) };
    });
  });
}
