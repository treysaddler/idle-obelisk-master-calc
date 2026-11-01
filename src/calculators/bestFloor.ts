import floorOres from '../data/floorOres.json';
import { formatBig, formatPct } from '../lib/format';
import { bool, num, str, type CalculatorDef, type Field, type Section, type Values } from '../lib/types';

interface FloorOre { world: number; name: string; cost: number; health: number }
export const FLOOR_ORES = floorOres as FloorOre[];
export const FLOOR_COUNT = 132;
const WORLD_LAST_FLOOR = [42, 72, 102, 132];

// Special floors from the sheet's override table: [from, to, kind, value]
type Override = [number, number, 'golden' | 'rainbow' | 'goreMult' | 'prismatic' | 'portal' | 'speed', number];
const OVERRIDES: Override[] = [
  [69, 72, 'golden', 0.5], [75, 78, 'golden', 0.5], [81, 84, 'golden', 0.45], [87, 90, 'golden', 0.4], [91, 94, 'golden', 0.45],
  [99, 102, 'golden', 0.4], [105, 108, 'golden', 0.4], [111, 114, 'golden', 0.35], [117, 120, 'golden', 0.3], [127, 130, 'golden', 0.3],
  [65, 66, 'rainbow', 0.5], [85, 86, 'rainbow', 0.5], [101, 102, 'rainbow', 0.4], [109, 110, 'rainbow', 0.4],
  [115, 116, 'goreMult', 0.5],
  [123, 126, 'prismatic', -0.15],
  [103, 106, 'portal', 0.4], [129, 132, 'portal', 0.4],
  [71, 72, 'speed', 0.75], [89, 92, 'speed', 0.75], [97, 98, 'speed', 0.75], [119, 120, 'speed', 0.7], [121, 124, 'speed', 0.6],
];

export interface FloorInfo {
  floor: number;
  world: number;
  oreA: number; // 1-based index into FLOOR_ORES
  oreB: number;
  shareA: number;
  goldenFloor?: number;
  rainbow: number;
  goreMult: number;
  prismatic: number;
  portal: number;
  speed: number;
}

export function floorInfo(floor: number): FloorInfo {
  const world = WORLD_LAST_FLOOR.findIndex((last) => floor <= last) + 1;
  const oreA = Math.round(floor / 2) + Math.max(0, Math.floor((floor - 13) / 6));
  const f: FloorInfo = { floor, world, oreA, oreB: oreA + 1, shareA: floor % 2 ? 0.8 : 0.5, rainbow: 1, goreMult: 1, prismatic: 0, portal: 1, speed: 1 };
  for (const [from, to, kind, value] of OVERRIDES) {
    if (floor < from || floor > to) continue;
    if (kind === 'golden') f.goldenFloor = Math.max(f.goldenFloor ?? 0, value);
    else if (kind === 'prismatic') f.prismatic += value;
    else f[kind] *= value;
  }
  return f;
}

export const FLOORS = Array.from({ length: FLOOR_COUNT }, (_, i) => floorInfo(i + 1));

/** World 4 quest progress -> game speed penalty in World 4. */
export function w4Penalty(questsDone: number) {
  if (questsDone >= 23) return 0.2;
  if (questsDone >= 15) return 0.3;
  if (questsDone >= 12) return 0.4;
  if (questsDone >= 7) return 0.5;
  if (questsDone >= 4) return 0.6;
  if (questsDone >= 1) return 0.7;
  return 0.8;
}

export interface FarmStats {
  oresPerScreen: number;
  oreIncome: number;
  baseSpeed: number; // game speed with floor/world modifiers removed
  fishingNoticeW3: boolean;
  w4Quests: number;
  // chances 0-1, multipliers as-is
  goldenFloorChance: number; goldenFloorMulti: number;
  rainbowFloorChance: number; rainbowFloorMulti: number;
  galacticFloorChance: number; galacticFloorMulti: number;
  prismaticFloorChance: number; prismaticFloorMulti: number;
  goldenOreChance: number; goldenOreMulti: number;
  rainbowOreChance: number; rainbowOreMulti: number;
  voidChance: number; // raw, may exceed 1
  voidBaseMulti: number; voidMulti: number;
  goldenVoidChance: number; goldenVoidMulti: number;
  rainbowVoidChance: number; rainbowVoidMulti: number;
  galacticVoidChance: number; galacticVoidMulti: number;
}

