import { randomBytes, createHash } from 'node:crypto';

/** Número uniforme en [0, 1) con 52 bits de entropía criptográfica. */
export function uniform(): number {
  const b = randomBytes(7);
  // 52 bits: 4 bits del primer byte + 6 bytes completos
  const hi = b[0] & 0x0f;
  let v = hi;
  for (let i = 1; i < 7; i++) v = v * 256 + b[i];
  return v / 2 ** 52;
}

/** Elige un índice según pesos enteros. */
export function weighted(weights: readonly number[], u: number = uniform()): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = u * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function newSeed(): string {
  return randomBytes(32).toString('hex');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Uniforme determinista a partir de una semilla (para rondas verificables). */
export function uniformFromSeed(seed: string): number {
  const h = sha256(seed);
  return parseInt(h.slice(0, 13), 16) / 2 ** 52;
}
