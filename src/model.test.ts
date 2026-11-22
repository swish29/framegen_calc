import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUTS,
  MULTIPLIERS,
  calculatedOverheadMs,
  cloneInputs,
  displayedFPSFromOverhead,
  overheadFromDisplayedFPS,
  computeAll,
  computeRow,
  fgOverheadMs,
  sanitizeInputs,
  type CalculatorInputs,
  type Multiplier,
  type ResultRow,
} from './model';

// Reference configuration from the acceptance examples (not the UI defaults).
const REFERENCE: CalculatorInputs = {
  baseFPS: 120,
  sharedOverheadMs: 0.7,
  perGeneratedFrameMs: 0.8,
  mode: 'calculated',
  manualOverheadMs: { 2: 1.5, 3: 2.3, 4: 3.1, 5: 3.9 },
};

const inputs = (over: Partial<CalculatorInputs> = {}): CalculatorInputs => ({
  ...cloneInputs(REFERENCE),
  ...over,
});

/** computeAll for configurations where every multiplier has a value. */
const all = (cfg: Partial<CalculatorInputs>): ResultRow[] =>
  computeAll(cfg).map((r) => {
    if (!r) throw new Error('unexpected missing row');
    return r;
  });
/** computeRow for configurations where the multiplier has a value. */
const row = (cfg: Partial<CalculatorInputs>, m: Multiplier): ResultRow => {
  const r = computeRow(cfg, m);
  if (!r) throw new Error('unexpected missing row');
  return r;
};

describe('UI defaults (55 FPS, 4.5 ms shared, 4 ms per frame)', () => {
  it('produce the expected table', () => {
    expect(DEFAULT_INPUTS).toMatchObject({ baseFPS: 55, sharedOverheadMs: 4.5, perGeneratedFrameMs: 4, mode: 'calculated' });
    const rows = all(cloneInputs(DEFAULT_INPUTS));
    const got = rows.map((r) => [r.displayedFPS.toFixed(1), r.realFPS.toFixed(1), r.fgOverheadMs.toFixed(2)]);
    expect(got).toEqual([
      ['55.0', '55.0', '0.00'],
      ['75.0', '37.5', '8.50'],
      ['97.8', '32.6', '12.50'],
      ['115.3', '28.8', '16.50'],
      ['129.3', '25.9', '20.50'],
    ]);
  });
});

describe('acceptance example (120 FPS, 0.7 ms shared, 0.8 ms per frame)', () => {
  const rows = all(inputs());
  const expected: [number, number, number][] = [
    [1, 120.0, 120.0],
    [2, 203.4, 101.7],
    [3, 282.1, 94.0],
    [4, 349.9, 87.5],
    [5, 408.7, 81.7],
  ];
  it.each(expected)('×%i → displayed %f, real %f', (m, displayed, real) => {
    const row = rows[m - 1]!;
    expect(row.multiplier).toBe(m);
    expect(Number(row.displayedFPS.toFixed(1))).toBe(displayed);
    expect(Number(row.realFPS.toFixed(1))).toBe(real);
  });

  it('matches the formulas exactly at full precision', () => {
    const r = rows[1]!;
    const frame = 1000 / 120;
    expect(r.originalFrameTimeMs).toBeCloseTo(frame, 12);
    expect(r.fgOverheadMs).toBeCloseTo(1.5, 12);
    expect(r.actualFrameTimeMs).toBeCloseTo(frame + 1.5, 12);
    expect(r.realFPS).toBeCloseTo(1000 / (frame + 1.5), 12);
    expect(r.displayedFPS).toBeCloseTo((2 * 1000) / (frame + 1.5), 12);
    expect(r.idealFPS).toBe(240);
    expect(r.fpsGainPercent).toBeCloseTo((r.displayedFPS / 120 - 1) * 100, 12);
    expect(r.realFPSPenaltyPercent).toBeCloseTo((1 - r.realFPS / 120) * 100, 12);
  });

  it('overhead grows by per-frame cost for each extra generated frame', () => {
    [0, 1.5, 2.3, 3.1, 3.9].forEach((v, i) => expect(rows[i]!.fgOverheadMs).toBeCloseTo(v, 12));
  });
});

describe('FG Off (×1)', () => {
  it('has zero overhead regardless of configured costs', () => {
    const cfg = inputs({ sharedOverheadMs: 8, perGeneratedFrameMs: 5 });
    expect(fgOverheadMs(cfg, 1)).toBe(0);
    expect(fgOverheadMs({ ...cfg, mode: 'manual' }, 1)).toBe(0);
    expect(calculatedOverheadMs(8, 5, 1)).toBe(0);
  });

  it('real, displayed and ideal FPS all equal base FPS', () => {
    for (const baseFPS of [20, 60, 144, 240]) {
      const r = row(inputs({ baseFPS, sharedOverheadMs: 3, perGeneratedFrameMs: 2 }), 1);
      expect(r.realFPS).toBe(baseFPS);
      expect(r.displayedFPS).toBe(baseFPS);
      expect(r.idealFPS).toBe(baseFPS);
      expect(r.fpsGainPercent).toBe(0);
      expect(r.realFPSPenaltyPercent).toBe(0);
    }
  });
});

