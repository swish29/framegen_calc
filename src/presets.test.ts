import { describe, expect, it } from 'vitest';
import { FG_MULTIPLIERS, RANGES, computeAll, sanitizeInputs, DEFAULT_INPUTS, cloneInputs } from './model';
import {
  PRESETS,
  SOURCES,
  TECHS,
  findPreset,
  hardwareFor,
  presetsFor,
  resolutionRank,
  scenarioLabel,
  sourceOf,
  techsWithPresets,
  vendorRank,
} from './presets';
import { checkFit, fitLinear } from './fit';
import { buildUrl, parseInputs, parsePresetId } from './url';

describe('presets', () => {
  it('have unique ids, known sources and at least one value', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(sourceOf(p)).toBeDefined();
      expect(FG_MULTIPLIERS.some((m) => p.overheadMs[m] !== null)).toBe(true);
    }
    for (const s of SOURCES) expect(PRESETS.some((p) => p.sourceId === s.id)).toBe(true);
  });

  it('stay within the manual overhead range, so sanitizing does not change them', () => {
    for (const p of PRESETS) {
      for (const m of FG_MULTIPLIERS) {
        const v = p.overheadMs[m];
        if (v !== null) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThanOrEqual(RANGES.manualOverheadMs.max);
        }
      }
      expect(sanitizeInputs({ mode: 'manual', manualOverheadMs: p.overheadMs }).manualOverheadMs).toEqual(p.overheadMs);
    }
  });

  it('keep source values and conversions', () => {
    const get = (id: string) => PRESETS.find((p) => p.id === id)!.overheadMs;
    expect(get('nv-5080-4k')).toEqual({ 2: 2.84, 3: null, 4: 5.25, 5: null });
    expect(get('sm86-t1-4k')).toEqual({ 2: 1.901, 3: 3.002, 4: 4.106, 5: 5.212 });
    // Per generated frame × 3 generated frames at ×4.
    expect(get('sm86-3080ti-cp-4k')[4]).toBeCloseTo(4.701, 9);
    expect(get('apex-anr-5090-4k')[4]).toBeCloseTo(1.83, 9);
    expect(get('fsr31-6800xt-1440p-quality')).toEqual({ 2: 1.3, 3: null, 4: null, 5: null });
    expect(get('fsr31-5700xt-4k-nativeaa')[2]).toBe(7.3);
    // Effective overhead from PCGH's Arc A770 Cyberpunk 2077 FPS: 56.4 off, 96.2 / 122.0 / 163.6 at ×2 / ×3 / ×4.
    const a770 = get('pcgh-a770-cp');
    expect(a770[2]).toBeCloseTo(3.06, 2);
    expect(a770[4]).toBeCloseTo(6.72, 2);
    expect(a770[5]).toBeNull();
    expect(get('toms-avatar-3080-1440p')[2]).toBeCloseTo(3.31, 2);
    expect(get('wccftech-890m-cp')[2]).toBeCloseTo(4.82, 2);
  });

  it('are recognised again after a shared-link round trip', () => {
    for (const p of PRESETS) {
      const cfg = { ...cloneInputs(DEFAULT_INPUTS), mode: 'manual' as const, manualOverheadMs: { ...p.overheadMs } };
      const url = buildUrl(cfg, { origin: 'https://x', pathname: '/' }, p.id);
      const search = new URL(url).search;
      expect(findPreset(parseInputs(search).manualOverheadMs, parsePresetId(search))?.id).toBe(p.id);
    }
    expect(findPreset({ 2: 1, 3: 2, 4: 3, 5: 4 })).toBeUndefined();
    // A preset id that no longer matches the values is ignored.
    expect(findPreset({ 2: 1, 3: 2, 4: 3, 5: 4 }, 'nv-5080-4k')).toBeUndefined();
  });

  it('with a measured base FPS reproduce the source FPS', () => {
    for (const p of PRESETS.filter((x) => x.baseFPS !== undefined)) {
      expect(p.baseFPS).toBeGreaterThanOrEqual(RANGES.baseFPS.min);
      expect(p.baseFPS).toBeLessThanOrEqual(RANGES.baseFPS.max);
    }
    const p = PRESETS.find((x) => x.id === 'pcgh-a770-hl')!;
    const rows = computeAll({ baseFPS: p.baseFPS, mode: 'manual', manualOverheadMs: p.overheadMs });
    expect(rows.slice(1, 4).map((r) => r!.displayedFPS.toFixed(1))).toEqual(['71.2', '99.4', '124.2']);
  });

  it('produce no row for multipliers without data', () => {
    const p = PRESETS.find((x) => x.id === 'amd-9070xt-4k')!;
    const rows = computeAll({ baseFPS: 60, mode: 'manual', manualOverheadMs: p.overheadMs });
    expect(rows.map((r) => r !== null)).toEqual([true, true, false, false, false]);
    expect(rows[1]!.realFPS).toBeCloseTo(1000 / (1000 / 60 + 2.2), 12);
  });
});

