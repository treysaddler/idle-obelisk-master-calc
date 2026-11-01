import { formatBig, formatDuration, formatInt, formatNum } from '../lib/format';
import { bool, num, str, type CalculatorDef } from '../lib/types';

const WIKI = 'https://shminer.miraheze.org/wiki/';
const wikiSource = (page: string) => ({ name: `Calculator:${page}`, author: 'Idle Obelisk Miner Wiki', url: WIKI + 'Calculator:' + page });

// ---- Drone suit grade ----------------------------------------------------

export const DRONE_SUITS: { name: string; baseExp: number; baseFuel: number }[] = [
  { name: 'Bomb Bear', baseExp: 2000, baseFuel: 240 },
  { name: 'Chain Bomber', baseExp: 2500, baseFuel: 220 },
  { name: 'Midas', baseExp: 3000, baseFuel: 200 },
  { name: 'Frogger', baseExp: 3500, baseFuel: 180 },
  { name: 'Veinseeker', baseExp: 4000, baseFuel: 160 },
  { name: 'Starburst', baseExp: 4500, baseFuel: 140 },
  { name: 'Elixir', baseExp: 5000, baseFuel: 210 },
  { name: 'Void', baseExp: 5500, baseFuel: 180 },
  { name: 'Angler', baseExp: 22500, baseFuel: 120 },
  { name: 'Prism', baseExp: 255000, baseFuel: 70 },
  { name: 'Minotaur', baseExp: 765000, baseFuel: 65 },
];

export function droneGrade(i: {
  suit: number; current: number; desired: number; gameSpeed: number;
  expMulti: number; fuelMulti: number; fuelSave: number; useFuelSave: boolean;
}) {
  const s = DRONE_SUITS[i.suit];
  // Each grade adds 5% base fuel duration.
  const fuelDuration = Math.floor((s.baseFuel + (s.baseFuel / 20) * i.current) * i.fuelMulti);
  const xpNeeded = Math.max(0, Math.round(s.baseExp * ((i.desired * (i.desired + 1) - i.current * (i.current + 1)) / 2)));
  const timeNeeded = xpNeeded / (i.expMulti * i.gameSpeed);
  const fuelNeeded = Math.ceil((xpNeeded / (fuelDuration * i.expMulti)) * (1 - (i.useFuelSave ? i.fuelSave : 0) / 100));
  return { fuelDuration, displayedFuel: fuelDuration / i.gameSpeed, xpNeeded, timeNeeded, fuelNeeded, gemsNeeded: Math.ceil(fuelNeeded * 5) };
}

