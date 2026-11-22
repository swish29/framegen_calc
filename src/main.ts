import './style.css';
import { FpsChart, SERIES } from './chart';
import { formatFps, formatMs, formatPercent, formatSignedPercent, multiplierLabel } from './format';
import {
  DEFAULT_INPUTS,
  FG_MULTIPLIERS,
  RANGES,
  calculatedOverheadMs,
  cloneInputs,
  computeAll,
  displayedFPSFromOverhead,
  overheadFromDisplayedFPS,
  sanitizeInputs,
  type CalculatorInputs,
  type FgMultiplier,
  type ResultRow,
} from './model';
import { checkFit } from './fit';
import {
  KIND_NOTE,
  PRESETS,
  findPreset,
  hardwareFor,
  presetsFor,
  scenarioLabel,
  sourceOf,
  techsWithPresets,
  type Preset,
  type TechId,
} from './presets';
import { buildUrl, parseInputs, parsePresetId } from './url';

type ScalarKey = 'baseFPS' | 'sharedOverheadMs' | 'perGeneratedFrameMs';
const SCALAR_KEYS: ScalarKey[] = ['baseFPS', 'sharedOverheadMs', 'perGeneratedFrameMs'];

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
};

/** Create an element with an optional class and text. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Trim floating-point noise for display in input fields (e.g. 2.3000000000000003 → 2.3). */
const fieldValue = (n: number): string => String(Math.round(n * 1000) / 1000);

let state: CalculatorInputs = parseInputs(location.search);
/** Last chosen preset; tells apart presets that share the same values. */
let chosenPresetId: string | null = parsePresetId(location.search);
/** Preset matching the current manual values, set by render(). */
let currentPresetId: string | null = null;

const chart = new FpsChart($<HTMLCanvasElement>('#chart'));
const tbody = $<HTMLTableSectionElement>('#results-body');
const statusEl = $<HTMLSpanElement>('#status');
const manualInputs = FG_MULTIPLIERS.map((m) => $<HTMLInputElement>(`#manual input[data-m="${m}"]`));
const unitRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="manual-unit"]')];
const sourceRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="source"]')];
const convSpans = FG_MULTIPLIERS.map((m) => $<HTMLSpanElement>(`#manual [data-conv="${m}"]`));

/**
 * Unit used to enter your own values. State always stores overhead in ms; in FPS mode each field
 * shows the displayed FPS that overhead produces at the current base FPS, and typed FPS values
 * are converted to ms with overheadFromDisplayedFPS().
 */
type ManualUnit = 'ms' | 'fps';
let manualUnit: ManualUnit = 'ms';
const fpsFieldValue = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * Where the frame generation cost comes from. 'model' uses the shared + per-frame sliders
 * (state.mode 'calculated'); 'measured' and 'mine' both use per-multiplier values
 * (state.mode 'manual'), from a preset or typed in.
 */
type Source = 'measured' | 'model' | 'mine';

let source: Source =
  state.mode === 'calculated' ? 'model' : findPreset(state.manualOverheadMs, chosenPresetId) ? 'measured' : 'mine';

// ---------- Controls ----------

const controls = SCALAR_KEYS.map((key) => {
  const range = RANGES[key];
  const num = $<HTMLInputElement>(`#in-${key}`);
  const slider = $<HTMLInputElement>(`#range-${key}`);
  for (const el of [num, slider]) {
    el.min = String(range.min);
    el.max = String(range.max);
    el.step = String(range.step);
  }
  // Number fields accept any precision (e.g. 144 FPS, 0.75 ms); arrows still move by `step`.
  num.addEventListener('input', () => {
    const v = num.valueAsNumber;
    if (Number.isFinite(v)) setState({ [key]: v }, { skip: num });
  });
  num.addEventListener('change', () => syncFields());
  num.addEventListener('blur', () => syncFields());
  slider.addEventListener('input', () => setState({ [key]: slider.valueAsNumber }));
  return { key, num, slider };
});
const baseMeta = $<HTMLParagraphElement>('#meta-baseFPS');

