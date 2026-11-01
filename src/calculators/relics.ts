import { formatBig, formatInt, formatNum } from '../lib/format';
import { num, type CalculatorDef } from '../lib/types';

interface RelicType { name: string; effect: number; unit: string; cap: number | null; unlock: number }
interface Rarity { name: string; share: number; types: RelicType[] }

// From the Relic Calculator "Data" tab. `unlock` = relics of that rarity opened before it can drop.
const r = (name: string, effect: number, unit: string, cap: number | null, unlock: number): RelicType => ({ name, effect, unit, cap, unlock });
export const RARITIES: Rarity[] = [
  { name: 'Common', share: 0.48, types: [
    r('Pickaxe Damage', 3, '%', null, 0), r('Ore Sell Price', 3, '%', null, 0), r('Bomb Crit Chance', 1, '%', 100, 0),
    r('Offline Income', 2, '%', 10000, 0), r('Bomb Crit Damage', 1, '%', 10000, 100), r('Bomb Damage', 20, '%', null, 500),
  ] },
  { name: 'Rare', share: 0.3, types: [
    r('Bomb Damage', 20, '%', null, 0), r('Experience Gain', 3, '%', null, 0), r('Multi Rock Chance', 2, '%', 100, 0),
    r('Contract Bar Reduction', 2, '%', null, 500), r('Fuel Duration', 0.01, '%', 2500, 1500),
  ] },
  { name: 'Epic', share: 0.14, types: [
    r('Pickaxe Damage', 10, '%', null, 0), r('Bomb Recharge Speed', 2, '%', 250, 0), r('Multi Chest Chance', 2, '%', 50, 0),
    r('Bomb Capacity', 1, '', 2500, 100), r('Golden Floor Multi', 0.1, '%', 500, 500),
  ] },
  { name: 'Legendary', share: 0.07, types: [
    r('5x Craft Chance', 1, '%', 100, 0), r('Prestige Point Gain', 15, '%', null, 0), r('Obelisk Fight Length', 12, '%', 100, 0),
    r('Vein Spawn Rate', 0.1, '%', 500, 150), r('Star Spawn Rate', 0.1, '%', 300, 300),
  ] },
  { name: 'Mythic', share: 0.01, types: [
    r('20x Craft Chance', 1, '%', 100, 0), r('All Bomb Multipliers', 5, 'x', null, 0), r('Golden Floor Chance', 5, '%', 20, 0),
    r('Pet Level Up Chance', 0.5, '%', 50, 75), r('Star Supernova Chance', 0.5, '%', 100, 125),
  ] },
  { name: 'Divine', share: 1 / 25000, types: [
    r('Rainbow Floor Chance', 1, '%', 100, 0), r('Supernova Multipliers', 2, 'x', 5, 3), r('Rainbow Floor Multi', 20, '%', 5, 6),
  ] },
];

/**
 * Relics of one rarity split evenly across every type that is unlocked and not capped.
 * Walk forward event by event (an unlock or a cap) — the sheet does the same by hand.
 */
export function distribute(types: RelicType[], total: number): number[] {
  const got = types.map(() => 0);
  let opened = 0;
  for (let guard = 0; guard < 100 && opened < total - 1e-9; guard++) {
    const active = types.map((_, i) => i).filter((i) => types[i].unlock <= opened + 1e-9 && (types[i].cap == null || got[i] < types[i].cap! - 1e-9));
    if (!active.length) {
      const next = Math.min(...types.filter((t) => t.unlock > opened).map((t) => t.unlock));
      if (!Number.isFinite(next)) break;
      opened = Math.min(total, next); // relics opened while nothing can drop are lost to capped types
      continue;
    }
    let step = total - opened;
    for (const t of types) if (t.unlock > opened) step = Math.min(step, t.unlock - opened);
    for (const i of active) if (types[i].cap != null) step = Math.min(step, (types[i].cap! - got[i]) * active.length);
    for (const i of active) got[i] += step / active.length;
    opened += step;
  }
  return got;
}

export function relicTotals(relicChests: number, mythicChests: number, divineChests: number) {
  return RARITIES.map((rar) => {
    const pool = rar.name === 'Mythic' ? relicChests * rar.share + mythicChests : rar.name === 'Divine' ? relicChests * rar.share + divineChests : relicChests * rar.share;
    return { rarity: rar, pool, counts: distribute(rar.types, pool) };
  });
}

export const relicCalc: CalculatorDef = {
  id: 'relics',
  title: 'Relic Expectations',
  category: 'Odds',
  summary: 'Expected relics of every type, and their total bonus, from the chests you have opened.',
  source: { name: 'Relic Calculator', url: 'https://docs.google.com/spreadsheets/d/1nTx41KMGUfMO27MxD14cCNQa71LmF3UGkMvJKodvP6A/' },
  keywords: ['relic chest', 'divine', 'mythic'],
  sections: [
    {
      title: 'Chests opened',
      fields: [
        { kind: 'number', id: 'relicChests', label: 'Relic chests', default: 400000, min: 0, big: true },
        { kind: 'number', id: 'mythicChests', label: 'Mythic chests', default: 0, min: 0, step: 1 },
        { kind: 'number', id: 'divineChests', label: 'Divine chests', default: 0, min: 0, step: 1 },
      ],
    },
  ],
  compute(v) {
    const totals = relicTotals(num(v, 'relicChests'), num(v, 'mythicChests'), num(v, 'divineChests'));
    return {
      outputs: totals.map((t) => ({ label: `${t.rarity.name} relics`, value: formatInt(t.pool), tone: t.rarity.name === 'Divine' ? ('primary' as const) : undefined })),
      tables: totals.map((t) => ({
        title: t.rarity.name,
        columns: ['Relic', 'Expected', 'Bonus', 'Cap'],
        rows: t.rarity.types.map((type, i) => {
          const count = Math.round(t.counts[i]);
          const bonus = count * type.effect;
          const capped = type.cap != null && count >= type.cap;
          return [type.name, formatInt(count) + (capped ? ' (max)' : ''), (type.unit === 'x' ? '+' + formatBig(bonus) + 'x' : '+' + formatNum(bonus, 2) + type.unit), type.cap == null ? '—' : formatInt(type.cap)];
        }),
      })),
      notes: [
        'These are averages — real counts vary, especially for divine relics.',
        'Relic list matches the original sheet and may miss newer relics. For exact divine odds, use the Relic Solver.',
      ],
    };
  },
};
