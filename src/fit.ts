/**
 * Fit the shared + per-generated-frame model to overhead values entered per multiplier:
 *   overhead(M) = shared + (M − 1) × perFrame
 * by least squares over the multipliers that have a value.
 */
import { FG_MULTIPLIERS, RANGES, type ManualOverhead } from './model';

export interface LinearFit {
  sharedMs: number;
  perGeneratedFrameMs: number;
  /** Largest absolute difference between the fitted line and an entered value (ms). */
  maxErrorMs: number;
  /** Number of multipliers used. */
  points: number;
}

/** Unconstrained least-squares fit. Null when fewer than two multipliers have a value. */
export function fitLinear(overhead: ManualOverhead): LinearFit | null {
  const pts = FG_MULTIPLIERS.filter((m) => overhead[m] !== null).map((m) => ({ x: m - 1, y: overhead[m] as number }));
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const perGeneratedFrameMs = sxy / sxx;
  const sharedMs = my - perGeneratedFrameMs * mx;
  const maxErrorMs = Math.max(...pts.map((p) => Math.abs(sharedMs + perGeneratedFrameMs * p.x - p.y)));
  return { sharedMs, perGeneratedFrameMs, maxErrorMs, points: n };
}

/**
 * A fit is "poor" when the largest difference exceeds both 0.25 ms and 10 % of the mean value.
 * Small absolute differences on tiny values, or rounding in published data, don't trigger it.
 */
const POOR_FIT_ABS_MS = 0.25;
const POOR_FIT_REL = 0.1;

export type FitCheck =
  | { ok: true; fit: LinearFit; warning?: string; assumption?: string }
  | { ok: false; error: string; fit?: LinearFit };

/** Fit and check that the result is usable as shared and per-frame costs. */
export function checkFit(overhead: ManualOverhead): FitCheck {
  const present = FG_MULTIPLIERS.filter((m) => overhead[m] !== null);
  if (present.length === 0) {
    return { ok: false, error: 'Enter a value for at least one multiplier to estimate the shared and per-frame costs.' };
  }
  if (present.length === 1) {
    // One value can't separate shared from per-frame cost. Assume the worst case for higher
    // multipliers: no shared work, so every generated frame costs the same.
    const m = present[0]!;
    const value = overhead[m] as number;
    const fit: LinearFit = { sharedMs: 0, perGeneratedFrameMs: value / (m - 1), maxErrorMs: 0, points: 1 };
    if (fit.perGeneratedFrameMs > RANGES.perGeneratedFrameMs.max) {
      return {
        ok: false,
        fit,
        error: `The cost per generated frame would be above the model's limit of ${RANGES.perGeneratedFrameMs.max} ms.`,
      };
    }
    return {
      ok: true,
      fit,
      assumption:
        `Only ×${m} has a value. The model then assumes the worst case for higher multipliers, with no shared work, ` +
        `so every generated frame costs ${fit.perGeneratedFrameMs.toFixed(2)} ms.`,
    };
  }
  const fit = fitLinear(overhead)!;
  if (fit.perGeneratedFrameMs < 0) {
    return {
      ok: false,
      fit,
      error:
        'Higher multipliers have less overhead than lower ones, which would need a negative cost per generated frame. Check the values.',
    };
  }
  if (fit.sharedMs < 0) {
    return {
      ok: false,
      fit,
      error:
        'The overhead grows faster than one cost per generated frame allows, so the shared cost would be negative. Check the values.',
    };
  }
  if (fit.sharedMs > RANGES.sharedOverheadMs.max || fit.perGeneratedFrameMs > RANGES.perGeneratedFrameMs.max) {
    return {
      ok: false,
      fit,
      error: `The fitted costs are above the model's limits of ${RANGES.sharedOverheadMs.max} ms shared and ${RANGES.perGeneratedFrameMs.max} ms per generated frame.`,
    };
  }
  const values = FG_MULTIPLIERS.map((m) => overhead[m]).filter((v): v is number => v !== null);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (fit.maxErrorMs > POOR_FIT_ABS_MS && fit.maxErrorMs > POOR_FIT_REL * mean) {
    return {
      ok: true,
      fit,
      warning: `They don't follow a straight line, and the model misses one by ${fit.maxErrorMs.toFixed(2)} ms. The values describe this case better than the model.`,
    };
  }
  return { ok: true, fit };
}
