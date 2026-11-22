const MINUS = '−';

function fixed(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—';
  // Avoid "-0.0".
  const s = Math.abs(n).toFixed(digits);
  const isZero = Number(s) === 0;
  return n < 0 && !isZero ? `${MINUS}${s}` : s;
}

export function formatFps(n: number): string {
  return fixed(n, 1);
}

export function formatMs(n: number): string {
  return `${fixed(n, 2)} ms`;
}

/** Signed percentage, e.g. "+69.5 %", "−12.0 %", "0.0 %". */
export function formatSignedPercent(n: number): string {
  const s = fixed(n, 1);
  if (s === '—') return s;
  return `${Number(Math.abs(n).toFixed(1)) !== 0 && n > 0 ? '+' : ''}${s} %`;
}

export function formatPercent(n: number): string {
  const s = fixed(n, 1);
  return s === '—' ? s : `${s} %`;
}

export function multiplierLabel(m: number): string {
  return m === 1 ? 'FG Off' : `×${m}`;
}