const droneGradeCalc: CalculatorDef = {
  id: 'drone-grade',
  title: 'Drone Suit Grade',
  category: 'Wiki Calculators',
  summary: 'Experience, time, fuel and gems needed to reach a drone suit grade.',
  source: wikiSource('DroneGrade'),
  keywords: ['fuel', 'drone exp'],
  sections: [
    {
      title: 'Drone',
      fields: [
        { kind: 'select', id: 'suit', label: 'Drone suit', default: '0', options: DRONE_SUITS.map((s, i) => ({ value: String(i), label: s.name })) },
        { kind: 'number', id: 'current', label: 'Current grade', default: 0, min: 0, step: 1 },
        { kind: 'number', id: 'desired', label: 'Desired grade', default: 1, min: 1, step: 1 },
      ],
    },
    {
      title: 'Multipliers',
      note: 'Use EXPORTSTATS values; the stats tab rounds them differently.',
      fields: [
        { kind: 'number', id: 'gameSpeed', label: 'Game speed multiplier', default: 1, min: 1, step: 0.1, stat: 'game_speed_multi' },
        { kind: 'number', id: 'expMulti', label: 'Drone exp gain multiplier', default: 1, min: 1, step: 0.1, stat: 'coal_drone_exp_multi' },
        { kind: 'number', id: 'fuelMulti', label: 'Drone fuel duration multiplier', default: 1, min: 1, step: 0.1, stat: 'coal_fuel_duration_multi' },
        { kind: 'bool', id: 'useFuelSave', label: 'Include fuel save chance', default: false, help: 'Fuel save is random, so actual usage varies.' },
        { kind: 'number', id: 'fuelSave', label: 'Fuel save chance', default: 0, min: 0, max: 100, step: 0.1, suffix: '%', stat: 'coal_fuel_save_chance' },
      ],
    },
  ],
  compute(v) {
    const r = droneGrade({
      suit: Number(str(v, 'suit')), current: num(v, 'current'), desired: num(v, 'desired'), gameSpeed: num(v, 'gameSpeed'),
      expMulti: num(v, 'expMulti'), fuelMulti: num(v, 'fuelMulti'), fuelSave: num(v, 'fuelSave'), useFuelSave: bool(v, 'useFuelSave'),
    });
    return {
      outputs: [
        { label: 'Gems needed', value: formatInt(r.gemsNeeded), tone: 'primary' },
        { label: 'Fuel needed', value: formatInt(r.fuelNeeded) },
        { label: 'Experience needed', value: formatBig(r.xpNeeded) },
        { label: 'Time to reach grade', value: formatDuration(r.timeNeeded) },
        { label: 'Current fuel duration', value: formatDuration(r.displayedFuel), help: 'Assumes true timers are on.' },
      ],
      notes: ['Each grade raises base fuel duration by 5%, but fuel already added is not extended. Fuel only up to the next grade, then refuel.'],
    };
  },
};

// ---- Drone points --------------------------------------------------------

export function dronePointsGold(points: number, cost: number) {
  return Math.round(points * (cost + 0.25 * points - 0.25));
}

const dronePointsCalc: CalculatorDef = {
  id: 'drone-points',
  title: 'Drone Points',
  category: 'Wiki Calculators',
  summary: 'Gold needed to buy a number of drone points.',
  source: wikiSource('DronePoints'),
  sections: [
    {
      title: 'Inputs',
      fields: [
        { kind: 'number', id: 'points', label: 'Drone points needed', default: 100, min: 1, big: true },
        { kind: 'number', id: 'cost', label: 'Cost of 1 drone point', default: 100, min: 1, big: true },
      ],
    },
  ],
  compute(v) {
    return { outputs: [{ label: 'Gold needed', value: formatBig(dronePointsGold(num(v, 'points'), num(v, 'cost'))), tone: 'primary' }] };
  },
};

// ---- Level exp -----------------------------------------------------------

export const levelExp = (level: number) => Math.round((1.2 ** (level - 1) - 1) * 250);

const levelExpCalc: CalculatorDef = {
  id: 'level-exp',
  title: 'Level Experience',
  category: 'Wiki Calculators',
  summary: 'Total experience needed to reach a level.',
  source: wikiSource('LevelExp'),
  sections: [{ title: 'Inputs', fields: [{ kind: 'number', id: 'level', label: 'Target level', default: 100, min: 1, max: 400, step: 1 }] }],
  compute(v) {
    const level = num(v, 'level');
    return {
      outputs: [{ label: 'Total experience needed', value: formatBig(levelExp(level)), tone: 'primary' }],
      tables: [{
        title: 'Nearby levels',
        columns: ['Level', 'Total exp', 'From previous'],
        rows: [-2, -1, 0, 1, 2, 3, 4, 5].map((d) => level + d).filter((l) => l >= 1)
          .map((l) => [l, formatBig(levelExp(l)), formatBig(levelExp(l) - levelExp(l - 1))]),
        highlight: level >= 3 ? 2 : level - 1,
      }],
    };
  },
};

// ---- Lootbug speed buff --------------------------------------------------

export function lootbugGems(i: { gems: number; cooldown: number; lootMulti: number; jackpot: number; refresh: number; stonks: boolean; stonksMulti: number }) {
  return (600 * i.lootMulti / i.cooldown) * ((i.gems + (i.jackpot / 100) * i.gems * 4 + (i.stonks ? 0.01 * 200 * i.stonksMulti : 0)) / (1 - i.refresh / 100));
}