const FLOORS_PER_HOUR = 2880; // one floor per 1.25s at 1x speed

export function floorsPerHour(s: Pick<FarmStats, 'baseSpeed' | 'fishingNoticeW3' | 'w4Quests'>, f: FloorInfo) {
  const worldMod = f.world === 3 ? (s.fishingNoticeW3 ? 1 : 0.7) : f.world === 4 ? 1 - w4Penalty(s.w4Quests) : 1;
  return FLOORS_PER_HOUR * s.baseSpeed * f.speed * worldMod;
}

/** Remove the current floor's speed modifiers from an exported game speed. */
export function baseGameSpeed(exported: number, currentFloor: number, fishingNoticeW3: boolean, w4Quests: number) {
  if (currentFloor < 1 || currentFloor > FLOOR_COUNT) return exported;
  const f = FLOORS[currentFloor - 1];
  let speed = exported / f.speed;
  if (currentFloor >= 73 && currentFloor <= 102 && !fishingNoticeW3) speed /= 0.7;
  if (currentFloor >= 103) speed /= 1 - w4Penalty(w4Quests);
  return speed;
}

/** Value of everything except ore share: floor-type and ore-type multipliers. */
function floorMulti(s: FarmStats, f: FloorInfo) {
  const g = f.goldenFloor ?? s.goldenFloorChance;
  const pz = f.prismatic === 0 ? s.prismaticFloorChance : Math.min(Math.max(s.prismaticFloorChance + f.prismatic, 0), 1);
  const gore = (1 - s.goldenOreChance) + s.goldenOreChance * s.goldenOreMulti * f.goreMult;
  const rore = (1 - s.goldenOreChance) + s.goldenOreChance * s.goldenOreMulti * f.goreMult * ((1 - s.rainbowOreChance) + s.rainbowOreChance * s.rainbowOreMulti);
  return Math.max(gore, rore) * s.oreIncome * ((1 - g) + g * s.goldenFloorMulti) *
    ((1 - s.rainbowFloorChance) + s.rainbowFloorChance * f.rainbow * s.rainbowFloorMulti *
      ((1 - s.galacticFloorChance) + s.galacticFloorChance * s.galacticFloorMulti * ((1 - pz) + pz * s.prismaticFloorMulti)));
}

/** Expected ore per void portal rock, over the portal tiers. */
export function portalValue(s: FarmStats) {
  const vc = Math.min(s.voidChance, 1);
  const galactic = vc * s.goldenVoidChance * s.rainbowVoidChance * s.galacticVoidChance;
  const rainbow = vc * s.goldenVoidChance * s.rainbowVoidChance - galactic;
  const golden = vc * s.goldenVoidChance - rainbow - galactic;
  const normal = vc - golden - rainbow - galactic;
  const mNormal = s.voidMulti * s.voidBaseMulti;
  const mGolden = mNormal * s.goldenVoidMulti;
  const mRainbow = mGolden * s.rainbowVoidMulti;
  const mGalactic = mRainbow * s.galacticVoidMulti;
  return normal * mNormal + golden * mGolden + rainbow * mRainbow + galactic * mGalactic;
}

