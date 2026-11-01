import { formatNum, formatPct } from '../lib/format';
import { bool, num, str, type CalculatorDef, type Field, type Values } from '../lib/types';
import { farmStatsFrom, FLOOR_COUNT, FLOOR_ORES, FLOORS, floorsPerHour, portalValue, SPEED_SECTION, VOID_SECTION, type FarmStats, type FloorInfo } from './bestFloor';

export interface Vein { name: string; firstFloor: number; lastFloor: number; rarity: number; firstOre: number; lastOre: number; world: number }

// From the sheet's vein table: zone floors, rarity (1 in N per spawn), and the ore tiers that make it.
const v = (name: string, firstFloor: number, lastFloor: number, rarity: number, firstOre: number, lastOre: number, world: number): Vein =>
  ({ name, firstFloor, lastFloor, rarity, firstOre, lastOre, world });
export const VEINS: Vein[] = [
  v('Stone Vein', 1, 8, 15, 1, 5, 1), v('Magma Vein', 9, 18, 20, 6, 10, 1), v('Virtual Vein', 19, 24, 25, 11, 14, 1),
  v('Space Vein', 25, 30, 30, 15, 18, 1), v('Cloud Vein', 31, 36, 35, 19, 22, 1), v('Atomic Vein', 37, 42, 40, 23, 26, 1),
  v('Deep Sea Vein', 43, 48, 50, 27, 30, 2), v('Beach Vein', 49, 54, 50, 31, 34, 2), v('Valley Vein', 55, 60, 50, 35, 38, 2),
  v('Jungle Vein', 61, 66, 50, 39, 42, 2), v('Volcano Vein', 67, 72, 50, 43, 46, 2),
  v('Jurassic Vein', 73, 78, 70, 47, 50, 3), v('Roman Vein', 79, 84, 70, 51, 54, 3), v('Industrial Vein', 85, 90, 70, 55, 58, 3),
  v('Warfront Vein', 91, 96, 70, 59, 62, 3), v('Neon Vein', 97, 102, 70, 63, 66, 3),
  v('Wonderland Vein', 103, 108, 100, 67, 70, 4), v('Pirate Vein', 109, 114, 100, 71, 74, 4), v('Arabian Vein', 115, 120, 100, 75, 78, 4),
  v('Enchanted Vein', 121, 126, 100, 79, 82, 4), v('Candyland Vein', 127, 132, 100, 83, 86, 4),
];

export interface VeinStats {
  oresPerScreen: number;
  spawnRate: number;
  income: number;
  goldenChance: number; goldenMulti: number;
  rainbowChance: number; rainbowMulti: number;
  gleamingChance: number; gleamingMulti: number;
  morphChance: number; // Veinmorpher: every rock becomes a vein
  morphGoldenChance: number;
  doubleSpawn: boolean; // 2x spawn research for this vein
}

export function veinsPerScreen(s: VeinStats, vein: Vein) {
  return s.morphChance * s.oresPerScreen + (1 - s.morphChance) * Math.min(s.oresPerScreen, (s.spawnRate * (s.doubleSpawn ? 2 : 1)) / vein.rarity);
}

/** Average multiplier from golden / rainbow / gleaming variants. Rainbow only rolls on golden veins. */
export function variantMulti(s: VeinStats) {
  const g = s.goldenChance, r = s.rainbowChance;
  const morphed = s.goldenMulti * (1 + g * r * (s.rainbowMulti - 1));
  const natural = (1 - g) + g * (1 - r) * s.goldenMulti + g * r * s.goldenMulti * s.rainbowMulti;
  return (s.morphGoldenChance * morphed + (1 - s.morphGoldenChance) * natural) * ((1 - s.gleamingChance) + s.gleamingChance * s.gleamingMulti);
}

/** Share of ores 1..tier that fall in the vein's ore range: what a portal rock of that tier turns into. */
export function portalWeight(vein: Vein, tier: number) {
  if (tier < vein.firstOre) return 0;
  const inRange = tier >= vein.lastOre ? vein.lastOre - vein.firstOre + 1 : tier - vein.firstOre + 1;
  return inRange / tier;
}

