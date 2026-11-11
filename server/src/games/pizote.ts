import { newSeed, sha256 } from './rng.js';
import { createHash } from 'node:crypto';

/**
 * Pizote cruza Chepe — juego de cruzar carriles.
 * Cada carril se pasa con probabilidad P. Cruzar k carriles paga EDGE / P^k,
 * así el retorno esperado es 96% sin importar en qué carril se retire el jugador.
 * El carril donde lo atropellan sale de una semilla secreta (se entrega su hash al empezar).
 */

export const LANES = 8;
export const P = 0.8;
export const EDGE = 0.96;
export const MIN_BET = 100;
export const MAX_BET = 50000;

export const LANE_NAMES = [
  'Av. Segunda', 'Circunvalación', 'Paseo Colón', 'Calle de la Soda',
  'La Sabana', 'Hospital', 'Zapote', 'Desamparados',
];

export function multiplier(k: number): number {
  if (k <= 0) return 1;
  return Math.floor((EDGE / Math.pow(P, k)) * 100) / 100;
}

export const MULTIPLIERS = Array.from({ length: LANES }, (_, i) => multiplier(i + 1));

/** Uniforme determinista para el carril k a partir de la semilla. */
function laneUniform(seed: string, k: number): number {
  const h = createHash('sha256').update(`${seed}:${k}`).digest('hex');
  return parseInt(h.slice(0, 13), 16) / 2 ** 52;
}

/** Primer carril donde pasa el bus; LANES + 1 si el pizote llega sano a la meta. */
export function crashLaneFromSeed(seed: string): number {
  for (let k = 1; k <= LANES; k++) if (laneUniform(seed, k) >= P) return k;
  return LANES + 1;
}

export function newRound() {
  const seed = newSeed();
  return { seed, hash: sha256(seed), crashLane: crashLaneFromSeed(seed) };
}