/** Ore per hour of `ore` (1-based) on each floor, without and with the void drone. */
export function floorRates(s: FarmStats, ore: number) {
  const vc = Math.min(s.voidChance, 1);
  const pv = portalValue(s);
  return FLOORS.map((f) => {
    const sel = (f.oreA === ore ? f.shareA : 0) + (f.oreB === ore ? 1 - f.shareA : 0);
    // A portal turns a rock into a random ore up to that rock's own tier.
    const portalShare = (f.oreA >= ore ? f.shareA / f.oreA : 0) + (f.oreB >= ore ? (1 - f.shareA) / f.oreB : 0);
    const r = vc <= 0 ? 1 : Math.min(f.portal * s.voidChance, 1) / vc;
    const common = floorMulti(s, f) * floorsPerHour(s, f) * s.oresPerScreen;
    return { floor: f, base: sel * common, void: ((1 - r * vc) * sel + r * pv * portalShare) * common };
  });
}

/** Best possible rate: every rock is the selected ore on a normal floor. */
export function perfectRate(s: FarmStats) {
  const f = floorInfo(1);
  return s.oresPerScreen * floorMulti(s, { ...f, goldenFloor: undefined }) * FLOORS_PER_HOUR * s.baseSpeed;
}

export function floorCap(worlds: number, showW4: boolean, ore: number) {
  const worldCap = WORLD_LAST_FLOOR[Math.min(Math.max(worlds, 1), 4) - 1];
  return Math.min(worldCap, showW4 || ore > 66 ? 132 : 102);
}

export function farmStatsFrom(v: Values): FarmStats {
  const p = (id: string) => num(v, id) / 100;
  const fishingNoticeW3 = bool(v, 'fishingW3');
  const w4Quests = num(v, 'w4Quests');
  return {
    oresPerScreen: num(v, 'oresPerScreen'),
    oreIncome: num(v, 'oreIncome'),
    baseSpeed: baseGameSpeed(num(v, 'gameSpeed'), num(v, 'currentFloor'), fishingNoticeW3, w4Quests),
    fishingNoticeW3, w4Quests,
    goldenFloorChance: Math.min(p('gfc'), 1), goldenFloorMulti: num(v, 'gfm'),
    rainbowFloorChance: Math.min(p('rfc'), 1), rainbowFloorMulti: num(v, 'rfm'),
    galacticFloorChance: Math.min(p('galfc'), 1), galacticFloorMulti: num(v, 'galfm'),
    prismaticFloorChance: Math.min(p('pfc'), 1), prismaticFloorMulti: num(v, 'pfm'),
    goldenOreChance: Math.min(p('goc'), 1), goldenOreMulti: num(v, 'gom'),
    rainbowOreChance: Math.min(p('roc'), 1), rainbowOreMulti: num(v, 'rom'),
    voidChance: bool(v, 'useVoid') ? p('vc') : 0,
    voidBaseMulti: num(v, 'vbm'), voidMulti: num(v, 'vm'),
    goldenVoidChance: Math.min(p('gvc'), 1), goldenVoidMulti: num(v, 'gvm'),
    rainbowVoidChance: Math.min(p('rvc'), 1), rainbowVoidMulti: num(v, 'rvm'),
    galacticVoidChance: Math.min(p('galvc'), 1), galacticVoidMulti: num(v, 'galvm'),
  };
}

const pct = (id: string, label: string, stat: string, help?: string): Field =>
  ({ kind: 'number', id, label, default: 0, min: 0, step: 0.01, suffix: '%', stat, help });
const mult = (id: string, label: string, stat: string, def = 1): Field =>
  ({ kind: 'number', id, label, default: def, min: 0, step: 0.01, stat, big: true });

export const SPEED_SECTION: Section = {
  title: 'Speed',
  note: 'EXPORTSTATS game speed includes your current floor\'s modifiers; set "Exported on floor" to remove them.',
  fields: [
    { kind: 'number', id: 'gameSpeed', label: 'Game speed', default: 1, min: 0.01, step: 0.01, stat: 'game_speed_multi' },
    { kind: 'number', id: 'currentFloor', label: 'Exported on floor', default: 0, min: 0, max: FLOOR_COUNT, step: 1, stat: 'current_floor', help: '0 = speed has no floor modifiers.' },
    { kind: 'bool', id: 'fishingW3', label: 'Fishing notice: World 3 speed', default: false, statArray: ['fishing_notices_array', 14], help: 'Without it, World 3 runs at 70% speed.' },
    { kind: 'number', id: 'w4Quests', label: 'World 4 quests done', default: 0, min: 0, max: 30, step: 1, stat: 'world_4_quest_progress' },
  ],
};