describe('model behaviour', () => {
  it('zero overhead produces ideal linear scaling', () => {
    const rows = all(inputs({ baseFPS: 90, sharedOverheadMs: 0, perGeneratedFrameMs: 0 }));
    for (const r of rows) {
      expect(r.displayedFPS).toBeCloseTo(90 * r.multiplier, 9);
      expect(r.displayedFPS).toBeCloseTo(r.idealFPS, 9);
      expect(r.realFPS).toBeCloseTo(90, 9);
      expect(r.realFPSPenaltyPercent).toBeCloseTo(0, 9);
      expect(r.fpsGainPercent).toBeCloseTo((r.multiplier - 1) * 100, 9);
    }
  });

  it('very high overhead can make FG slower than disabling it', () => {
    // 240 FPS = 4.17 ms; ×2 with 8 ms overhead → 12.17 ms → 82.2 real, 164.4 displayed.
    const r = row(inputs({ baseFPS: 240, sharedOverheadMs: 8, perGeneratedFrameMs: 5 }), 2);
    expect(r.displayedFPS).toBeLessThan(240);
    expect(r.fpsGainPercent).toBeLessThan(0);
    expect(r.realFPSPenaltyPercent).toBeGreaterThan(50);
  });

  it('displayed FPS is not clamped to base FPS or a refresh rate', () => {
    const slow = row(inputs({ baseFPS: 240, sharedOverheadMs: 8, perGeneratedFrameMs: 5 }), 5);
    expect(slow.displayedFPS).toBeCloseTo((5 * 1000) / (1000 / 240 + 8 + 4 * 5), 9);
    const fast = row(inputs({ baseFPS: 240, sharedOverheadMs: 0, perGeneratedFrameMs: 0 }), 5);
    expect(fast.displayedFPS).toBeCloseTo(1200, 9);
  });

  it('higher base FPS increases the relative penalty of fixed ms overhead', () => {
    const penalties = [30, 60, 120, 240].map(
      (baseFPS) => row(inputs({ baseFPS }), 2).realFPSPenaltyPercent,
    );
    for (let i = 1; i < penalties.length; i++) expect(penalties[i]!).toBeGreaterThan(penalties[i - 1]!);
    const gains = [30, 60, 120, 240].map((baseFPS) => row(inputs({ baseFPS }), 2).fpsGainPercent);
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeLessThan(gains[i - 1]!);
  });

  it('real FPS decreases monotonically with multiplier while overhead is positive', () => {
    const rows = all(inputs());
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.realFPS).toBeLessThan(rows[i - 1]!.realFPS);
  });
});

describe('manual overhead mode', () => {
  const manual = inputs({
    mode: 'manual',
    sharedOverheadMs: 8,
    perGeneratedFrameMs: 5,
    manualOverheadMs: { 2: 1, 3: 1.2, 4: 2.5, 5: 6 },
  });

  it('uses the entered overhead and ignores shared/per-frame costs', () => {
    expect([2, 3, 4, 5].map((m) => fgOverheadMs(manual, m as 2))).toEqual([1, 1.2, 2.5, 6]);
    const r = row(manual, 4);
    expect(r.fgOverheadMs).toBe(2.5);
    expect(r.realFPS).toBeCloseTo(1000 / (1000 / 120 + 2.5), 12);
    expect(r.displayedFPS).toBeCloseTo((4 * 1000) / (1000 / 120 + 2.5), 12);
  });

  it('reproduces calculated mode when given the same overheads', () => {
    const calc = all(inputs());
    const man = all(inputs({ mode: 'manual', sharedOverheadMs: 0, perGeneratedFrameMs: 0 }));
    expect(man).toEqual(calc.map((r) => ({ ...r, fgOverheadMs: expect.closeTo(r.fgOverheadMs, 12) })));
  });

  it('switching back to calculated mode restores formula overhead', () => {
    expect(fgOverheadMs({ ...manual, mode: 'calculated' }, 2)).toBe(13);
  });
});

