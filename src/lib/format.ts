// Number notation used in-game: k, m, b, t, q, qi, sx, sp, oc, no, dc, udc, ddc, ...
export const SUFFIXES = [
  '', 'k', 'm', 'b', 't', 'q', 'qi', 'sx', 'sp', 'oc', 'no',
  'dc', 'udc', 'ddc', 'tdc', 'qadc', 'qidc', 'sxdc', 'spdc', 'ocdc', 'nvdc',
];

const SUFFIX_POWER = new Map(SUFFIXES.map((s, i) => [s, i * 3]));
// Alias seen in community sheets.
SUFFIX_POWER.set('qdc', 45);

export type Notation = 'game' | 'scientific';

let notation: Notation = 'game';
export function setNotation(n: Notation) {
  notation = n;
}

/** Parse "3.26e29", "326oc", "1,234.5", "12.5k" etc. Returns NaN when unparseable. */
export function parseNumber(input: string | number): number {
  if (typeof input === 'number') return input;
  const s = input.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
  if (s === '') return NaN;
  const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z]*)$/);
  if (!m) return NaN;
  const base = parseFloat(m[1]);
  if (!m[2]) return base;
  const p = SUFFIX_POWER.get(m[2]);
  return p === undefined ? NaN : base * 10 ** p;
}

function trimZeros(s: string) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Large-number format following the user's notation preference. */
export function formatBig(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? '—' : n > 0 ? '∞' : '-∞';
  const abs = Math.abs(n);
  if (abs < 1000) return trimZeros(n.toFixed(digits));
  if (notation === 'scientific') return n.toExponential(digits).replace('e+', 'e');
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(digits).replace('e+', 'e');
  const scaled = n / 10 ** (tier * 3);
  return trimZeros(scaled.toFixed(digits)) + SUFFIXES[tier];
}

export function formatInt(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return formatBig(n);
  return Math.round(n).toLocaleString('en-US');
}

export function formatNum(n: number, digits = 2): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e9) return formatBig(n, digits);
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatPct(fraction: number, digits = 2): string {
  if (!Number.isFinite(fraction)) return '—';
  const p = fraction * 100;
  if (p !== 0 && Math.abs(p) < 10 ** -digits) return p.toPrecision(2) + '%';
  return trimZeros(p.toFixed(digits)) + '%';
}

/** Seconds -> "2d 3h 4m" (or "45s" when short). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return seconds > 0 ? '∞' : '—';
  if (seconds < 0) return '-' + formatDuration(-seconds);
  if (seconds < 60) return trimZeros(seconds.toFixed(1)) + 's';
  const total = Math.round(seconds);
  const y = Math.floor(total / 31536000);
  const d = Math.floor((total % 31536000) / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (y) parts.push(`${formatInt(y)}y`);
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !y) parts.push(`${m}m`);
  if (!y && !d && s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}
