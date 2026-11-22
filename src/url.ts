import {
  DEFAULT_INPUTS,
  FG_MULTIPLIERS,
  sanitizeInputs,
  type CalculatorInputs,
  type ManualOverhead,
} from './model';

/**
 * Query parameter names:
 *   fps     base FPS
 *   shared  shared FG overhead (ms)
 *   per     cost per generated frame (ms)
 *   mode    "manual" for manual overhead (omitted = calculated)
 *   m2..m5  manual overhead per multiplier (ms), only with mode=manual;
 *           "none" means no value for that multiplier
 *   preset  id of the chosen measured preset (manual mode only; informational)
 */

const NONE = 'none';

/** Short, stable decimal representation (up to 3 decimals, no trailing zeros). */
function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** Serialize inputs; values equal to the defaults are omitted. */
export function serializeInputs(raw: CalculatorInputs): URLSearchParams {
  const inputs = sanitizeInputs(raw);
  const d = DEFAULT_INPUTS;
  const p = new URLSearchParams();
  if (fmt(inputs.baseFPS) !== fmt(d.baseFPS)) p.set('fps', fmt(inputs.baseFPS));
  if (fmt(inputs.sharedOverheadMs) !== fmt(d.sharedOverheadMs)) p.set('shared', fmt(inputs.sharedOverheadMs));
  if (fmt(inputs.perGeneratedFrameMs) !== fmt(d.perGeneratedFrameMs)) p.set('per', fmt(inputs.perGeneratedFrameMs));
  if (inputs.mode === 'manual') {
    p.set('mode', 'manual');
    for (const m of FG_MULTIPLIERS) {
      const v = inputs.manualOverheadMs[m];
      p.set(`m${m}`, v === null ? NONE : fmt(v));
    }
  }
  return p;
}

/** Parse query parameters into sanitized inputs. Missing/invalid values fall back to defaults. */
export function parseInputs(search: string | URLSearchParams): CalculatorInputs {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const num = (key: string): number | undefined => {
    const v = p.get(key);
    if (v === null || v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const manual: Partial<ManualOverhead> = {};
  for (const m of FG_MULTIPLIERS) {
    if (p.get(`m${m}`) === NONE) {
      manual[m] = null;
      continue;
    }
    const v = num(`m${m}`);
    if (v !== undefined) manual[m] = v;
  }
  return sanitizeInputs({
    baseFPS: num('fps'),
    sharedOverheadMs: num('shared'),
    perGeneratedFrameMs: num('per'),
    mode: p.get('mode') === 'manual' ? 'manual' : 'calculated',
    manualOverheadMs: manual as ManualOverhead,
  });
}

/**
 * Build a URL string for the given inputs relative to `base` (path + query, no hash).
 * `presetId` is added as `preset=` in manual mode, so a link names the preset even when
 * several presets share the same values.
 */
export function buildUrl(
  inputs: CalculatorInputs,
  base: { origin: string; pathname: string },
  presetId?: string | null,
): string {
  const p = serializeInputs(inputs);
  if (presetId && inputs.mode === 'manual') p.set('preset', presetId);
  const q = p.toString();
  return `${base.origin}${base.pathname}${q ? `?${q}` : ''}`;
}

/** The `preset` query parameter, if present. */
export function parsePresetId(search: string | URLSearchParams): string | null {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  return p.get('preset');
}