describe('preset menus', () => {
  it('give every preset a known technology, hardware and resolution', () => {
    for (const p of PRESETS) {
      expect(TECHS.some((t) => t.id === p.tech), p.id).toBe(true);
      expect(p.hardware.length, p.id).toBeGreaterThan(0);
      expect(resolutionRank(p.resolution), `${p.id} ${p.resolution}`).toBeLessThan(10000);
    }
  });

  it('let an official preset take precedence over an unofficial one for the same case', () => {
    const key = (p: (typeof PRESETS)[number]) => [p.tech, p.hardware, p.game ?? '', p.resolution, p.settings ?? ''].join('|');
    const official = new Set(PRESETS.filter((p) => sourceOf(p).official).map(key));
    for (const p of PRESETS.filter((x) => !sourceOf(x).official)) expect(official.has(key(p)), p.id).toBe(false);
    // Unique per case overall.
    expect(new Set(PRESETS.map(key)).size).toBe(PRESETS.length);
  });

  it('list technologies in a fixed order and hardware naturally', () => {
    expect(techsWithPresets()[0]!.id).toBe('dlss');
    const dlss = hardwareFor('dlss');
    expect(dlss.indexOf('RTX 3070')).toBeLessThan(dlss.indexOf('RTX 3080 Ti'));
    expect(dlss.indexOf('RTX 4090')).toBeLessThan(dlss.indexOf('RTX 5080'));
    const fsr = hardwareFor('fsr3');
    const ranks = fsr.map(vendorRank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(fsr.indexOf('RTX 2070')).toBeLessThan(fsr.indexOf('RTX 4090'));
    expect(fsr.indexOf('Radeon 890M')).toBeLessThan(fsr.indexOf('RX 5700 XT'));
    expect(fsr.at(-1)).toBe('Arc A770');
    // Reference and synthetic data come before games.
    expect(presetsFor('dlss', 'RTX 3080 Ti')[0]!.game).toBeUndefined();
  });

  it('order scenarios by game, then resolution, then settings', () => {
    const list = presetsFor('dlss', 'RTX 5080');
    // Reference data (no game) first, by resolution; then games.
    expect(list.slice(0, 3).map((p) => p.resolution)).toEqual(['1080p', '1440p', '4K']);
    expect(list.slice(0, 3).every((p) => p.game === undefined)).toBe(true);
    expect(list.slice(3).every((p) => p.game !== undefined)).toBe(true);
    const fsr = presetsFor('fsr3', 'RX 6800 XT');
    expect(fsr.slice(0, 3).map((p) => p.settings)).toEqual(['FSR 3.1, Native AA', 'FSR 3.1, Quality', 'FSR 3.1, Performance']);
  });

  it('mark unofficial scenarios in their label', () => {
    for (const p of PRESETS) expect(scenarioLabel(p).endsWith('unofficial')).toBe(!sourceOf(p).official);
    expect(scenarioLabel(PRESETS.find((p) => p.id === 'nv-5080-4k')!)).toBe('NVIDIA reference, 4K');
  });
});

describe('fitLinear', () => {
  it('recovers exact linear data', () => {
    const f = fitLinear({ 2: 1.5, 3: 2.3, 4: 3.1, 5: 3.9 })!;
    expect(f.sharedMs).toBeCloseTo(0.7, 12);
    expect(f.perGeneratedFrameMs).toBeCloseTo(0.8, 12);
    expect(f.maxErrorMs).toBeCloseTo(0, 12);
    expect(f.points).toBe(4);
  });

  it('fits the SM86 RTX 3080 Ti 4K tier 1 data to about 0.80 + (M − 1) × 1.10 ms', () => {
    const f = fitLinear({ 2: 1.901, 3: 3.002, 4: 4.106, 5: 5.212 })!;
    expect(f.sharedMs).toBeCloseTo(0.796, 3);
    expect(f.perGeneratedFrameMs).toBeCloseTo(1.104, 3);
    expect(f.maxErrorMs).toBeLessThan(0.005);
  });

  it('solves two points exactly', () => {
    const f = fitLinear({ 2: 2.84, 3: null, 4: 5.25, 5: null })!;
    expect(f.perGeneratedFrameMs).toBeCloseTo((5.25 - 2.84) / 2, 12);
    expect(f.sharedMs).toBeCloseTo(2.84 - (5.25 - 2.84) / 2, 12);
    expect(f.points).toBe(2);
  });

  it('needs two values for a least-squares fit', () => {
    expect(fitLinear({ 2: 2.2, 3: null, 4: null, 5: null })).toBeNull();
  });

  it('fits the values from a displayed-FPS entry', () => {
    // 55 FPS base; 75 / 98 / 115 / 130 FPS displayed at ×2..×5.
    const ms = (m: number, fps: number) => (m * 1000) / fps - 1000 / 55;
    const c = checkFit({ 2: ms(2, 75), 3: ms(3, 98), 4: ms(4, 115), 5: ms(5, 130) });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.fit.sharedMs).toBeCloseTo(4.5, 0);
    expect(c.fit.perGeneratedFrameMs).toBeCloseTo(3.9, 0);
    expect(c.warning).toBeUndefined();
  });
});