export const VOID_SECTION: Section = {
  title: 'Void drone',
  collapsed: true,
  note: 'Found under Stats → Drones. Export away from floors 103–106 and 129–132, which cut portal chance.',
  fields: [
    { kind: 'bool', id: 'useVoid', label: 'Compare with void drone', default: true },
    pct('vc', 'Void portal chance', 'void_portal_chance', 'Can exceed 100%; the extra helps on floors that cut portal chance.'),
    mult('vbm', 'Void portal base multi', 'void_portal_base_multi'),
    mult('vm', 'Normal void portal multi', 'void_portal_multi'),
    pct('gvc', 'Golden void portal chance', 'golden_void_portal_chance'), mult('gvm', 'Golden void portal multi', 'golden_void_portal_multi'),
    pct('rvc', 'Rainbow void portal chance', 'rainbow_void_portal_chance'), mult('rvm', 'Rainbow void portal multi', 'rainbow_void_portal_multi'),
    pct('galvc', 'Galactic void portal chance', 'galactic_void_portal_chance'), mult('galvm', 'Galactic void portal multi', 'galactic_void_portal_multi'),
  ],
};

export const bestFloorCalc: CalculatorDef = {
  id: 'best-floor',
  title: 'Best Floor to Farm',
  category: 'Decisions',
  summary: 'Which floor gives the most of an ore per hour, with and without the void drone.',
  source: { name: 'Best Floor to Farm', url: 'https://docs.google.com/spreadsheets/d/1I6nTBpxTeCsIN23_CvTRw1Nyqn1qBTZKlJAIpIv9n8w/edit?gid=548859560' },
  keywords: ['ore', 'farm', 'void drone', 'floor'],
  sections: (v) => {
    const worlds = Math.min(Math.max(num(v, 'worlds') || 1, 1), 4);
    return [
      {
        title: 'What to farm',
        fields: [
          {
            kind: 'select', id: 'ore', label: 'Ore', default: '1',
            options: FLOOR_ORES.map((o, i) => ({ value: String(i + 1), label: `${o.name} (W${o.world})` })).filter((_, i) => FLOOR_ORES[i].world <= worlds),
          },
          { kind: 'number', id: 'worlds', label: 'Worlds unlocked', default: 1, min: 1, max: 4, step: 1, stat: 'worlds_unlocked' },
          { kind: 'bool', id: 'showW4', label: 'Include World 4 floors for W1–W3 ores', default: false },
        ],
      },
      SPEED_SECTION,
      {
        title: 'Ore & floor stats',
        collapsed: true,
        fields: [
          { kind: 'number', id: 'oresPerScreen', label: 'Ores per screen', default: 10, min: 1, step: 1, stat: 'ores_per_screen' },
          mult('oreIncome', 'Ore income multi', 'ore_income_multi'),
          pct('goc', 'Golden ore chance', 'golden_ore_chance'), mult('gom', 'Golden ore multi', 'golden_ore_multi'),
          pct('roc', 'Rainbow ore chance', 'rainbow_ore_chance'), mult('rom', 'Rainbow ore multi', 'rainbow_ore_multi'),
          pct('gfc', 'Golden floor chance', 'golden_floor_chance'), mult('gfm', 'Golden floor multi', 'golden_floor_multi'),
          pct('rfc', 'Rainbow floor chance', 'rainbow_floor_chance'), mult('rfm', 'Rainbow floor multi', 'rainbow_floor_multi'),
          pct('galfc', 'Galactic floor chance', 'galactic_floor_chance'), mult('galfm', 'Galactic floor multi', 'galactic_floor_multi'),
          pct('pfc', 'Prismatic floor chance', 'prismatic_floor_chance'), mult('pfm', 'Prismatic floor multi', 'prismatic_floor_multi'),
        ],
      },
      VOID_SECTION,
    ];
  },
  compute(v) {
    const s = farmStatsFrom(v);
    const ore = Number(str(v, 'ore')) || 1;
    const cap = floorCap(num(v, 'worlds'), bool(v, 'showW4'), ore);
    const rates = floorRates(s, ore).filter((r) => r.floor.floor <= cap);
    const name = FLOOR_ORES[ore - 1]?.name ?? '?';
    const byBase = rates.filter((r) => r.base > 0).sort((a, b) => b.base - a.base);
    const byVoid = rates.filter((r) => r.void > 0).sort((a, b) => b.void - a.void);
    const perfect = perfectRate(s);
    const useVoid = s.voidChance > 0;
    const bestBase = byBase[0];
    const bestVoid = byVoid[0];
    if (!bestBase && !bestVoid) {
      return { outputs: [{ label: `Best floor for ${name}`, value: 'Not reachable with your unlocked worlds', tone: 'bad' }] };
    }
    const voidWins = useVoid && bestVoid && (!bestBase || bestVoid.void > bestBase.base);
    const best = voidWins ? { floor: bestVoid.floor.floor, rate: bestVoid.void } : { floor: bestBase.floor.floor, rate: bestBase.base };
    const tag = (f: FloorInfo) => {
      const t: string[] = [];
      if (f.goldenFloor !== undefined) t.push(`gold ${formatPct(f.goldenFloor, 0)}`);
      if (f.rainbow !== 1) t.push(`rainbow ×${f.rainbow}`);
      if (f.goreMult !== 1) t.push(`g.ore ×${f.goreMult}`);
      if (f.prismatic) t.push(`prism ${formatPct(f.prismatic, 0)}`);
      if (f.portal !== 1) t.push(`portal ×${f.portal}`);
      if (f.speed !== 1) t.push(`speed ×${f.speed}`);
      return t.join(', ') || '—';
    };
    const ores = (f: FloorInfo) => `${FLOOR_ORES[f.oreA - 1]?.name ?? '?'} ${formatPct(f.shareA, 0)} / ${FLOOR_ORES[f.oreB - 1]?.name ?? '?'} ${formatPct(1 - f.shareA, 0)}`;

    return {
      outputs: [
        { label: `Best floor for ${name}`, value: `Floor ${best.floor}`, tone: 'primary', help: voidWins ? 'With the void drone' : useVoid ? 'Without the void drone' : undefined },
        { label: `${name} per hour`, value: formatBig(best.rate) },
        ...(useVoid ? [{ label: 'Use the void drone?', value: voidWins ? 'Yes' : 'No', tone: voidWins ? ('good' as const) : undefined }] : []),
        ...(bestBase ? [{ label: 'Best floor, no void', value: `${bestBase.floor.floor} · ${formatBig(bestBase.base)}/h` }] : []),
        { label: 'vs. a perfect floor', value: formatPct(best.rate / perfect, 0), help: 'A floor where every rock is this ore.' },
      ],
      tables: [
        ...(useVoid
          ? [{
              title: 'Top floors with void drone',
              columns: ['Floor', `${name}/h`, 'Rocks', 'Specials'],
              rows: byVoid.slice(0, 10).map((r) => [r.floor.floor, formatBig(r.void), ores(r.floor), tag(r.floor)]),
            }]
          : []),
        {
          title: 'Floors that spawn it directly',
          columns: ['Floor', `${name}/h`, 'Rocks', 'Specials'],
          rows: byBase.map((r) => [r.floor.floor, formatBig(r.base), ores(r.floor), tag(r.floor)]),
        },
      ],
      notes: [
        'Special floors (golden, rainbow, portal and speed changes) come from the original sheet\'s floor table.',
        'The original also flags floors where your bombs can\'t one-shot the ores; that check isn\'t ported yet.',
      ],
    };
  },
};
