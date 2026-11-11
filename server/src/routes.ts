import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { pool, withTx, type Tx } from './db/index.js';
import { move, InsufficientFunds } from './wallet.js';
import { requireUser } from './auth.js';
import { AD_REWARD, DAILY_WHEEL, GIFT, PACKS, PAYMENTS_MODE } from './config.js';
import { weighted } from './games/rng.js';
import * as slot from './games/slot.js';
import * as crash from './games/crash.js';

const SLOT_GAME = 'tesoro-maya';
const CRASH_GAME = 'cohete';
const MISSION = { id: 'two-games', title: 'Juega Tesoro Maya y Cohete hoy', coins: 3_000 };

const adTokens = new Map<string, { userId: number; at: number }>();

async function lastAt(userId: number, reason: string): Promise<Date | null> {
  const r = await pool.query('SELECT max(created_at) AS t FROM ledger WHERE user_id = $1 AND reason = $2', [userId, reason]);
  return r.rows[0].t;
}

async function countToday(userId: number, reason: string): Promise<number> {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM ledger WHERE user_id = $1 AND reason = $2 AND created_at >= date_trunc('day', now())`,
    [userId, reason],
  );
  return r.rows[0].n;
}

async function missionState(userId: number) {
  const r = await pool.query(
    `SELECT count(DISTINCT game)::int AS n FROM ledger
     WHERE user_id = $1 AND reason = 'bet' AND game IN ($2,$3) AND created_at >= date_trunc('day', now())`,
    [userId, SLOT_GAME, CRASH_GAME],
  );
  const claimed = (await countToday(userId, 'mission')) > 0;
  return { ...MISSION, progress: r.rows[0].n as number, goal: 2, claimed };
}

function availableAt(last: Date | null, hours: number): string | null {
  if (!last) return null;
  const t = new Date(last.getTime() + hours * 3600_000);
  return t > new Date() ? t.toISOString() : null;
}

/** Liquida una ronda de Cohete si ya terminó (por explosión o retiro automático). */
async function settleCrash(tx: Tx, round: any, now: number, manual: boolean) {
  const elapsed = now - new Date(round.started_at).getTime();
  const cp = Number(round.crash_point);
  const auto = round.auto_cashout ? Number(round.auto_cashout) : null;
  const current = crash.multiplierAt(elapsed);
  let status: 'flying' | 'cashed' | 'crashed' = 'flying';
  let at: number | null = null;
  if (auto !== null && auto <= cp && current >= auto) {
    status = 'cashed';
    at = auto;
  } else if (current >= cp) {
    status = 'crashed';
  } else if (manual) {
    status = 'cashed';
    at = current;
  }
  if (status === 'flying') return { status, multiplier: current };
  const payout = status === 'cashed' ? Math.floor(Number(round.bet) * at!) : 0;
  const upd = await tx.query(
    `UPDATE crash_rounds SET status = $2, cashout_at = $3, payout = $4 WHERE id = $1 AND status = 'flying' RETURNING id`,
    [round.id, status, at, payout],
  );
  let balance: number | undefined;
  if (upd.rowCount && payout > 0) balance = await move(tx, round.user_id, payout, 'win', { game: CRASH_GAME, ref: round.id });
  return { status, cashoutAt: at, payout, crashPoint: cp, seed: round.server_seed, balance };
}

export function gameRoutes(app: FastifyInstance) {
  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof InsufficientFunds) return reply.code(402).send({ error: 'No tienes suficientes monedas.' });
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'Datos inválidos.', details: err.issues });
    const code = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (code === 500) app.log.error(err);
    return reply.code(code).send({ error: code === 500 ? 'Algo salió mal. Intenta de nuevo.' : err.message });
  });

  app.register(async (r) => {
    r.addHook('preHandler', requireUser);

    r.get('/api/me', async (req) => {
      const uid = req.userId!;
      const u = await pool.query('SELECT id, display_name, email, balance, daily_spend_limit_cents FROM users WHERE id = $1', [uid]);
      const fs = await pool.query('SELECT free_spins, free_bet FROM slot_state WHERE user_id = $1 AND game = $2', [uid, SLOT_GAME]);
      const welcomeBought = await pool.query(`SELECT 1 FROM purchases WHERE user_id = $1 AND pack_id = 'welcome' AND status = 'paid'`, [uid]);
      return {
        user: u.rows[0],
        wheelAvailableAt: availableAt(await lastAt(uid, 'daily_wheel'), DAILY_WHEEL.cooldownHours),
        giftAvailableAt: availableAt(await lastAt(uid, 'gift'), GIFT.everyHours),
        adsLeft: Math.max(0, AD_REWARD.perDay - (await countToday(uid, 'ad_reward'))),
        freeSpins: fs.rows[0]?.free_spins ?? 0,
        freeSpinBet: fs.rows[0]?.free_bet ?? 0,
        mission: await missionState(uid),
        welcomeOfferAvailable: !welcomeBought.rowCount,
      };
    });

    r.put('/api/me/limit', async (req) => {
      const { dailyLimitCents } = z.object({ dailyLimitCents: z.number().int().min(0).max(100000).nullable() }).parse(req.body);
      await pool.query('UPDATE users SET daily_spend_limit_cents = $2 WHERE id = $1', [req.userId, dailyLimitCents]);
      return { ok: true };
    });

    // ---------- Bonos ----------
    r.post('/api/bonus/wheel', async (req, reply) => {
      const uid = req.userId!;
      return withTx(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [uid]);
        const last = await tx.query(`SELECT max(created_at) t FROM ledger WHERE user_id = $1 AND reason = 'daily_wheel'`, [uid]);
        if (availableAt(last.rows[0].t, DAILY_WHEEL.cooldownHours)) return reply.code(429).send({ error: 'La rueda ya se giró hoy.' });
        const idx = weighted(DAILY_WHEEL.segments.map((s) => s.weight));
        const coins = DAILY_WHEEL.segments[idx].coins;
        const balance = await move(tx, uid, coins, 'daily_wheel');
        return { segment: idx, coins, balance, segments: DAILY_WHEEL.segments.map((s) => s.coins) };
      });
    });

    r.post('/api/bonus/gift', async (req, reply) => {
      const uid = req.userId!;
      return withTx(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [uid]);
        const last = await tx.query(`SELECT max(created_at) t FROM ledger WHERE user_id = $1 AND reason = 'gift'`, [uid]);
        if (availableAt(last.rows[0].t, GIFT.everyHours)) return reply.code(429).send({ error: 'Tu regalo aún no está listo.' });
        return { coins: GIFT.coins, balance: await move(tx, uid, GIFT.coins, 'gift') };
      });
    });

    r.post('/api/missions/claim', async (req, reply) => {
      const uid = req.userId!;
      const m = await missionState(uid);
      if (m.claimed || m.progress < m.goal) return reply.code(409).send({ error: 'La misión aún no está completa.' });
      return withTx(async (tx) => ({ coins: m.coins, balance: await move(tx, uid, m.coins, 'mission', { ref: m.id }) }));
    });

    // Anuncio con recompensa. Hoy es una simulación: falta conectar la red de anuncios
    // (ej. Google Ad Manager rewarded) y validar su callback del lado del servidor.
    r.post('/api/ads/start', async (req, reply) => {
      if ((await countToday(req.userId!, 'ad_reward')) >= AD_REWARD.perDay)
        return reply.code(429).send({ error: 'Ya viste todos los anuncios de hoy.' });
      const token = randomBytes(16).toString('hex');
      adTokens.set(token, { userId: req.userId!, at: Date.now() });
      return { token, seconds: AD_REWARD.minWatchSeconds };
    });

    r.post('/api/ads/claim', async (req, reply) => {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const t = adTokens.get(token);
      if (!t || t.userId !== req.userId) return reply.code(400).send({ error: 'Anuncio no válido.' });
      if (Date.now() - t.at < (AD_REWARD.minWatchSeconds - 1) * 1000) return reply.code(400).send({ error: 'Termina de ver el anuncio.' });
      adTokens.delete(token);
      return withTx(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
        const n = await tx.query(
          `SELECT count(*)::int n FROM ledger WHERE user_id = $1 AND reason = 'ad_reward' AND created_at >= date_trunc('day', now())`,
          [req.userId],
        );
        if (n.rows[0].n >= AD_REWARD.perDay) return reply.code(429).send({ error: 'Ya viste todos los anuncios de hoy.' });
        return { coins: AD_REWARD.coins, balance: await move(tx, req.userId!, AD_REWARD.coins, 'ad_reward') };
      });
    });

    // ---------- Tienda ----------
    r.get('/api/store', async () => ({ packs: PACKS, paymentsMode: PAYMENTS_MODE }));

    r.post('/api/store/buy', async (req, reply) => {
      const { packId } = z.object({ packId: z.string() }).parse(req.body);
      const pack = PACKS.find((p) => p.id === packId);
      if (!pack) return reply.code(404).send({ error: 'Paquete no existe.' });
      if (PAYMENTS_MODE !== 'demo') return reply.code(503).send({ error: 'Las compras se activan pronto.' });
      const uid = req.userId!;
      return withTx(async (tx) => {
        const u = await tx.query('SELECT daily_spend_limit_cents FROM users WHERE id = $1 FOR UPDATE', [uid]);
        const limit = u.rows[0].daily_spend_limit_cents;
        if (limit !== null) {
          const s = await tx.query(
            `SELECT coalesce(sum(price_cents),0)::int s FROM purchases WHERE user_id = $1 AND status = 'paid' AND created_at >= date_trunc('day', now())`,
            [uid],
          );
          if (s.rows[0].s + pack.priceCents > limit)
            return reply.code(403).send({ error: 'Esta compra supera tu límite diario. Puedes cambiarlo en la tienda.' });
        }
        if (pack.welcome) {
          const w = await tx.query(`SELECT 1 FROM purchases WHERE user_id = $1 AND pack_id = 'welcome' AND status = 'paid'`, [uid]);
          if (w.rowCount) return reply.code(409).send({ error: 'La oferta de bienvenida es solo una vez.' });
        }
        const p = await tx.query(
          `INSERT INTO purchases (user_id, pack_id, coins, price_cents, status) VALUES ($1,$2,$3,$4,'paid') RETURNING id`,
          [uid, pack.id, pack.coins, pack.priceCents],
        );
        const balance = await move(tx, uid, pack.coins, 'purchase', { ref: String(p.rows[0].id) });
        if (pack.freeSpins) {
          await tx.query(
            `INSERT INTO slot_state (user_id, game, free_spins, free_bet) VALUES ($1,$2,$3,500)
             ON CONFLICT (user_id, game) DO UPDATE SET free_spins = slot_state.free_spins + $3,
             free_bet = CASE WHEN slot_state.free_spins = 0 THEN 500 ELSE slot_state.free_bet END`,
            [uid, SLOT_GAME, pack.freeSpins],
          );
        }
        return { balance, coins: pack.coins, freeSpins: pack.freeSpins ?? 0 };
      });
    });

    // ---------- Tesoro Maya ----------
    r.get('/api/slot/meta', async () => ({
      symbols: slot.SYMBOLS,
      paytable: slot.PAYTABLE,
      scatterPay: slot.SCATTER_PAY,
      freeSpins: slot.FREE_SPINS,
      lines: slot.PAYLINES,
      betSteps: slot.BET_STEPS,
      rtp: Math.round(slot.theoreticalRtp().rtp * 1000) / 10,
    }));

    r.post('/api/slot/spin', async (req) => {
      const { bet } = z.object({ bet: z.number().int() }).parse(req.body);
      const uid = req.userId!;
      return withTx(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [uid]);
        const st = await tx.query('SELECT free_spins, free_bet FROM slot_state WHERE user_id = $1 AND game = $2 FOR UPDATE', [uid, SLOT_GAME]);
        let freeSpins: number = st.rows[0]?.free_spins ?? 0;
        let freeBet: number = st.rows[0]?.free_bet ?? 0;
        const isFree = freeSpins > 0;
        const stake = isFree ? freeBet : bet;
        if (!isFree && !(slot.BET_STEPS as readonly number[]).includes(bet)) {
          const e = new Error('Apuesta no válida.') as Error & { statusCode: number };
          e.statusCode = 400;
          throw e;
        }
        const ref = randomBytes(8).toString('hex');
        let balance: number;
        if (isFree) {
          freeSpins--;
          const b = await tx.query('SELECT balance FROM users WHERE id = $1', [uid]);
          balance = b.rows[0].balance;
        } else {
          balance = await move(tx, uid, -stake, 'bet', { game: SLOT_GAME, ref });
        }
        const result = slot.spin(stake);
        if (result.totalWin > 0) balance = await move(tx, uid, result.totalWin, 'win', { game: SLOT_GAME, ref });
        if (result.freeSpinsAwarded) {
          if (freeSpins === 0) freeBet = stake;
          freeSpins += result.freeSpinsAwarded;
        }
        await tx.query(
          `INSERT INTO slot_state (user_id, game, free_spins, free_bet) VALUES ($1,$2,$3,$4)
           ON CONFLICT (user_id, game) DO UPDATE SET free_spins = $3, free_bet = $4`,
          [uid, SLOT_GAME, freeSpins, freeBet],
        );
        return { ...result, bet: stake, wasFree: isFree, freeSpinsLeft: freeSpins, balance };
      });
    });

    // ---------- Cohete ----------
    r.post('/api/crash/start', async (req, reply) => {
      const body = z
        .object({ bet: z.number().int().min(crash.MIN_BET).max(crash.MAX_BET), autoCashout: z.number().min(1.01).max(1000).nullable().optional() })
        .parse(req.body);
      const uid = req.userId!;
      return withTx(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [uid]);
        const open = await tx.query(`SELECT * FROM crash_rounds WHERE user_id = $1 AND status = 'flying'`, [uid]);
        for (const o of open.rows) {
          const s = await settleCrash(tx, o, Date.now(), false);
          if (s.status === 'flying') return reply.code(409).send({ error: 'Ya tienes una ronda en vuelo.' });
        }
        const round = crash.newRound();
        const id = randomBytes(10).toString('hex');
        const balance = await move(tx, uid, -body.bet, 'bet', { game: CRASH_GAME, ref: id });
        const ins = await tx.query(
          `INSERT INTO crash_rounds (id, user_id, bet, auto_cashout, crash_point, server_seed) VALUES ($1,$2,$3,$4,$5,$6) RETURNING started_at`,
          [id, uid, body.bet, body.autoCashout ?? null, round.crashPoint, round.seed],
        );
        return { id, hash: round.hash, balance, startedAt: ins.rows[0].started_at, serverNow: Date.now(), growthPerMs: crash.GROWTH_PER_MS };
      });
    });

    const roundAction = (manual: boolean) => async (req: any, reply: any) => {
      const { id } = z.object({ id: z.string() }).parse(manual ? req.body : req.query);
      return withTx(async (tx) => {
        const r = await tx.query('SELECT * FROM crash_rounds WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, req.userId]);
        if (!r.rowCount) return reply.code(404).send({ error: 'Ronda no existe.' });
        const round = r.rows[0];
        if (round.status !== 'flying') {
          return {
            status: round.status,
            cashoutAt: round.cashout_at,
            payout: round.payout,
            crashPoint: Number(round.crash_point),
            seed: round.server_seed,
          };
        }
        return settleCrash(tx, round, Date.now(), manual);
      });
    };
    r.post('/api/crash/cashout', roundAction(true));
    r.get('/api/crash/status', roundAction(false));

    r.get('/api/crash/history', async (req) => {
      const h = await pool.query(
        `SELECT crash_point FROM crash_rounds WHERE user_id = $1 AND status <> 'flying' ORDER BY started_at DESC LIMIT 8`,
        [req.userId],
      );
      return { history: h.rows.map((x) => Number(x.crash_point)) };
    });

    // ---------- Social ----------
    r.get('/api/feed', async () => {
      const f = await pool.query(
        `SELECT u.display_name, l.game, l.delta, l.created_at FROM ledger l JOIN users u ON u.id = l.user_id
         WHERE l.reason = 'win' AND l.delta >= 5000 ORDER BY l.created_at DESC LIMIT 6`,
      );
      return { items: f.rows.map((x) => ({ name: x.display_name, game: x.game, amount: x.delta, at: x.created_at })) };
    });

    r.get('/api/leaderboard', async (req) => {
      const q = `SELECT u.id, u.display_name, sum(l.delta)::bigint AS total FROM ledger l JOIN users u ON u.id = l.user_id
                 WHERE l.reason = 'win' AND l.created_at >= date_trunc('week', now()) GROUP BY u.id ORDER BY total DESC`;
      const all = await pool.query(q);
      const rows = all.rows.map((x, i) => ({ rank: i + 1, id: x.id, name: x.display_name, total: Number(x.total) }));
      const me = rows.find((x) => x.id === req.userId) ?? null;
      const end = new Date();
      const day = (end.getUTCDay() + 6) % 7;
      end.setUTCHours(0, 0, 0, 0);
      end.setUTCDate(end.getUTCDate() - day + 7);
      const strip = (x: any) => x && { rank: x.rank, name: x.name, total: x.total };
      return { top: rows.slice(0, 5).map(strip), me: strip(me), endsAt: end.toISOString() };
    });
  });
}
