import { load, save, remove } from './storage';

/**
 * The game's EXPORTSTATS code copies a JSON blob to the clipboard. Most fields
 * live under `stats`; some sheets also read arrays such as `contracts_array`.
 * We keep the whole object and look keys up at either level.
 */
export interface ExportStats {
  raw: Record<string, unknown>;
  updatedAt: number;
}

const KEY = 'exportstats';
let current: ExportStats | null = load<ExportStats | null>(KEY, null);
const listeners = new Set<() => void>();

export function getExportStats() {
  return current;
}

export function subscribeExportStats(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function parseExportStats(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object found. Paste the full EXPORTSTATS output.');
  const obj = JSON.parse(trimmed.slice(start, end + 1));
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error('Expected a JSON object.');
  return obj as Record<string, unknown>;
}

export function setExportStats(raw: Record<string, unknown>) {
  current = { raw, updatedAt: Date.now() };
  save(KEY, current);
  emit();
}

export function clearExportStats() {
  current = null;
  remove(KEY);
  emit();
}

function find(key: string): unknown {
  if (!current) return undefined;
  const stats = current.raw.stats as Record<string, unknown> | undefined;
  if (stats && typeof stats === 'object' && key in stats) return stats[key];
  return current.raw[key];
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

export function statNumber(key: string): number | undefined {
  return toNumber(find(key));
}

/** 1-based index into an exported array, matching the sheets' INDEX(SPLIT(...), n). */
export function statArrayItem(key: string, index1: number): number | undefined {
  const v = find(key);
  return Array.isArray(v) ? toNumber(v[index1 - 1]) : undefined;
}

export function countStats() {
  if (!current) return 0;
  const stats = current.raw.stats;
  return stats && typeof stats === 'object' ? Object.keys(stats).length : Object.keys(current.raw).length;
}