manualInputs.forEach((input, i) => {
  const m = FG_MULTIPLIERS[i]!;
  input.addEventListener('input', () => {
    // An empty field means "no value" for this multiplier. Invalid partial input (e.g. "1e") is ignored.
    if (input.value === '' && input.validity.valid) {
      setState({ manualOverheadMs: { ...state.manualOverheadMs, [m]: null } }, { skip: input });
      return;
    }
    const v = input.valueAsNumber;
    const ms = manualUnit === 'fps' ? overheadFromDisplayedFPS(state.baseFPS, m, v) : v;
    if (Number.isFinite(ms)) setState({ manualOverheadMs: { ...state.manualOverheadMs, [m]: ms } }, { skip: input });
  });
  input.addEventListener('change', () => syncFields());
  input.addEventListener('blur', () => syncFields());
});

unitRadios.forEach((r) =>
  r.addEventListener('change', () => {
    if (!r.checked) return;
    manualUnit = r.value === 'fps' ? 'fps' : 'ms';
    render();
  }),
);

sourceRadios.forEach((r) =>
  r.addEventListener('change', () => {
    if (!r.checked) return;
    source = r.value as Source;
    // Switching to Measured data or Your numbers keeps the current results: Measured data
    // starts with no preset chosen, and Your numbers starts from the overhead in use now.
    if (source === 'model') setState({ mode: 'calculated' });
    else if (source === 'mine') setState({ mode: 'manual', manualOverheadMs: currentOverheads() });
    else render();
  }),
);

$('#fill-manual').addEventListener('click', () => {
  const manual = { ...state.manualOverheadMs };
  for (const m of FG_MULTIPLIERS) manual[m] = calculatedOverheadMs(state.sharedOverheadMs, state.perGeneratedFrameMs, m);
  setState({ manualOverheadMs: manual });
});

$('#reset').addEventListener('click', () => {
  state = cloneInputs(DEFAULT_INPUTS);
  source = 'model';
  render();
  writeUrl();
  announce('Defaults restored');
});

$('#copy-link').addEventListener('click', async () => {
  writeUrl();
  const url = buildUrl(state, location, currentPresetId);
  try {
    await navigator.clipboard.writeText(url);
    announce('Link copied');
  } catch {
    // Clipboard API unavailable (e.g. insecure context): fall back to a prompt the user can copy from.
    window.prompt('Copy this link:', url);
  }
});

/** The overhead in use for each multiplier, from the model or the per-multiplier values. */
function currentOverheads(): CalculatorInputs['manualOverheadMs'] {
  const rows = computeAll(state);
  const out = { ...state.manualOverheadMs };
  for (const m of FG_MULTIPLIERS) out[m] = rows[m - 1]?.fgOverheadMs ?? null;
  return out;
}

// ---------- Measured data ----------

const techSelect = $<HTMLSelectElement>('#preset-tech');
const hwSelect = $<HTMLSelectElement>('#preset-hw');
const scnSelect = $<HTMLSelectElement>('#preset-scn');
const noTech = new Option('Choose a technology', '');
noTech.disabled = true;
techSelect.append(noTech);
for (const t of techsWithPresets()) {
  const count = PRESETS.filter((p) => p.tech === t.id).length;
  techSelect.append(new Option(`${t.name}, ${count} sets`, t.id));
}

/** The first preset to show for a technology: its first official one if it has any. */
const firstPreset = (tech: TechId): Preset => {
  const all = hardwareFor(tech).flatMap((hw) => presetsFor(tech, hw));
  return all.find((p) => sourceOf(p).official) ?? all[0]!;
};

function applyPreset(preset: Preset | undefined): void {
  if (!preset) return;
  chosenPresetId = preset.id;
  source = 'measured';
  setState({
    mode: 'manual',
    manualOverheadMs: { ...preset.overheadMs },
    ...(preset.baseFPS !== undefined ? { baseFPS: preset.baseFPS } : {}),
  });
}

