import { formatBig, formatInt, formatNum, formatPct } from '../lib/format';
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
  summary: 'Expected relics of every type from your chests, plus divine reroll odds and gem costs.',
  source: { name: 'Relic Calculator', url: 'https://docs.google.com/spreadsheets/d/1nTx41KMGUfMO27MxD14cCNQa71LmF3UGkMvJKodvP6A/' },
  keywords: ['relic chest', 'divine', 'mythic', 'reroll'],
  sections: [
    {
      title: 'Chests opened',
      note: 'Relic chests is the number at the top left of your relic chest summary.',
      fields: [
        { kind: 'number', id: 'relicChests', label: 'Relic chests', default: 400000, min: 0, big: true },
        { kind: 'number', id: 'mythicChests', label: 'Mythic chests', default: 0, min: 0, step: 1 },
        { kind: 'number', id: 'divineChests', label: 'Divine chests', default: 0, min: 0, step: 1 },
      ],
    },
    {
      title: 'Divine rerolls',
      note: 'Each reroll costs 200 gems and re-rolls every relic chest.',
      fields: [
        { kind: 'number', id: 'currentDivines', label: 'Current divines', default: 0, min: 0, step: 1, help: 'Top right of your relic chest summary.' },
        { kind: 'number', id: 'gems', label: 'Gems you\'re willing to spend', default: 0, min: 0, big: true },
      ],
    },
  ],
  compute(v) {
    const relicChests = num(v, 'relicChests');
    const divineChests = num(v, 'divineChests');
    const totals = relicTotals(relicChests, num(v, 'mythicChests'), divineChests);
    const plan = divineRerollPlan({ relicChests, divineChests, current: num(v, 'currentDivines'), gems: num(v, 'gems') });
    return {
      outputs: [
        { label: 'Reroll advice', value: plan.verdict, tone: 'primary', help: plan.detail },
        { label: `Chance of ${plan.nextTarget}+ divines`, value: formatPct(plan.nextProb, 1), help: `With ${formatInt(plan.rerolls)} rerolls` },
        { label: `Gems to expect ${plan.nextTarget}+`, value: formatInt(plan.nextGems), help: 'Average cost' },
        ...totals.map((t) => ({ label: `${t.rarity.name} relics`, value: formatInt(t.pool) })),
      ],
      tables: [
        {
          title: 'Divine reroll odds',
          note: 'Chance per reroll of landing at least that many divines, the average rerolls and gems that takes, and your odds with the gems above.',
          columns: ['Divines', 'Per roll', 'Avg rolls', 'Avg gems', 'Your odds'],
          rows: plan.rows.map((r) => [r.target, formatPct(r.perRoll, 2), formatInt(r.avgRolls), formatBig(r.avgGems), formatPct(r.withGems, 1)]),
          highlight: plan.rows.findIndex((r) => r.target === plan.nextTarget),
        },
        ...tablesFor(totals),
      ],
      notes: [
        'Relic counts are averages — real counts vary, especially for divine relics.',
        "Divine reroll odds are ported from the DivineChest Calc and Rody's Relic DLC tabs of Ultimate Gem Calculator 2.2.",
        'Relic list matches the original sheet and may miss newer relics. For odds on a specific mix of divine types, use the Relic Solver.',
      ],
    };
  },
};

function tablesFor(totals: ReturnType<typeof relicTotals>) {
  return totals.map((t) => ({
        title: t.rarity.name,
        columns: ['Relic', 'Expected', 'Bonus', 'Cap'],
        rows: t.rarity.types.map((type, i) => {
          const count = Math.round(t.counts[i]);
          const bonus = count * type.effect;
          const capped = type.cap != null && count >= type.cap;
          return [type.name, formatInt(count) + (capped ? ' (max)' : ''), (type.unit === 'x' ? '+' + formatBig(bonus) + 'x' : '+' + formatNum(bonus, 2) + type.unit), type.cap == null ? '—' : formatInt(type.cap)];
        }),
  }));
}

