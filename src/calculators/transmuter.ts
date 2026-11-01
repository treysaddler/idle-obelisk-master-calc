import { formatNum } from '../lib/format';
import { num, type CalculatorDef } from '../lib/types';
import { FLOOR_ORES as ORES } from './bestFloor';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const scale = (chance: number, pass: number, fail: number) => chance * pass + (1 - chance) * fail;
const toMult = (pct: number, mult: number) => 1 + clamp(pct / 100, 0, 1) * (mult - 1);

/** Expected ore from one starting ore after a possible BoP (accounting for golden ore overlap). */
function boppedOre(bopChance: number, bopMult: number, goldChance: number, bopGoldChance: number, goldMult: number) {
  const fullGoldChance = scale(goldChance, 1, bopGoldChance);
  const bopOre = bopMult * scale(fullGoldChance, goldMult, 1);
  const missedOre = scale(goldChance, goldMult, 1);
  return scale(bopChance, bopOre, missedOre);
}

export interface TransmuterInputs {
  free: number; x2: number; x3: number; x5: number; x10: number; x20: number; x100: number; // percents
  craftCost: number; // multiplier 0-1
  bop: number; trans: number;
  transBop: number; bopGold: number; goldChance: number; // percents
  goldMult: number;
}

/** Port of tabatkins' Transmuter vs Bomb of Plenty breakpoint. */
export function transmuterBreakpoint(i: TransmuterInputs) {
  const free = 1 / (1 - clamp(i.free / 100, 0, 0.99));
  const craftMult = free * toMult(i.x2, 2) * toMult(i.x3, 3) * toMult(i.x5, 5) * toMult(i.x10, 10) * toMult(i.x20, 20) * toMult(i.x100, 100);
  const costReduction = clamp(i.craftCost, 0, 1);
  const bopMult = Math.max(1, i.bop);
  const transMult = Math.max(1, i.trans);
  const goldChance = clamp(i.goldChance / 100, 0, 1);
  const bopGoldChance = clamp(i.bopGold / 100, 0, 1);
  const goldMult = Math.max(1, i.goldMult);

  const bopBars = craftMult * boppedOre(1, bopMult, goldChance, bopGoldChance, goldMult);
  const transOre = boppedOre(clamp(i.transBop / 100, 0, 1), bopMult, goldChance, bopGoldChance, goldMult);
  const craftedTransBars = craftMult * transOre;
  const directTransBars = transMult * transOre;
  // BoP wins while bopBars/cost > craftedTransBars/cost + directTransBars.
  const costTransition = (bopBars - craftedTransBars) / directTransBars;

  const idx = ORES.findIndex((o) => Math.floor(o.cost * costReduction) > costTransition);
  return {
    costTransition,
    lowOre: idx < 0 ? ORES[ORES.length - 1] : ORES[idx - 1],
    highOre: idx < 0 ? undefined : ORES[idx],
    costReduction,
  };
}

const pct = (id: string, label: string, stat: string, def = 0) =>
  ({ kind: 'number' as const, id, label, default: def, min: 0, max: 100, step: 0.01, suffix: '%', stat });

export const transmuterCalc: CalculatorDef = {
  id: 'transmuter-vs-bop',
  title: 'Transmuter vs Bomb of Plenty',
  category: 'Decisions',
  summary: 'Which ores to use Transmuter on, and which to Bomb of Plenty, based on your multipliers.',
  source: { name: 'Transmuter Vs Bomb of Plenty Calculator', author: 'Tab Atkins', url: 'https://tabatkins.com/obelisk/transmuter/' },
  keywords: ['bop', 'bars', 'craft'],
  sections: [
    {
      title: 'Crafting',
      fields: [
        pct('free', 'Free craft chance', 'free_craft_chance'),
        pct('x2', 'Double craft chance', 'double_craft_chance'),
        pct('x3', 'Triple craft chance', 'triple_craft_chance'),
        pct('x5', '5x craft chance', 'craft_5x_chance'),
        pct('x10', '10x craft chance', 'craft_10x_chance'),
        pct('x20', '20x craft chance', 'craft_20x_chance'),
        pct('x100', '100x craft chance', 'craft_100x_chance'),
        { kind: 'number', id: 'craftCost', label: 'Bar craft cost multiplier', default: 1, min: 0, max: 1, step: 0.01, stat: 'bar_craft_cost_multi' },
      ],
    },
    {
      title: 'Bombs & golden ore',
      fields: [
        { kind: 'number', id: 'bop', label: 'Bomb of Plenty multi', default: 1, min: 1, step: 0.01, stat: 'bomb_of_plenty_multi' },
        { kind: 'number', id: 'trans', label: 'Transmuter multi', default: 1, min: 1, step: 0.01, stat: 'bomb_transmuter_multi' },
        pct('transBop', 'Transmuter applies BoP chance', 'bomb_trans_apply_bop_chance'),
        pct('bopGold', 'BoP makes golden ore chance', 'bomb_of_plenty_make_gold_chance'),
        pct('goldChance', 'Golden ore chance', 'golden_ore_chance'),
        { kind: 'number', id: 'goldMult', label: 'Golden ore multi', default: 1, min: 1, step: 0.01, stat: 'golden_ore_multi' },
      ],
    },
  ],
  compute(v) {
    const r = transmuterBreakpoint({
      free: num(v, 'free'), x2: num(v, 'x2'), x3: num(v, 'x3'), x5: num(v, 'x5'), x10: num(v, 'x10'), x20: num(v, 'x20'), x100: num(v, 'x100'),
      craftCost: num(v, 'craftCost'), bop: num(v, 'bop'), trans: num(v, 'trans'),
      transBop: num(v, 'transBop'), bopGold: num(v, 'bopGold'), goldChance: num(v, 'goldChance'), goldMult: num(v, 'goldMult'),
    });
    const outputs = !r.highOre
      ? [{ label: 'Use Bomb of Plenty for', value: 'Every ore', tone: 'primary' as const }]
      : !r.lowOre
        ? [{ label: 'Use Transmuter for', value: 'Every ore', tone: 'primary' as const }]
        : [
            { label: 'Use Bomb of Plenty for', value: `${r.lowOre.name} or lower`, tone: 'primary' as const },
            { label: 'Use Transmuter for', value: `${r.highOre.name} or higher`, tone: 'primary' as const },
          ];
    return {
      outputs: [...outputs, { label: 'Breakpoint craft cost', value: `${formatNum(Math.floor(r.costTransition), 0)} ores per bar`, help: 'At a 1x craft cost.' }],
      tables: [{
        title: 'Ores',
        columns: ['Ore', 'World', 'Your craft cost', 'Use'],
        rows: ORES.map((o) => {
          const cost = Math.floor(o.cost * r.costReduction);
          return [o.name, o.world, cost, cost > r.costTransition ? 'Transmuter' : 'BoP'];
        }),
      }],
    };
  },
};