const lootbugCalc: CalculatorDef = {
  id: 'lootbug-speed',
  title: 'Lootbug Speed Buff',
  category: 'Wiki Calculators',
  summary: 'Extra gems from each 2x speed buff a lootbug gives you.',
  source: wikiSource('LootbugSpeed'),
  keywords: ['freebie'],
  sections: [
    {
      title: 'Freebies',
      fields: [
        { kind: 'number', id: 'gems', label: 'Gems per freebie', default: 5, min: 5, step: 1, stat: 'freebie_gems_bonus' },
        { kind: 'number', id: 'cooldown', label: 'Freebie cooldown', default: 600, min: 1, step: 1, suffix: 's', help: 'Cooldown without the 2x speed buff.', stat: 'freebie_cooldown_seconds' },
        { kind: 'number', id: 'lootMulti', label: 'Lootbug loot multi', default: 1, min: 1, step: 0.1, stat: 'lootbug_loot_multi' },
        { kind: 'number', id: 'jackpot', label: 'Jackpot chance', default: 0, min: 0, max: 100, step: 1, suffix: '%', stat: 'freebie_5x_chance' },
        { kind: 'number', id: 'refresh', label: 'Instant refresh chance', default: 0, min: 0, max: 99, step: 1, suffix: '%', stat: 'freebie_refresh_chance' },
        { kind: 'bool', id: 'stonks', label: 'Stonks unlocked', default: false },
        { kind: 'number', id: 'stonksMulti', label: 'Stonks multi', default: 1, min: 1, max: 3, step: 0.1 },
      ],
    },
  ],
  compute(v) {
    const g = lootbugGems({
      gems: num(v, 'gems'), cooldown: num(v, 'cooldown'), lootMulti: num(v, 'lootMulti'), jackpot: num(v, 'jackpot'),
      refresh: num(v, 'refresh'), stonks: bool(v, 'stonks'), stonksMulti: num(v, 'stonksMulti'),
    });
    return { outputs: [{ label: 'Additional gems per lootbug', value: formatNum(g, 4), tone: 'primary' }] };
  },
};

// ---- Prestige points -----------------------------------------------------

export function prestigePoints(level: number, multi: number) {
  if (level < 20) return 0;
  return Math.round(Math.floor(12 * 1.084 ** (level - 10) * (level > 200 ? 1 + 0.05 * (level - 200) : 1)) * multi);
}

const prestigeCalc: CalculatorDef = {
  id: 'prestige-points',
  title: 'Prestige Points',
  category: 'Wiki Calculators',
  summary: 'Prestige points gained when prestiging at a level.',
  source: wikiSource('PrestigePoints'),
  keywords: ['pp'],
  sections: [
    {
      title: 'Inputs',
      fields: [
        { kind: 'number', id: 'level', label: 'Level', default: 100, min: 1, step: 1 },
        { kind: 'number', id: 'multi', label: 'Prestige point gain multiplier', default: 1, min: 1, big: true, stat: 'prestige_point_multi' },
      ],
    },
  ],
  compute(v) {
    const level = num(v, 'level');
    const multi = num(v, 'multi');
    return {
      outputs: [{ label: 'Prestige points', value: formatBig(prestigePoints(level, multi)), tone: 'primary' }],
      tables: [{
        title: 'If you push further',
        columns: ['Level', 'Prestige points', 'vs. now'],
        rows: [0, 5, 10, 20, 50].map((d) => {
          const p = prestigePoints(level + d, multi);
          const base = prestigePoints(level, multi);
          return [level + d, formatBig(p), base > 0 ? `×${formatNum(p / base, 2)}` : '—'];
        }),
        highlight: 0,
      }],
    };
  },
};

export const wikiCalculators = [droneGradeCalc, dronePointsCalc, levelExpCalc, lootbugCalc, prestigeCalc];