// ---- Divine rerolls (Ultimate Gem 2.2: DivineChest Calc + Rody's Relic DLC) ----

export const DIVINE_CHANCE = 1 / 25000;
export const REROLL_GEMS = 200;

/** P(X >= k) for X ~ Binomial(n, p), summed from the upper tail so tiny odds stay accurate. */
export function binomialAtLeast(k: number, n: number, p: number) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  // Start at the pmf of k using logs, then walk upward.
  let logPmf = logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p);
  let sum = 0;
  for (let i = k; i <= n; i++) {
    const pmf = Math.exp(logPmf);
    sum += pmf;
    if (pmf < sum * 1e-17 && i > n * p) break;
    logPmf += Math.log((n - i) / (i + 1)) + Math.log(p) - Math.log1p(-p);
  }
  return Math.min(1, sum);
}

function logChoose(n: number, k: number) {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

// Stirling series; exact enough for these counts.
function logFactorial(n: number): number {
  if (n < 20) {
    let r = 0;
    for (let i = 2; i <= n; i++) r += Math.log(i);
    return r;
  }
  return n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n) + 1 / (12 * n) - 1 / (360 * n ** 3);
}

export function divineRerollPlan(i: { relicChests: number; divineChests: number; current: number; gems: number }) {
  const rerolls = Math.floor(i.gems / REROLL_GEMS);
  // Divine chests are guaranteed; the rest roll at 1 in 25,000 per relic chest.
  const perRoll = (target: number) => binomialAtLeast(target - i.divineChests, i.relicChests, DIVINE_CHANCE);
  const withGems = (p: number) => (rerolls > 0 ? 1 - (1 - p) ** rerolls : 0);
  const nextTarget = i.current + 1;
  const nextPer = perRoll(nextTarget);
  const nextProb = withGems(nextPer);
  const nextGems = nextPer > 0 ? Math.ceil(1 / nextPer) * REROLL_GEMS : Infinity;

  const rows = [];
  for (let t = Math.max(1, i.divineChests + 1, nextTarget - 3); rows.length < 14; t++) {
    const p = perRoll(t);
    if (p < 1e-12 && t > nextTarget) break;
    rows.push({ target: t, perRoll: p, avgRolls: p > 0 ? Math.ceil(1 / p) : Infinity, avgGems: p > 0 ? Math.ceil(1 / p) * REROLL_GEMS : Infinity, withGems: withGems(p) });
  }

  // Sheet thresholds: >= 98% go for it, < 63% probably not worth it, in between borderline.
  const best = (chance: number) => {
    let t = nextTarget;
    while (withGems(perRoll(t + 1)) >= chance && t < nextTarget + 200) t++;
    return withGems(perRoll(t)) >= chance ? t : 0;
  };
  let verdict: string;
  let detail: string;
  const pct = formatPct(nextProb, 1);
  if (rerolls === 0) {
    verdict = 'Add gems to see odds';
    detail = `One reroll costs ${REROLL_GEMS} gems.`;
  } else if (nextProb < 0.63) {
    verdict = 'Probably not worth it';
    detail = `${pct} chance of ${nextTarget}+ divines with ${formatInt(rerolls)} rerolls. Expect about ${formatInt(nextGems)} gems for that step.`;
  } else if (nextProb >= 0.98) {
    const likely = best(0.63);
    const stretch = best(0.1);
    detail = `${pct} chance of ${nextTarget}+. Likely high point: ${likely} (${formatPct(withGems(perRoll(likely)), 1)}); stretch: ${stretch} (${formatPct(withGems(perRoll(stretch)), 1)}).`;
    verdict = 'Go for it';
  } else {
    verdict = 'Borderline';
    detail = `${pct} chance of ${nextTarget}+ divines with ${formatInt(rerolls)} rerolls. It may be worth it, but it isn't a safe bet.`;
  }
  return { rerolls, nextTarget, nextProb, nextGems, rows, verdict, detail };
}
