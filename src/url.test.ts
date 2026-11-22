import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUTS, cloneInputs, type CalculatorInputs } from './model';
import { buildUrl, parseInputs, serializeInputs } from './url';
import { formatFps, formatMs, formatPercent, formatSignedPercent, multiplierLabel } from './format';

describe('URL serialization', () => {
  it('defaults serialize to an empty query', () => {
    expect(serializeInputs(cloneInputs(DEFAULT_INPUTS)).toString()).toBe('');
    expect(parseInputs('')).toEqual(cloneInputs(DEFAULT_INPUTS));
  });

  it('round-trips calculated configuration', () => {
    const cfg: CalculatorInputs = { ...cloneInputs(DEFAULT_INPUTS), baseFPS: 144, sharedOverheadMs: 1.3, perGeneratedFrameMs: 0.4 };
    const q = serializeInputs(cfg).toString();
    expect(q).toBe('fps=144&shared=1.3&per=0.4');
    expect(parseInputs(q)).toEqual(cfg);
  });

  it('round-trips manual configuration', () => {
    const cfg: CalculatorInputs = {
      ...cloneInputs(DEFAULT_INPUTS),
      baseFPS: 60,
      mode: 'manual',
      manualOverheadMs: { 2: 1.25, 3: 2, 4: 2.75, 5: 7.5 },
    };
    const q = serializeInputs(cfg).toString();
    expect(q).toBe('fps=60&mode=manual&m2=1.25&m3=2&m4=2.75&m5=7.5');
    expect(parseInputs(q)).toEqual(cfg);
    expect(parseInputs(new URLSearchParams(q))).toEqual(cfg);
  });

  it('round-trips manual values with missing multipliers', () => {
    const cfg: CalculatorInputs = {
      ...cloneInputs(DEFAULT_INPUTS),
      mode: 'manual',
      manualOverheadMs: { 2: 1.07, 3: null, 4: 1.78, 5: null },
    };
    const q = serializeInputs(cfg).toString();
    expect(q).toBe('mode=manual&m2=1.07&m3=none&m4=1.78&m5=none');
    expect(parseInputs(q)).toEqual(cfg);
  });

  it('does not emit manual values in calculated mode', () => {
    const cfg = { ...cloneInputs(DEFAULT_INPUTS), manualOverheadMs: { 2: 9, 3: 9, 4: 9, 5: 9 } };
    expect(serializeInputs(cfg).has('m2')).toBe(false);
  });

  it('sanitizes invalid values', () => {
    const p = parseInputs('?fps=abc&shared=-4&per=99&mode=weird&m2=NaN&m3=Infinity');
    expect(p.baseFPS).toBe(DEFAULT_INPUTS.baseFPS);
    expect(p.sharedOverheadMs).toBe(0);
    expect(p.perGeneratedFrameMs).toBe(5);
    expect(p.mode).toBe('calculated');
    expect(p.manualOverheadMs[2]).toBe(DEFAULT_INPUTS.manualOverheadMs[2]);
    expect(p.manualOverheadMs[3]).toBe(DEFAULT_INPUTS.manualOverheadMs[3]);
    expect(parseInputs('?fps=5000').baseFPS).toBe(240);
    expect(parseInputs('?fps=').baseFPS).toBe(DEFAULT_INPUTS.baseFPS);
  });

  it('builds a URL under a repository subpath', () => {
    const cfg = { ...cloneInputs(DEFAULT_INPUTS), baseFPS: 90 };
    const base = { origin: 'https://user.github.io', pathname: '/framegen-calc/' };
    expect(buildUrl(cfg, base)).toBe('https://user.github.io/framegen-calc/?fps=90');
    expect(buildUrl(cloneInputs(DEFAULT_INPUTS), base)).toBe('https://user.github.io/framegen-calc/');
  });
});

describe('formatting', () => {
  it('formats numbers for display', () => {
    expect(formatFps(203.38983)).toBe('203.4');
    expect(formatMs(1.5)).toBe('1.50 ms');
    expect(formatSignedPercent(69.49)).toBe('+69.5 %');
    expect(formatSignedPercent(-12)).toBe('−12.0 %');
    expect(formatSignedPercent(0)).toBe('0.0 %');
    expect(formatSignedPercent(-0.01)).toBe('0.0 %');
    expect(formatPercent(15.25)).toBe('15.3 %');
    expect(formatFps(NaN)).toBe('—');
    expect(multiplierLabel(1)).toBe('FG Off');
    expect(multiplierLabel(3)).toBe('×3');
  });
});
