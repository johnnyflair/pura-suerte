import { uniform, weighted } from './rng.js';

/**
 * Tesoro Maya — slot de 5 rodillos × 3 filas, 20 líneas fijas.
 * Paga de izquierda a derecha desde el rodillo 1. TEMPLO es scatter:
 * 3 o más en cualquier posición pagan 2× la apuesta y dan 10 giros gratis.
 * El RTP exacto se calcula con theoreticalRtp() y se prueba por simulación.
 */

export const SYMBOLS = ['cafe', 'fruta', 'coin', 'gift', 'tesoro', 'templo'] as const;
export type Sym = (typeof SYMBOLS)[number];
export const SCATTER: Sym = 'templo';

// Peso de cada símbolo por rodillo (cada celda se sortea de forma independiente).
export const REEL_WEIGHTS: number[][] = [
  [30, 28, 18, 13, 8, 3],
  [30, 28, 18, 13, 8, 3],
  [30, 28, 18, 13, 8, 3],
  [30, 28, 18, 13, 8, 3],
  [30, 28, 18, 13, 8, 3],
];

// Pago en múltiplos de la apuesta por línea, para 3, 4 y 5 iguales.
export const PAYTABLE: Record<Exclude<Sym, 'templo'>, [number, number, number]> = {
  cafe: [6, 15, 55],
  fruta: [7, 19, 70],
  coin: [11, 42, 170],
  gift: [17, 70, 280],
  tesoro: [34, 150, 850],
};

export const SCATTER_PAY = 2; // × apuesta total
export const FREE_SPINS = 10;
export const LINES = 20;

// Filas (0 arriba, 1 centro, 2 abajo) por rodillo para cada línea.
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
];

export const BET_STEPS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000] as const;

export type Grid = Sym[][]; // grid[reel][row]

export interface LineWin {
  line: number;
  symbol: Sym;
  count: number;
  amount: number;
  cells: [number, number][]; // [reel, row]
}

export interface SpinResult {
  grid: Grid;
  lineWins: LineWin[];
  scatterCount: number;
  scatterWin: number;
  freeSpinsAwarded: number;
  totalWin: number;
}

export function randomGrid(rand: () => number = uniform): Grid {
  return REEL_WEIGHTS.map((w) => [0, 1, 2].map(() => SYMBOLS[weighted(w, rand())]));
}

/** Evalúa una cuadrícula. `bet` es la apuesta total (múltiplo de 20). */
export function evaluate(grid: Grid, bet: number): SpinResult {
  const lineBet = bet / LINES;
  const lineWins: LineWin[] = [];
  PAYLINES.forEach((rows, line) => {
    const first = grid[0][rows[0]];
    if (first === SCATTER) return;
    let count = 1;
    while (count < 5 && grid[count][rows[count]] === first) count++;
    if (count >= 3) {
      const mult = PAYTABLE[first as Exclude<Sym, 'templo'>][count - 3];
      lineWins.push({
        line,
        symbol: first,
        count,
        amount: Math.round(mult * lineBet),
        cells: rows.slice(0, count).map((row, reel) => [reel, row]),
      });
    }
  });
  let scatterCount = 0;
  for (const reel of grid) for (const s of reel) if (s === SCATTER) scatterCount++;
  const scatterWin = scatterCount >= 3 ? bet * SCATTER_PAY : 0;
  const freeSpinsAwarded = scatterCount >= 3 ? FREE_SPINS : 0;
  const totalWin = lineWins.reduce((a, w) => a + w.amount, 0) + scatterWin;
  return { grid, lineWins, scatterCount, scatterWin, freeSpinsAwarded, totalWin };
}

export function spin(bet: number, rand: () => number = uniform): SpinResult {
  return evaluate(randomGrid(rand), bet);
}

/** RTP teórico exacto (incluye el valor de los giros gratis y sus re-activaciones). */
export function theoreticalRtp() {
  const probs = REEL_WEIGHTS.map((w) => {
    const t = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / t);
  });
  const idx = (s: Sym) => SYMBOLS.indexOf(s);
  // Pago esperado de una línea en múltiplos de la apuesta por línea
  let lineEv = 0;
  for (const s of Object.keys(PAYTABLE) as Exclude<Sym, 'templo'>[]) {
    const i = idx(s);
    for (let n = 3; n <= 5; n++) {
      let p = 1;
      for (let r = 0; r < n; r++) p *= probs[r][i];
      if (n < 5) p *= 1 - probs[n][i];
      lineEv += p * PAYTABLE[s][n - 3];
    }
  }
  // Cada línea vale 1/20 de la apuesta: 20 líneas × EV/20 = EV
  const lineRtp = lineEv;
  // Distribución del número de scatters en 15 celdas independientes
  let dist = [1];
  for (const reel of probs) {
    const p = reel[idx(SCATTER)];
    for (let row = 0; row < 3; row++) {
      const next = new Array(dist.length + 1).fill(0);
      dist.forEach((v, k) => {
        next[k] += v * (1 - p);
        next[k + 1] += v * p;
      });
      dist = next;
    }
  }
  const trigger = dist.slice(3).reduce((a, b) => a + b, 0);
  const base = lineRtp + trigger * SCATTER_PAY;
  const rtp = base / (1 - FREE_SPINS * trigger);
  return { lineRtp, trigger, base, rtp, hitFreeSpinsEvery: 1 / trigger };
}
