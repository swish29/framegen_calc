/**
 * Frame Generation performance model.
 *
 * Millisecond-based: FG processing overhead is added sequentially to the
 * game's frame production time. All values are kept at full precision;
 * rounding is a presentation concern.
 */

export const MULTIPLIERS = [1, 2, 3, 4, 5] as const;
export type Multiplier = (typeof MULTIPLIERS)[number];

export const FG_MULTIPLIERS = [2, 3, 4, 5] as const;
export type FgMultiplier = (typeof FG_MULTIPLIERS)[number];

export type OverheadMode = 'calculated' | 'manual';

/** Manual overhead per multiplier in ms. `null` means no value for that multiplier (e.g. not measured). */
export type ManualOverhead = Record<FgMultiplier, number | null>;

export interface CalculatorInputs {
  /** Game FPS without Frame Generation. */
  baseFPS: number;
  /** Fixed processing cost of one FG cycle (ms). */
  sharedOverheadMs: number;
  /** Additional processing cost per generated frame (ms). */
  perGeneratedFrameMs: number;
  /** How FG overhead is determined. */
  mode: OverheadMode;
  /** Effective overhead per multiplier, used when mode === 'manual' (ms). */
  manualOverheadMs: ManualOverhead;
}

export interface ResultRow {
  multiplier: Multiplier;
  originalFrameTimeMs: number;
  fgOverheadMs: number;
  actualFrameTimeMs: number;
  realFPS: number;
  displayedFPS: number;
  idealFPS: number;
  fpsGainPercent: number;
  realFPSPenaltyPercent: number;
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const RANGES = {
  baseFPS: { min: 20, max: 240, step: 5 },
  sharedOverheadMs: { min: 0, max: 8, step: 0.1 },
  perGeneratedFrameMs: { min: 0, max: 5, step: 0.1 },
  manualOverheadMs: { min: 0, max: 60, step: 0.1 },
} as const satisfies Record<string, Range>;

/** Calculated-mode overhead for a multiplier, from shared + per-frame costs. */
export function calculatedOverheadMs(
  sharedOverheadMs: number,
  perGeneratedFrameMs: number,
  multiplier: number,
): number {
  if (multiplier <= 1) return 0;
  return sharedOverheadMs + (multiplier - 1) * perGeneratedFrameMs;
}

const DEFAULT_BASE_FPS = 55;
const DEFAULT_SHARED_MS = 4.5;
const DEFAULT_PER_FRAME_MS = 4;

export const DEFAULT_INPUTS: Readonly<CalculatorInputs> = Object.freeze({
  baseFPS: DEFAULT_BASE_FPS,
  sharedOverheadMs: DEFAULT_SHARED_MS,
  perGeneratedFrameMs: DEFAULT_PER_FRAME_MS,
  mode: 'calculated',
  manualOverheadMs: Object.freeze({
    2: calculatedOverheadMs(DEFAULT_SHARED_MS, DEFAULT_PER_FRAME_MS, 2),
    3: calculatedOverheadMs(DEFAULT_SHARED_MS, DEFAULT_PER_FRAME_MS, 3),
    4: calculatedOverheadMs(DEFAULT_SHARED_MS, DEFAULT_PER_FRAME_MS, 4),
    5: calculatedOverheadMs(DEFAULT_SHARED_MS, DEFAULT_PER_FRAME_MS, 5),
  }) as ManualOverhead,
});

export function cloneInputs(inputs: Readonly<CalculatorInputs>): CalculatorInputs {
  return { ...inputs, manualOverheadMs: { ...inputs.manualOverheadMs } };
}

/** Clamp to [min, max]; non-finite values fall back to `fallback`. */
export function sanitizeNumber(value: unknown, range: Range, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, n));
}

