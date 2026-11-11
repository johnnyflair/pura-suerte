import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { pool, withTx } from './db/index.js';
import { move } from './wallet.js';
import { BRAND, MIN_AGE, WELCOME_COINS } from './config.js';

const SESSION_DAYS = 30;
const COOKIE = 'sid';
const isProd = process.env.NODE_ENV === 'production';
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const google = googleClientId ? new OAuth2Client(googleClientId) : null;

declare module 'fastify' {
  interface FastifyRequest {
    userId?: number;
  }
}

export function ageFrom(birth: string, now = new Date()): number {
  const b = new Date(birth + 'T00:00:00Z');
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

const signupFields = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ageConfirmed: z.literal(true),
});

function checkAge(birthDate: string) {
  const age = ageFrom(birthDate);
  if (Number.isNaN(age) || age < MIN_AGE || age > 120) {
    const e = new Error(`Debes tener ${MIN_AGE} años o más para jugar.`) as Error & { statusCode: number };
    e.statusCode = 403;
    throw e;
  }
}

async function createSession(reply: FastifyReply, userId: number) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [token, userId],
  );
  reply.setCookie(COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_DAYS * 86400,
  });
}

async function findOrCreateUser(p: {
  email: string;
  displayName: string;
  googleSub?: string;
  birthDate?: string | null;
}): Promise<{ id: number; isNew: boolean } | { needsSignup: true }> {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1 OR ($2::text IS NOT NULL AND google_sub = $2)', [
    p.email.toLowerCase(),
    p.googleSub ?? null,
  ]);
  if (existing.rowCount) return { id: existing.rows[0].id, isNew: false };
  if (!p.birthDate) return { needsSignup: true };
  checkAge(p.birthDate);
  const id = await withTx(async (tx) => {
    const r = await tx.query(
      'INSERT INTO users (email, display_name, google_sub, birth_date) VALUES ($1,$2,$3,$4) RETURNING id',
      [p.email.toLowerCase(), p.displayName.slice(0, 40), p.googleSub ?? null, p.birthDate],
    );
    const uid = r.rows[0].id as number;
    await move(tx, uid, WELCOME_COINS, 'welcome');
    return uid;
  });
  return { id, isNew: true };
}

async function sendMagicLink(email: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[correo] Enlace de acceso para ${email}: ${link}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? `${BRAND} <no-reply@example.com>`,
      to: email,
      subject: `Tu enlace para entrar a ${BRAND}`,
      html: `<p>Toca el botón para entrar. El enlace vence en 20 minutos.</p><p><a href="${link}">Entrar a ${BRAND}</a></p>`,
    }),
  });
  if (!res.ok) throw new Error('No se pudo enviar el correo');
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE];
  if (token) {
    const r = await pool.query('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()', [token]);
    if (r.rowCount) {
      req.userId = r.rows[0].user_id;
      return;
    }
  }
  return reply.code(401).send({ error: 'Inicia sesión para continuar.' });
}

export function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/config', async () => ({ googleClientId: googleClientId ?? null, brand: BRAND, minAge: MIN_AGE }));

  // Entrar con Google: si el jugador es nuevo, el cliente debe mandar fecha de nacimiento y confirmación.
  app.post('/api/auth/google', async (req, reply) => {
    if (!google) return reply.code(503).send({ error: 'Google no está configurado.' });
    const body = z
      .object({ credential: z.string(), birthDate: z.string().optional(), ageConfirmed: z.boolean().optional() })
      .parse(req.body);
    const ticket = await google.verifyIdToken({ idToken: body.credential, audience: googleClientId });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) return reply.code(400).send({ error: 'Correo de Google no verificado.' });
    if (body.birthDate) signupFields.parse({ birthDate: body.birthDate, ageConfirmed: body.ageConfirmed });
    const r = await findOrCreateUser({
      email: p.email,
      displayName: p.given_name ?? p.name ?? p.email.split('@')[0],
      googleSub: p.sub,
      birthDate: body.birthDate,
    });
    if ('needsSignup' in r) return reply.code(409).send({ needsSignup: true });
    await createSession(reply, r.id);
    return { ok: true, isNew: r.isNew };
  });

  // Entrar con correo: se envía un enlace mágico.
  app.post('/api/auth/email/start', async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        displayName: z.string().min(1).max(40).optional(),
        birthDate: z.string().optional(),
        ageConfirmed: z.boolean().optional(),
      })
      .parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (!exists.rowCount) {
      if (!body.birthDate || !body.displayName) return reply.code(409).send({ needsSignup: true });
      signupFields.parse({ birthDate: body.birthDate, ageConfirmed: body.ageConfirmed });
      checkAge(body.birthDate);
    }
    const token = randomBytes(24).toString('base64url');
    await pool.query(
      `INSERT INTO email_tokens (token, email, display_name, birth_date, expires_at) VALUES ($1,$2,$3,$4, now() + interval '20 minutes')`,
      [token, email, body.displayName ?? null, body.birthDate ?? null],
    );
    const base = process.env.PUBLIC_URL ?? `${req.protocol}://${req.headers.host}`;
    const link = `${base}/api/auth/email/verify?token=${token}`;
    await sendMagicLink(email, link);
    return { ok: true, devLink: !isProd && !process.env.RESEND_API_KEY ? link : undefined };
  });

  app.get('/api/auth/email/verify', async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.query);
    const r = await pool.query(
      'UPDATE email_tokens SET used = true WHERE token = $1 AND used = false AND expires_at > now() RETURNING *',
      [token],
    );
    if (!r.rowCount) return reply.redirect('/registro?error=enlace');
    const t = r.rows[0];
    const birth = t.birth_date ? new Date(t.birth_date).toISOString().slice(0, 10) : null;
    const u = await findOrCreateUser({ email: t.email, displayName: t.display_name ?? t.email.split('@')[0], birthDate: birth });
    if ('needsSignup' in u) return reply.redirect('/registro?error=registro');
    await createSession(reply, u.id);
    return reply.redirect(u.isNew ? '/?bienvenida=1' : '/');
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });
}
