import type { Tx } from './db/index.js';

export class InsufficientFunds extends Error {
  constructor() {
    super('Saldo insuficiente');
  }
}

/** Bloquea la fila del jugador para que dos apuestas simultáneas no gasten el mismo saldo. */
export async function lockBalance(tx: Tx, userId: number): Promise<number> {
  const r = await tx.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (!r.rowCount) throw new Error('Usuario no existe');
  return r.rows[0].balance as number;
}

/** Aplica un movimiento de monedas y lo deja en el libro contable. */
export async function move(
  tx: Tx,
  userId: number,
  delta: number,
  reason: string,
  opts: { game?: string; ref?: string } = {},
): Promise<number> {
  if (!Number.isSafeInteger(delta)) throw new Error('Monto inválido');
  const current = await lockBalance(tx, userId);
  const next = current + delta;
  if (next < 0) throw new InsufficientFunds();
  await tx.query('UPDATE users SET balance = $2 WHERE id = $1', [userId, next]);
  await tx.query(
    'INSERT INTO ledger (user_id, delta, balance_after, reason, game, ref) VALUES ($1,$2,$3,$4,$5,$6)',
    [userId, delta, next, reason, opts.game ?? null, opts.ref ?? null],
  );
  return next;
}