/** Return a copy of `inputs` with every field finite and within range. */
export function sanitizeInputs(inputs: Partial<CalculatorInputs> | undefined | null): CalculatorInputs {
  const d = DEFAULT_INPUTS;
  const src = inputs ?? {};
  const manualSrc: Partial<Record<FgMultiplier, unknown>> = src.manualOverheadMs ?? {};
  const manual = {} as ManualOverhead;
  for (const m of FG_MULTIPLIERS) {
    const v = manualSrc[m];
    manual[m] = v === null ? null : sanitizeNumber(v, RANGES.manualOverheadMs, d.manualOverheadMs[m] ?? 0);
  }
  return {
    baseFPS: sanitizeNumber(src.baseFPS, RANGES.baseFPS, d.baseFPS),
    sharedOverheadMs: sanitizeNumber(src.sharedOverheadMs, RANGES.sharedOverheadMs, d.sharedOverheadMs),
    perGeneratedFrameMs: sanitizeNumber(src.perGeneratedFrameMs, RANGES.perGeneratedFrameMs, d.perGeneratedFrameMs),
    mode: src.mode === 'manual' ? 'manual' : 'calculated',
    manualOverheadMs: manual,
  };
}

/**
 * Effective FG overhead (ms) for a multiplier under the configured mode.
 * Returns null when manual mode has no value for that multiplier.
 */
export function fgOverheadMs(inputs: CalculatorInputs, multiplier: Multiplier): number | null {
  if (multiplier === 1) return 0;
  if (inputs.mode === 'manual') return inputs.manualOverheadMs[multiplier];
  return calculatedOverheadMs(inputs.sharedOverheadMs, inputs.perGeneratedFrameMs, multiplier);
}

/**
 * Compute one result row. Inputs are sanitized first, so output is always finite.
 * Returns null when there is no overhead value for this multiplier (manual mode).
 */
export function computeRow(rawInputs: Partial<CalculatorInputs>, multiplier: Multiplier): ResultRow | null {
  const inputs = sanitizeInputs(rawInputs);
  const { baseFPS } = inputs;
  const originalFrameTimeMs = 1000 / baseFPS;
  const overhead = fgOverheadMs(inputs, multiplier);
  if (overhead === null) return null;
  const actualFrameTimeMs = originalFrameTimeMs + overhead;
  // At M = 1 return baseFPS exactly rather than 1000 / (1000 / baseFPS).
  const realFPS = multiplier === 1 ? baseFPS : 1000 / actualFrameTimeMs;
  const displayedFPS = realFPS * multiplier;
  const idealFPS = baseFPS * multiplier;
  return {
    multiplier,
    originalFrameTimeMs,
    fgOverheadMs: overhead,
    actualFrameTimeMs,
    realFPS,
    displayedFPS,
    idealFPS,
    fpsGainPercent: (displayedFPS / baseFPS - 1) * 100,
    realFPSPenaltyPercent: (1 - realFPS / baseFPS) * 100,
  };
}

export function computeAll(inputs: Partial<CalculatorInputs>): (ResultRow | null)[] {
  return MULTIPLIERS.map((m) => computeRow(inputs, m));
}

/**
 * Effective overhead (ms) implied by a measured displayed FPS at multiplier M:
 * overhead = M × 1000 / displayedFPS − 1000 / baseFPS.
 * Returns NaN for a non-positive or non-finite displayed FPS.
 */
export function overheadFromDisplayedFPS(baseFPS: number, multiplier: number, displayedFPS: number): number {
  if (!(displayedFPS > 0) || !Number.isFinite(displayedFPS) || !(baseFPS > 0)) return NaN;
  return (multiplier * 1000) / displayedFPS - 1000 / baseFPS;
}

/** Displayed FPS at multiplier M for a given overhead (inverse of overheadFromDisplayedFPS). */
export function displayedFPSFromOverhead(baseFPS: number, multiplier: number, overheadMs: number): number {
  return (multiplier * 1000) / (1000 / baseFPS + overheadMs);
}