techSelect.addEventListener('change', () => applyPreset(firstPreset(techSelect.value as TechId)));
hwSelect.addEventListener('change', () => applyPreset(presetsFor(techSelect.value as TechId, hwSelect.value)[0]));
scnSelect.addEventListener('change', () => applyPreset(PRESETS.find((p) => p.id === scnSelect.value)));

function renderMeasured(preset: Preset | undefined): void {
  const line = $<HTMLParagraphElement>('#source-line');
  const details = $<HTMLDetailsElement>('#source-details');
  hwSelect.replaceChildren();
  scnSelect.replaceChildren();
  hwSelect.disabled = scnSelect.disabled = !preset;
  if (!preset) {
    techSelect.value = '';
    hwSelect.append(new Option('Choose a technology first', ''));
    scnSelect.append(new Option('Choose a technology first', ''));
    line.textContent = 'Choose a technology to load measured data. The results stay as they are until you do.';
    details.hidden = true;
    return;
  }
  techSelect.value = preset.tech;
  for (const hw of hardwareFor(preset.tech)) hwSelect.append(new Option(hw, hw));
  hwSelect.value = preset.hardware;
  for (const p of presetsFor(preset.tech, preset.hardware)) scnSelect.append(new Option(scenarioLabel(p), p.id));
  scnSelect.value = preset.id;

  const src = sourceOf(preset);
  const kind = src.kind === 'gpu-time' ? 'direct GPU timing' : 'worked out from FPS with frame generation off and on';
  const base = preset.baseFPS !== undefined ? ` Base FPS is set to the measured ${fieldValue(preset.baseFPS)} FPS.` : '';
  line.textContent = `From ${src.name}. ${src.official ? 'Official' : 'Unofficial'} data, ${kind}.${base}`;
  const link = el('a', undefined, 'Open the source');
  link.href = preset.url ?? src.url;
  link.target = '_blank';
  link.rel = 'noopener';
  $<HTMLParagraphElement>('#source-note').replaceChildren(`${src.note} ${KIND_NOTE[src.kind]} `, link);
  details.hidden = false;
}

// ---------- Legend ----------

const legend = $<HTMLDivElement>('#legend');
SERIES.forEach((s, i) => {
  const btn = el('button', `legend-item ${s.key}`);
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'true');
  const swatch = el('span', 'swatch');
  swatch.setAttribute('aria-hidden', 'true');
  btn.append(swatch, s.label);
  btn.addEventListener('click', () => {
    const visible = !chart.isVisible(i);
    chart.setVisible(i, visible);
    btn.setAttribute('aria-pressed', String(visible));
  });
  legend.append(btn);
});

// ---------- State & rendering ----------

function setState(patch: Partial<CalculatorInputs>, opts: { skip?: HTMLInputElement } = {}): void {
  state = sanitizeInputs({ ...state, ...patch });
  render(opts.skip);
  scheduleUrlWrite();
}

/** Write sanitized state into all fields, except the one the user is currently typing in. */
function syncFields(skip?: HTMLInputElement): void {
  for (const c of controls) {
    const v = state[c.key];
    if (c.num !== skip) c.num.value = fieldValue(v);
    c.slider.value = String(v);
  }
  const range = RANGES.manualOverheadMs;
  manualInputs.forEach((input, i) => {
    const m = FG_MULTIPLIERS[i]!;
    const ms = state.manualOverheadMs[m];
    const fps = ms === null ? null : displayedFPSFromOverhead(state.baseFPS, m, ms);
    input.placeholder = 'none';
    if (manualUnit === 'fps') {
      // Valid FPS range: from the overhead limit (lowest FPS) up to ideal scaling (zero overhead).
      input.min = fpsFieldValue(displayedFPSFromOverhead(state.baseFPS, m, range.max));
      input.max = fpsFieldValue(state.baseFPS * m);
      input.step = '0.1';
      if (input !== skip) input.value = fps === null ? '' : fpsFieldValue(fps);
      convSpans[i]!.textContent = ms === null ? '' : `${formatMs(ms)} overhead`;
    } else {
      input.min = String(range.min);
      input.max = String(range.max);
      input.step = String(range.step);
      if (input !== skip) input.value = ms === null ? '' : fieldValue(ms);
      convSpans[i]!.textContent = fps === null ? '' : `${formatFps(fps)} FPS shown`;
    }
    input.setAttribute('aria-label', `×${m} ${manualUnit === 'fps' ? 'displayed FPS' : 'overhead in ms'}`);
    input.nextElementSibling!.textContent = manualUnit === 'fps' ? 'FPS' : 'ms';
  });
  for (const r of unitRadios) r.checked = r.value === manualUnit;
  $<HTMLParagraphElement>('#unit-hint').textContent =
    manualUnit === 'fps'
      ? 'Enter the displayed FPS you measured at each multiplier. Set base FPS to your measurement with frame generation off first. Leave a field empty if you have no value.'
      : 'Enter the time frame generation adds to each rendered frame. Leave a field empty if you have no value.';
}

