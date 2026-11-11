import { describe, it, expect } from 'vitest';
import { evaluate, spin, theoreticalRtp, FREE_SPINS, type Grid } from './slot.js';
import { crashPointFromSeed, multiplierAt, msToReach, HOUSE_EDGE } from './crash.js';
import { newSeed } from './rng.js';

describe('Tesoro Maya', () => {
  it('RTP teórico entre 95% y 97%', () => {
    const { rtp } = theoreticalRtp();
    expect(rtp).toBeGreaterThan(0.95);
    expect(rtp).toBeLessThan(0.97);
  });

  it('paga 5 tesoros en la línea central', () => {
    const grid: Grid = [0, 1, 2, 3, 4].map(() => ['cafe', 'tesoro', 'fruta']);
    const r = evaluate(grid, 2000);
    const center = r.lineWins.find((w) => w.line === 0)!;
    expect(center.count).toBe(5);
    expect(center.amount).toBe(850 * 100);
  });

  it('3 templos dan giros gratis y 2× la apuesta', () => {
    const grid: Grid = [
      ['templo', 'cafe', 'fruta'],
      ['coin', 'templo', 'gift'],
      ['fruta', 'cafe', 'templo'],
      ['cafe', 'fruta', 'coin'],
      ['gift', 'coin', 'fruta'],
    ];
    const r = evaluate(grid, 1000);
    expect(r.freeSpinsAwarded).toBe(FREE_SPINS);
    expect(r.scatterWin).toBe(2000);
  });

  it('la simulación coincide con el RTP teórico', () => {
    const bet = 2000;
    let paid = 0, won = 0, free = 0;
    for (let i = 0; i < 400_000; i++) {
      const isFree = free > 0;
      if (isFree) free--; else paid += bet;
      const r = spin(bet);
      won += r.totalWin;
      free += r.freeSpinsAwarded;
    }
    const sim = won / paid;
    expect(Math.abs(sim - theoreticalRtp().rtp)).toBeLessThan(0.03);
  }, 60_000);
});

describe('Cohete', () => {
  it('P(llegar a 2x) ≈ 48%', () => {
    let hits = 0;
    const n = 200_000;
    for (let i = 0; i < n; i++) if (crashPointFromSeed(newSeed()) >= 2) hits++;
    expect(hits / n).toBeCloseTo((1 - HOUSE_EDGE) / 2, 2);
  });

  it('el multiplicador crece y es consistente', () => {
    expect(multiplierAt(0)).toBe(1);
    expect(multiplierAt(msToReach(2) + 1)).toBeGreaterThanOrEqual(2);
  });
});