export function veinFloorRates(f: FarmStats, s: VeinStats, vein: Vein) {
  const vc = Math.min(f.voidChance, 1);
  const avgPortal = vc > 0 ? portalValue(f) / vc : 0;
  const perScreen = veinsPerScreen(s, vein);
  const variant = variantMulti(s);
  return FLOORS.map((fl: FloorInfo) => {
    const inZone = fl.floor >= vein.firstFloor && fl.floor <= vein.lastFloor ? 1 : 0;
    const ratio = vc <= 0 ? fl.portal : Math.min(fl.portal * f.voidChance, 1) / vc;
    const portalShare = portalWeight(vein, fl.oreA) * fl.shareA + portalWeight(vein, fl.oreB) * (1 - fl.shareA);
    const common = perScreen * floorsPerHour(f, fl) * s.income * variant;
    return {
      floor: fl,
      base: inZone * common,
      void: ((1 - vc * ratio) * inZone + vc * ratio * portalShare * avgPortal) * common,
    };
  });
}

function veinStatsFrom(vals: Values): VeinStats {
  const p = (id: string) => Math.min(num(vals, id) / 100, 1);
  return {
    oresPerScreen: num(vals, 'oresPerScreen'),
    spawnRate: num(vals, 'veinSpawn'),
    income: num(vals, 'veinIncome'),
    goldenChance: p('gvnc'), goldenMulti: num(vals, 'gvnm'),
    rainbowChance: p('rvnc'), rainbowMulti: num(vals, 'rvnm'),
    gleamingChance: p('glvc'), gleamingMulti: num(vals, 'glvm'),
    morphChance: p('morph'), morphGoldenChance: p('morphGolden'),
    doubleSpawn: bool(vals, 'double'),
  };
}

const pct = (id: string, label: string, stat?: string, help?: string): Field =>
  ({ kind: 'number', id, label, default: 0, min: 0, max: 100, step: 0.01, suffix: '%', stat, help });
const mult = (id: string, label: string, stat: string): Field =>
  ({ kind: 'number', id, label, default: 1, min: 0, step: 0.01, stat, big: true });

const WORLD_LAST_FLOOR = [42, 72, 102, 132];