function render(skip?: HTMLInputElement): void {
  syncFields(skip);
  const rows = computeAll(state);
  const manual = state.mode === 'manual';
  const preset = manual ? findPreset(state.manualOverheadMs, chosenPresetId) : undefined;
  currentPresetId = source === 'measured' ? (preset?.id ?? null) : null;
  // Model always means the sliders; Your numbers always means per-multiplier values.
  // Measured data may show "no preset" over either until a technology is chosen.
  if (source === 'model' && manual) source = preset ? 'measured' : 'mine';
  else if (source === 'mine' && !manual) source = 'model';

  for (const r of sourceRadios) r.checked = r.value === source;
  for (const id of ['measured', 'model', 'mine'] as const) $(`#panel-${id}`).hidden = source !== id;
  baseMeta.textContent = `${formatMs(1000 / state.baseFPS)} per frame with frame generation off.`;
  if (source === 'measured') renderMeasured(preset);

  frameScaleMs = Math.max(...rows.filter((x): x is ResultRow => x !== null).map((x) => x.actualFrameTimeMs));
  tbody.replaceChildren(...rows.map((r, idx) => (r ? resultRow(r) : missingRow(FG_MULTIPLIERS[idx - 1]!))));
  renderFit();
  chart.update(rows, state.baseFPS);
}

function resultRow(r: ResultRow): HTMLTableRowElement {
  const signClass = (v: number, good: boolean) => (Math.abs(v) <= 0.05 ? undefined : v > 0 === good ? 'pos' : 'neg');
  const head = el('th', 'l', multiplierLabel(r.multiplier));
  head.scope = 'row';
  const tr = el('tr');
  tr.append(
    head,
    frameCell(r),
    el('td', undefined, formatFps(r.idealFPS)),
    el('td', 'hl', formatFps(r.displayedFPS)),
    el('td', undefined, formatFps(r.realFPS)),
    el('td', undefined, formatMs(r.fgOverheadMs)),
    el('td', r.realFPSPenaltyPercent > 0.05 ? 'neg' : undefined, formatPercent(r.realFPSPenaltyPercent)),
    el('td', signClass(r.fpsGainPercent, true), formatSignedPercent(r.fpsGainPercent)),
  );
  return tr;
}

/** Table row for a multiplier without an overhead value: ideal FPS only. */
function missingRow(m: FgMultiplier): HTMLTableRowElement {
  const head = el('th', 'l', multiplierLabel(m));
  head.scope = 'row';
  const rest = el('td', 'missing', `No overhead value for ×${m}`);
  rest.colSpan = 5;
  const tr = el('tr');
  tr.append(head, el('td'), el('td', undefined, formatFps(state.baseFPS * m)), rest);
  return tr;
}

/** Longest real frame time among the rows, the common scale for the frame bars. */
let frameScaleMs = 1;

/**
 * One rendered frame drawn to scale: game render time, then frame generation time, with a
 * mark where each displayed frame starts. All rows share one scale, so the bars grow with M.
 */