describe('invalid inputs', () => {
  const bad: unknown[] = [NaN, Infinity, -Infinity, -5, 0, 1e9, '', 'abc', null, undefined];

  it('never produce NaN or infinite values', () => {
    for (const v of bad) {
      const cfg = {
        baseFPS: v,
        sharedOverheadMs: v,
        perGeneratedFrameMs: v,
        mode: 'manual',
        manualOverheadMs: { 2: v, 3: v, 4: v, 5: v },
      } as unknown as CalculatorInputs;
      for (const mode of ['calculated', 'manual'] as const) {
        for (const r of computeAll({ ...cfg, mode })) {
          // null is a valid manual value ("no data") and yields a missing row, never NaN.
          if (r === null) {
            expect(v === null && mode === 'manual').toBe(true);
            continue;
          }
          for (const [k, val] of Object.entries(r)) {
            expect(Number.isFinite(val), `${String(v)} → ${k}`).toBe(true);
          }
          expect(r.realFPS).toBeGreaterThan(0);
        }
      }
    }
  });

  it('clamps to ranges and falls back to defaults', () => {
    const s = sanitizeInputs({ baseFPS: 1000, sharedOverheadMs: -1, perGeneratedFrameMs: NaN });
    expect(s.baseFPS).toBe(240);
    expect(s.sharedOverheadMs).toBe(0);
    expect(s.perGeneratedFrameMs).toBe(DEFAULT_INPUTS.perGeneratedFrameMs);
    expect(s.mode).toBe('calculated');
    expect(sanitizeInputs({ baseFPS: 0 }).baseFPS).toBe(20);
    expect(sanitizeInputs({ mode: 'bogus' as 'manual' }).mode).toBe('calculated');
  });

  it('accepts numeric strings', () => {
    expect(sanitizeInputs({ baseFPS: '144' as unknown as number }).baseFPS).toBe(144);
  });

  it('handles empty input objects', () => {
    expect(sanitizeInputs(undefined)).toEqual(cloneInputs(DEFAULT_INPUTS));
    expect(all({})).toEqual(all(cloneInputs(DEFAULT_INPUTS)));
  });
});

it('returns one row per multiplier in order', () => {
  expect(all(inputs()).map((r) => r.multiplier)).toEqual([...MULTIPLIERS]);
});

describe('displayed FPS <-> overhead conversion', () => {
  it('derives overhead from a measured displayed FPS', () => {
    // 55 FPS base (18.18 ms), ×2 measured at 75 FPS: 2000 / 75 − 1000 / 55 = 8.4848 ms.
    expect(overheadFromDisplayedFPS(55, 2, 75)).toBeCloseTo(2000 / 75 - 1000 / 55, 12);
    // Ideal scaling implies zero overhead.
    expect(overheadFromDisplayedFPS(120, 4, 480)).toBeCloseTo(0, 12);
    // Measured FPS above ideal implies negative overhead (clamped to 0 by sanitizeInputs).
    expect(overheadFromDisplayedFPS(120, 2, 250)).toBeLessThan(0);
    expect(sanitizeInputs({ manualOverheadMs: { 2: overheadFromDisplayedFPS(120, 2, 250), 3: 1, 4: 1, 5: 1 } }).manualOverheadMs[2]).toBe(0);
  });

  it('rejects non-positive or non-finite FPS', () => {
    for (const v of [0, -10, NaN, Infinity]) expect(overheadFromDisplayedFPS(120, 2, v)).toBeNaN();
  });

  it('round-trips and matches computeRow in manual mode', () => {
    for (const m of [2, 3, 4, 5] as const) {
      const fps = displayedFPSFromOverhead(55, m, 6.25);
      expect(overheadFromDisplayedFPS(55, m, fps)).toBeCloseTo(6.25, 12);
      const r = row(inputs({ baseFPS: 55, mode: 'manual', manualOverheadMs: { 2: 6.25, 3: 6.25, 4: 6.25, 5: 6.25 } }), m);
      expect(r.displayedFPS).toBeCloseTo(fps, 12);
    }
  });
});

describe('missing manual values', () => {
  const cfg = inputs({ mode: 'manual', manualOverheadMs: { 2: 1.07, 3: null, 4: 1.78, 5: null } });

  it('produce no row for that multiplier and leave the others unchanged', () => {
    const rows = computeAll(cfg);
    expect(rows.map((r) => r?.multiplier ?? null)).toEqual([1, 2, null, 4, null]);
    expect(rows[1]!.fgOverheadMs).toBe(1.07);
    expect(rows[3]!.displayedFPS).toBeCloseTo((4 * 1000) / (1000 / 120 + 1.78), 12);
    expect(fgOverheadMs(cfg, 3)).toBeNull();
  });

  it('do not affect calculated mode or FG off', () => {
    expect(computeRow({ ...cfg, mode: 'calculated' }, 3)).not.toBeNull();
    expect(computeRow(cfg, 1)!.displayedFPS).toBe(120);
  });

  it('survive sanitization, while undefined falls back to the default', () => {
    const s = sanitizeInputs({ manualOverheadMs: { 2: null, 3: undefined } as never });
    expect(s.manualOverheadMs[2]).toBeNull();
    expect(s.manualOverheadMs[3]).toBe(DEFAULT_INPUTS.manualOverheadMs[3]);
  });
});