describe('checkFit', () => {
  it('rejects no values', () => {
    const c = checkFit({ 2: null, 3: null, 4: null, 5: null });
    expect(c.ok).toBe(false);
    expect(!c.ok && c.error).toMatch(/at least one/);
  });

  it('assumes the worst case, no shared work, when only ×2 has a value', () => {
    const c = checkFit({ 2: 2.2, 3: null, 4: null, 5: null });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.fit.sharedMs).toBe(0);
    expect(c.fit.perGeneratedFrameMs).toBe(2.2);
    expect(c.assumption).toMatch(/worst case/);
  });

  it('scales a single value at another multiplier to a per-frame cost', () => {
    const c = checkFit({ 2: null, 3: null, 4: 6, 5: null });
    expect(c.ok && c.fit.perGeneratedFrameMs).toBe(2);
    expect(c.ok && c.fit.sharedMs).toBe(0);
  });

  it('rejects a single value whose per-frame cost exceeds the slider', () => {
    expect(checkFit({ 2: 7.3, 3: null, 4: null, 5: null }).ok).toBe(false);
  });

  it('rejects overhead that falls with the multiplier (negative per-frame cost)', () => {
    const c = checkFit({ 2: 3, 3: null, 4: 2, 5: null });
    expect(c.ok).toBe(false);
    expect(!c.ok && c.error).toMatch(/negative cost per generated frame/);
  });

  it('rejects growth that needs a negative shared cost', () => {
    const c = checkFit({ 2: 1, 3: null, 4: 5, 5: null });
    expect(c.ok).toBe(false);
    expect(!c.ok && c.error).toMatch(/shared cost would be negative/);
  });

  it('rejects fits outside the slider ranges', () => {
    const c = checkFit({ 2: 20, 3: 26, 4: 32, 5: null });
    expect(c.ok).toBe(false);
    expect(!c.ok && c.error).toMatch(/model's limits/);
  });

  it('warns when the values are far from a straight line', () => {
    const c = checkFit({ 2: 2, 3: 2.2, 4: 5, 5: 5.2 });
    expect(c.ok).toBe(true);
    expect(c.ok && c.warning).toMatch(/straight line/);
  });

  it('does not warn about rounding in published data', () => {
    const c = checkFit({ 2: 1.901, 3: 3.002, 4: 4.106, 5: 5.212 });
    expect(c.ok && c.warning).toBeUndefined();
  });

  it('accepts every direct GPU timing whose per-frame cost fits the sliders', () => {
    for (const p of PRESETS.filter((x) => sourceOf(x).kind === 'gpu-time')) {
      const c = checkFit(p.overheadMs);
      if (!c.ok && /model's limit/.test(c.error)) continue;
      expect(c.ok, p.id).toBe(true);
    }
  });

  it('returns a fit or a reason for every preset', () => {
    for (const p of PRESETS) {
      const c = checkFit(p.overheadMs);
      expect(c.ok || c.error.length > 0, p.id).toBe(true);
    }
  });
});