function frameCell(r: ResultRow): HTMLTableCellElement {
  const pct = (ms: number) => `${(ms / frameScaleMs) * 100}%`;
  const bar = el('div', 'tl-bar');
  const game = el('span', 'tl-render', formatMs(r.originalFrameTimeMs));
  game.style.width = pct(r.originalFrameTimeMs);
  bar.append(game);
  if (r.fgOverheadMs > 0) {
    const fg = el('span', 'tl-fg', formatMs(r.fgOverheadMs));
    fg.style.width = pct(r.fgOverheadMs);
    bar.append(fg);
  }
  const ticks = el('div', 'tl-ticks');
  for (let k = 0; k < r.multiplier; k++) {
    const t = el('span', k === 0 ? 'tick tick-real' : 'tick');
    t.style.left = pct((r.actualFrameTimeMs * k) / r.multiplier);
    ticks.append(t);
  }
  const track = el('div', 'tl-track');
  track.setAttribute('aria-hidden', 'true');
  track.append(bar, ticks);
  const td = el('td', 'frame');
  td.append(track, el('span', 'vh', `${formatMs(r.actualFrameTimeMs)} per rendered frame`));
  return td;
}

/**
 * Estimate shared + per-frame costs from per-multiplier values and offer to use them in the model.
 * Shows why when the values can't be described by that model.
 */
function renderFit(): void {
  const box = $<HTMLDivElement>('#fit');
  if (state.mode !== 'manual') {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  box.hidden = false;
  const check = checkFit(state.manualOverheadMs);
  const text = el('p');
  if (!check.ok) {
    text.className = 'fit-error';
    text.textContent = check.error;
    box.replaceChildren(text);
    return;
  }
  const { fit } = check;
  const shared = Math.round(fit.sharedMs * 1000) / 1000;
  const perFrame = Math.round(fit.perGeneratedFrameMs * 1000) / 1000;
  const btn = el('button', 'btn btn-small', 'Use in model');
  btn.type = 'button';
  btn.addEventListener('click', () => {
    setState({ mode: 'calculated', sharedOverheadMs: shared, perGeneratedFrameMs: perFrame });
    announce('Model updated');
  });
  const lead = `These values fit ${formatMs(shared)} shared plus ${formatMs(perFrame)} per generated frame.`;
  if (check.warning) {
    text.className = 'fit-warning';
    text.textContent = `${lead} ${check.warning}`;
  } else if (check.assumption) {
    text.className = 'fit-warning';
    text.textContent = check.assumption;
  } else {
    text.textContent =
      fit.points === 2
        ? `${lead} The line passes through both values, so the other multipliers come from it.`
        : `${lead} The largest difference from a value is ${fit.maxErrorMs.toFixed(3)} ms.`;
  }
  box.replaceChildren(text, btn);
}

// ---------- URL ----------

let urlTimer: number | undefined;
function scheduleUrlWrite(): void {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(writeUrl, 150);
}
function writeUrl(): void {
  window.clearTimeout(urlTimer);
  const url = buildUrl(state, location, currentPresetId) + location.hash;
  if (url !== location.href) history.replaceState(null, '', url);
}

let statusTimer: number | undefined;
function announce(msg: string): void {
  statusEl.textContent = msg;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (statusEl.textContent = ''), 2000);
}

// ---------- Theme ----------

type ThemePref = 'system' | 'light' | 'dark';
const THEME_KEY = 'fgcalc-theme';
const themeBtn = $<HTMLButtonElement>('#theme');
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readTheme(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

let themePref: ThemePref = readTheme();

/** Set data-theme to the resolved light or dark theme; the CSS has one block per theme. */
function applyTheme(pref: ThemePref): void {
  themePref = pref;
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const label = pref[0]!.toUpperCase() + pref.slice(1);
  themeBtn.textContent = `Theme: ${label}`;
  themeBtn.setAttribute('aria-label', `Theme: ${label}. Press to change.`);
  chart.applyTheme();
}

themeBtn.addEventListener('click', () => {
  const order: ThemePref[] = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(themePref) + 1) % order.length]!;
  try {
    if (next === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage unavailable: theme still applies for this page view */
  }
  applyTheme(next);
});
media.addEventListener('change', () => applyTheme(themePref));

// ---------- Init ----------

applyTheme(themePref);
render();
writeUrl(); // normalise a shared URL that contained invalid values