export const bestVeinsCalc: CalculatorDef = {
  id: 'best-vein-floor',
  icon: 'stone-vein.png',
  title: 'Best Floor for Veins',
  category: 'Decisions',
  summary: 'Which floor gives the most of a vein per hour, with and without the void drone.',
  source: { name: 'Best Floor to Farm (Best Veins)', url: 'https://docs.google.com/spreadsheets/d/1I6nTBpxTeCsIN23_CvTRw1Nyqn1qBTZKlJAIpIv9n8w/edit?gid=548859560' },
  keywords: ['vein', 'farm', 'void drone', 'floor', 'veinmorpher'],
  sections: (vals) => {
    const worlds = Math.min(Math.max(num(vals, 'worlds') || 1, 1), 4);
    return [
      {
        title: 'What to farm',
        fields: [
          { kind: 'select', id: 'vein', label: 'Vein', default: '0', options: VEINS.map((x, i) => ({ value: String(i), label: `${x.name} (W${x.world})` })).filter((_, i) => VEINS[i].world <= worlds) },
          { kind: 'number', id: 'worlds', label: 'Worlds unlocked', default: 1, min: 1, max: 4, step: 1, stat: 'worlds_unlocked' },
          { kind: 'bool', id: 'double', label: '2x spawn research done for this vein', default: false },
        ],
      },
      SPEED_SECTION,
      {
        title: 'Vein stats',
        collapsed: true,
        fields: [
          { kind: 'number', id: 'oresPerScreen', label: 'Ores per screen', default: 10, min: 1, step: 1, stat: 'ores_per_screen' },
          mult('veinSpawn', 'Vein spawn rate multi', 'vein_spawn_rate_multi'),
          mult('veinIncome', 'Vein income multi', 'vein_income_multi'),
          pct('gvnc', 'Golden vein chance', 'golden_vein_chance'), mult('gvnm', 'Golden vein multi', 'golden_vein_multi'),
          pct('rvnc', 'Rainbow vein chance', 'rainbow_vein_chance', 'Rolled on golden veins.'), mult('rvnm', 'Rainbow vein multi', 'rainbow_vein_multi'),
          pct('glvc', 'Gleaming vein chance', 'gleaming_vein_chance'), mult('glvm', 'Gleaming vein multi', 'gleaming_vein_multi'),
          pct('morph', 'Veinmorpher morph chance', undefined, 'Chance a screen turns every rock into a vein.'),
          pct('morphGolden', 'Veinmorpher golden chance'),
        ],
      },
      VOID_SECTION,
    ];
  },
  compute(vals) {
    const f = farmStatsFrom(vals);
    const s = veinStatsFrom(vals);
    const vein = VEINS[Number(str(vals, 'vein'))] ?? VEINS[0];
    const worlds = Math.min(Math.max(num(vals, 'worlds') || 1, 1), 4);
    const cap = Math.min(WORLD_LAST_FLOOR[worlds - 1], vein.world === 4 ? FLOOR_COUNT : 102);
    const rates = veinFloorRates(f, s, vein).filter((r) => r.floor.floor <= cap);
    const byBase = rates.filter((r) => r.base > 0).sort((a, b) => b.base - a.base);
    const byVoid = rates.filter((r) => r.void > 0).sort((a, b) => b.void - a.void);
    if (vein.firstFloor > WORLD_LAST_FLOOR[worlds - 1] || (!byBase.length && !byVoid.length)) {
      return { outputs: [{ label: `Best floor for ${vein.name}`, value: 'Unlock its world first', tone: 'bad' }] };
    }
    const useVoid = f.voidChance > 0;
    const bestBase = byBase[0];
    const bestVoid = byVoid[0];
    const voidWins = useVoid && bestVoid && (!bestBase || bestVoid.void > bestBase.base);
    const best = voidWins ? { floor: bestVoid.floor.floor, rate: bestVoid.void } : { floor: bestBase.floor.floor, rate: bestBase.base };
    const perfect = veinsPerScreen(s, vein) * 2880 * f.baseSpeed * s.income * variantMulti(s);
    const ores = (fl: FloorInfo) => `${FLOOR_ORES[fl.oreA - 1]?.name ?? '?'} / ${FLOOR_ORES[fl.oreB - 1]?.name ?? '?'}`;
    const zone = (fl: FloorInfo) => (fl.floor >= vein.firstFloor && fl.floor <= vein.lastFloor ? 'zone' : 'portals');

    return {
      outputs: [
        { label: `Best floor for ${vein.name}`, value: `Floor ${best.floor}`, tone: 'primary', help: voidWins ? 'With the void drone' : useVoid ? 'Without the void drone' : undefined },
        { label: 'Veins per hour', value: formatNum(best.rate, 1) },
        ...(useVoid ? [{ label: 'Use the void drone?', value: voidWins ? 'Yes' : 'No', tone: voidWins ? ('good' as const) : undefined }] : []),
        { label: 'Vein zone', value: `Floors ${vein.firstFloor}–${vein.lastFloor}`, help: `1 in ${vein.rarity} rarity` },
        { label: 'vs. a perfect floor', value: formatPct(best.rate / perfect, 0), help: 'Zone floor at full speed, no portals.' },
      ],
      tables: [
        ...(useVoid
          ? [{
              title: 'Top floors with void drone',
              columns: ['Floor', 'Veins/h', 'From', 'Rocks'],
              rows: byVoid.slice(0, 10).map((r) => [r.floor.floor, formatNum(r.void, 1), zone(r.floor), ores(r.floor)]),
            }]
          : []),
        {
          title: 'Zone floors, no void',
          columns: ['Floor', 'Veins/h', 'Rocks'],
          rows: byBase.map((r) => [r.floor.floor, formatNum(r.base, 1), ores(r.floor)]),
        },
      ],
      notes: [
        'Floors outside the zone only get this vein from void portals that roll one of its ores.',
        'Veins you haven\'t researched yet won\'t spawn at all.',
      ],
    };
  },
};
