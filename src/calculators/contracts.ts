import upgrades from '../data/contractUpgrades.json';
import { formatBig, formatInt, formatNum, formatPct } from '../lib/format';
import { bool, num, type CalculatorDef, type Field, type Section, type Values } from '../lib/types';

interface Upgrade { world: number; name: string; capOffset: number; tags: string[]; costs: (number | null)[] }
const UPGRADES = upgrades as Upgrade[];

// ---- Average points ------------------------------------------------------

export function contractPoints(i: { base: number; x2: number; x3: number; x5: number; x10: number }) {
  const mean = [[i.x2, 2], [i.x3, 3], [i.x5, 5], [i.x10, 10]].reduce((a, [p, m]) => a * (1 + (p / 100) * (m - 1)), 1);
  const meanSq = [[i.x2, 4], [i.x3, 9], [i.x5, 25], [i.x10, 100]].reduce((a, [p, m]) => a * (1 + (p / 100) * (m - 1)), 1);
  const average = i.base * mean;
  const variance = i.base ** 2 * meanSq - average ** 2;
  return { mean, average, sd: Math.sqrt(Math.max(0, variance)) };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
export function normCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// ---- Upgrade costs -------------------------------------------------------

export function cumulativeCost(u: Upgrade, level: number) {
  let total = 0;
  for (let l = 0; l <= level && l < u.costs.length; l++) total += u.costs[l] ?? 0;
  return total;
}

export function upgradeCost(u: Upgrade, from: number, to: number, costMulti: number) {
  return Math.ceil((cumulativeCost(u, to) - cumulativeCost(u, from)) * costMulti);
}

const TAGS: [string, string][] = [['D', 'Damage'], ['O', 'Ores / bars'], ['F', 'Farm'], ['V', 'Veins'], ['S', 'Stars']];

function worldUnlocked(v: Values, w: number) {
  return w === 1 || (w === 2 && bool(v, 'w2')) || (w === 3 && bool(v, 'w3')) || (w === 4 && bool(v, 'w4'));
}

export function upgradePlan(v: Values) {
  const cap = num(v, 'cap');
  const multi = num(v, 'costMulti');
  return UPGRADES.map((u, i) => {
    const max = u.capOffset + cap;
    const cur = Math.min(num(v, `u${i}c`), max);
    const maxIt = u.tags.some((t) => bool(v, 'max' + t));
    const target = maxIt ? max : Math.min(num(v, `u${i}d`), max);
    const included = worldUnlocked(v, u.world) && target > cur;
    return { u, max, cur, target, cost: included ? upgradeCost(u, cur, target, multi) : 0, included };
  });
}

function sections(v: Values): Section[] {
  const cap = num(v, 'cap');
  const worlds = [1, 2, 3, 4].filter((w) => worldUnlocked(v, w));
  return [
    {
      title: 'Contract points',
      fields: [
        { kind: 'number', id: 'base', label: 'Points per contract', default: 19, min: 0, step: 1 },
        { kind: 'number', id: 'x2', label: '2x chance', default: 0, min: 0, max: 100, step: 0.01, suffix: '%' },
        { kind: 'number', id: 'x3', label: '3x chance', default: 0, min: 0, max: 100, step: 0.01, suffix: '%' },
        { kind: 'number', id: 'x5', label: '5x chance', default: 0, min: 0, max: 100, step: 0.01, suffix: '%' },
        { kind: 'number', id: 'x10', label: '10x chance', default: 0, min: 0, max: 100, step: 0.01, suffix: '%' },
      ],
    },
    {
      title: 'This prestige',
      fields: [
        { kind: 'number', id: 'completed', label: 'Contracts completed', default: 0, min: 0, step: 1 },
        { kind: 'number', id: 'earned', label: 'Contract points earned', default: 0, min: 0, big: true },
      ],
    },
    {
      title: 'Upgrade setup',
      fields: [
        { kind: 'number', id: 'cap', label: 'Contract cap upgrade', default: 0, min: 0, step: 1 },
        { kind: 'number', id: 'costMulti', label: 'Contract upgrade cost multiplier', default: 1, min: 0, max: 1, step: 0.01, help: 'e.g. 0.13 if upgrades cost 13% of base.' },
        { kind: 'bool', id: 'w2', label: 'World 2 statue (unlocks W2 upgrades)', default: false },
        { kind: 'bool', id: 'w3', label: 'World 3 statue (unlocks W3 upgrades)', default: false },
        { kind: 'bool', id: 'w4', label: 'World 4 statue (unlocks W4 upgrades)', default: false },
        ...TAGS.map(([t, label]): Field => ({ kind: 'bool', id: 'max' + t, label: `Max every ${label} upgrade`, default: false })),
      ],
    },
    ...worlds.map((w): Section => ({
      title: `World ${w} upgrades`,
      note: 'Current level, then the level you want.',
      collapsed: true,
      fields: UPGRADES.flatMap((u, i): Field[] =>
        u.world !== w ? [] : [
          { kind: 'number', id: `u${i}c`, label: `${u.name} — current`, default: 0, min: 0, max: u.capOffset + cap, step: 1 },
          { kind: 'number', id: `u${i}d`, label: `${u.name} — want`, default: 0, min: 0, max: u.capOffset + cap, step: 1 },
        ]),
    })),
    {
      title: 'Damage from contracts',
      collapsed: true,
      note: 'Uses your current levels of "Pickaxe Damage Per Contract", "Pickaxe Damage" and "Pickaxe & Bomb Damage" above.',
      fields: [{ kind: 'number', id: 'pickDamage', label: 'Current pickaxe damage', default: 0, min: 0, big: true }],
    },
  ];
}

const idx = (name: string) => UPGRADES.findIndex((u) => u.name === name);
const PD_PER = idx('Pickaxe Damage Per Contract Complete');
const PD_15 = idx('Pickaxe Damage');
const PB_108 = idx('Pickaxe & Bomb Damage');

export function damageAfterContracts(v: Values, extraContracts: number) {
  const cap = num(v, 'cap');
  const n = num(v, 'completed');
  const lvl = (i: number) => num(v, `u${i}c`);
  const base = num(v, 'pickDamage') / (1 + (lvl(PD_PER) * n * 0.01 + lvl(PD_15) * 0.15)) / (1 + lvl(PB_108) * 0.08);
  const w3 = bool(v, 'w3') ? 1 + (cap + 5) * 0.08 : 1;
  return base * (1 + (cap + 1) * (n + extraContracts) * 0.01 + (cap + 3) * 0.15) * w3;
}

export const contractCalc: CalculatorDef = {
  id: 'contracts',
  icon: 'contracts-icon.png',
  title: 'Contracts & Damage',
  category: 'Decisions',
  summary: 'How lucky your contract points were, what your upgrade goals cost, and how much damage more contracts add.',
  source: { name: 'Contract & Damage Calc', url: 'https://docs.google.com/spreadsheets/d/1h9P_KZ9gtnFSBD_0r4tsuUmN2Z__UsaJe2hc96evIJs/edit?usp=sharing' },
  keywords: ['prestige', 'contract points'],
  sections,
  compute(v) {
    const pts = contractPoints({ base: num(v, 'base'), x2: num(v, 'x2'), x3: num(v, 'x3'), x5: num(v, 'x5'), x10: num(v, 'x10') });
    const completed = num(v, 'completed');
    const expected = pts.average * completed;
    const percentile = completed > 0 ? normCdf((num(v, 'earned') - expected) / (Math.sqrt(completed) * pts.sd)) : NaN;
    const plan = upgradePlan(v);
    const total = plan.reduce((a, r) => a + r.cost, 0);
    const contractsNeeded = pts.average > 0 ? Math.ceil(total / pts.average) : NaN;

    const tables = [];
    const rows = plan.filter((r) => r.included);
    if (rows.length) {
      tables.push({
        title: 'Upgrade plan',
        columns: ['Upgrade', 'W', 'From → to', 'Points'],
        rows: rows.map((r) => [r.u.name, r.u.world, `${r.cur} → ${r.target}`, formatInt(r.cost)]),
      });
    }
    if (num(v, 'pickDamage') > 0) {
      const now = num(v, 'pickDamage');
      tables.push({
        title: 'Pickaxe damage with all three damage upgrades maxed',
        columns: ['Extra contracts', 'Pickaxe damage', 'vs. now'],
        rows: [0, 10, 100, 250, 500, 1000, 12000].map((x) => {
          const d = damageAfterContracts(v, x);
          return [formatInt(x), formatBig(d), '×' + formatNum(d / now, 3)];
        }),
      });
    }

    return {
      outputs: [
        { label: 'Average points per contract', value: formatNum(pts.average, 2), tone: 'primary', help: `×${formatNum(pts.mean, 3)} expected multiplier` },
        { label: 'Points needed for plan', value: formatInt(total) },
        { label: 'Expected contracts for plan', value: Number.isFinite(contractsNeeded) ? formatInt(contractsNeeded) : '—' },
        ...(completed > 0
          ? [
              { label: 'Expected points so far', value: formatInt(expected) },
              { label: 'Your luck percentile', value: formatPct(percentile, 0), tone: percentile > 0.5 ? ('good' as const) : ('bad' as const) },
              { label: 'Prestige again?', value: percentile > 0.5 ? 'No — above average' : 'Yes — below average', help: 'The sheet suggests re-rolling when you are below the median.' },
            ]
          : []),
      ],
      tables,
      notes: ['Upgrade costs come from the original sheet. Levels beyond its table are counted as free.'],
    };
  },
};
