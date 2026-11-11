import { newSeed, sha256, uniformFromSeed } from './rng.js';

/**
 * Cohete — crash en modo individual.
 * El punto de explosión sale de una semilla secreta del servidor. Al iniciar se
 * entrega su hash; al terminar se revela la semilla para que el jugador verifique.
 * Con ventaja de la casa de 4%, P(llegar a x) = 0.96 / x → RTP 96% para cualquier estrategia.
 */

export const HOUSE_EDGE = 0.04;
export const MAX_MULTIPLIER = 1000;
export const GROWTH_PER_MS = 0.00006; // x2 a los ~11.6 s, x10 a los ~38 s
export const MIN_BET = 100;
export const MAX_BET = 50000;

export function crashPointFromSeed(seed: string): number {
  const u = uniformFromSeed(seed);
  const raw = (1 - HOUSE_EDGE) / (1 - u);
  const cp = Math.floor(raw * 100) / 100;
  return Math.min(Math.max(cp, 1), MAX_MULTIPLIER);
}

export function newRound() {
  const seed = newSeed();
  return { seed, hash: sha256(seed), crashPoint: crashPointFromSeed(seed) };
}

/** Multiplicador a los `ms` milisegundos de vuelo. */
export function multiplierAt(ms: number): number {
  return Math.floor(Math.exp(GROWTH_PER_MS * Math.max(0, ms)) * 100) / 100;
}

/** Milisegundos que tarda el cohete en llegar a `m`. */
export function msToReach(m: number): number {
  return Math.log(m) / GROWTH_PER_MS;
}
