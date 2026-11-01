import { formatBig, formatDuration, formatInt, formatPct } from '../lib/format';
import { bool, num, type CalculatorDef, type Field, type Values } from '../lib/types';

export interface PickStats {
  damage: number;
  attackSpeed: number;
  /** Chances in percent, damage as multipliers. */
  critChance: number; critDamage: number;
  superChance: number; superDamage: number;
  ultraChance: number; ultraDamage: number;
  omegaChance: number; omegaDamage: number;
  gameSpeed: number;
  timerAdd: number;
  cooldownMulti: number;
}

/** Expected damage per attack and fight timings. Each crit tier only rolls if the one before it hit. */
export function obeliskFight(s: PickStats, hp: number, armor: number) {
  const c = Math.min(100, s.critChance) / 100;
  const sc = Math.min(100, s.superChance) / 100;
  const u = Math.min(100, s.ultraChance) / 100;
  const o = Math.min(100, s.omegaChance) / 100;
  const hit = s.damage - armor;
  const tiers = [
    { name: 'Regular', chance: 1 - c, dmg: hit },
    { name: 'Crit', chance: c * (1 - sc), dmg: hit * s.critDamage },
    { name: 'Super crit', chance: c * sc * (1 - u), dmg: hit * s.critDamage * s.superDamage },
    { name: 'Ultra crit', chance: c * sc * u * (1 - o), dmg: hit * s.critDamage * s.superDamage * s.ultraDamage },
    { name: 'Omega crit', chance: c * sc * u * o, dmg: hit * s.critDamage * s.superDamage * s.ultraDamage * s.omegaDamage },
  ];
  const perHit = tiers.reduce((a, t) => a + t.chance * t.dmg, 0);
  const dps = s.attackSpeed * perHit;
  const fightLength = (30 * s.timerAdd) / s.gameSpeed;
  const perFight = fightLength * dps * s.gameSpeed;
  const attacks = Math.ceil(hp / perFight);
  // Cooldown starts when the fight starts, so it already covers fight length.
  const cooldown = (1200 * s.cooldownMulti) / s.gameSpeed;
  return { tiers, perHit, dps, fightLength, perFight, attacks, cooldown, totalTime: attacks * cooldown, armorTooHigh: armor > s.damage };
}

const stat = (id: string, label: string, key: string, def: number, extra: Partial<Field> = {}): Field =>
  ({ kind: 'number', id, label, default: def, min: 0, step: 0.01, stat: key, ...extra }) as Field;

// What-if contract upgrades: [id, label, contracts_array index, per-level effect, cap offset]
const CONTRACT_UPGRADES: [string, string, number, number][] = [
  ['cPerContract', '[W1] Pick damage per contract +1%', 1, 1],
  ['cSuper', '[W1] Pick super crit chance +2%', 3, 5],
  ['cCritDmg', '[W1] Pick crit damage +8%', 6, 5],
  ['c15', '[W1] Pick damage +15%', 7, 3],
  ['cUltra', '[W2] Pick & bomb ultra crit chance +1%', 14, 5],
  ['cOmega', '[W3] Pick & bomb omega crit chance +2%', 23, 15],
  ['c108', '[W3] Pick & bomb damage 1.08x', 24, 5],
];

function contractEffects(v: Values, suffix: 'Cur' | 'If') {
  const L = (id: string) => num(v, id + suffix);
  const completed = num(v, 'contracts');
  return {
    pickDamage: (1 + L('cPerContract') * completed * 0.01 + L('c15') * 0.15) * (1 + L('c108') * 0.08),
    superChance: L('cSuper') * 2,
    critDamage: L('cCritDmg') * 0.08,
    ultraChance: L('cUltra'),
    omegaChance: L('cOmega') * 2,
  };
}

function minotaur(v: Values, suffix: 'Cur' | 'If') {
  return bool(v, 'mino' + suffix) ? 1 + (1 + num(v, 'minoLevel' + suffix)) * 0.3 : 1;
}

function statsFrom(v: Values): PickStats {
  return {
    damage: num(v, 'damage'), attackSpeed: num(v, 'attackSpeed'),
    critChance: num(v, 'critChance'), critDamage: num(v, 'critDamage'),
    superChance: num(v, 'superChance'), superDamage: num(v, 'superDamage'),
    ultraChance: num(v, 'ultraChance'), ultraDamage: num(v, 'ultraDamage'),
    omegaChance: num(v, 'omegaChance'), omegaDamage: num(v, 'omegaDamage'),
    gameSpeed: num(v, 'gameSpeed'), timerAdd: num(v, 'timerAdd'), cooldownMulti: num(v, 'cooldownMulti'),
  };
}

/** Swap the current contract/minotaur bonuses for the what-if ones, like the original sheet. */
export function whatIfStats(v: Values): PickStats {
  const s = statsFrom(v);
  const cur = contractEffects(v, 'Cur');
  const wi = contractEffects(v, 'If');
  return {
    ...s,
    damage: (s.damage / Math.max(cur.pickDamage, 1)) * Math.max(wi.pickDamage, 1) / Math.max(minotaur(v, 'Cur'), 1) * Math.max(minotaur(v, 'If'), 1),
    critDamage: (s.critDamage / (1 + cur.critDamage)) * (1 + wi.critDamage),
    superChance: s.superChance - cur.superChance + wi.superChance,
    ultraChance: s.ultraChance - cur.ultraChance + wi.ultraChance,
    omegaChance: s.omegaChance - cur.omegaChance + wi.omegaChance,
  };
}

export const obeliskFightCalc: CalculatorDef = {
  id: 'obelisk-fight',
  title: 'Obelisk Fight',
  category: 'Decisions',
  summary: 'How many attacks and how long it takes to beat your current obelisk, plus a what-if for contract and Minotaur upgrades.',
  source: { name: 'Obelisk Fight Calculator v1.04', author: 'ZanyT', url: 'https://docs.google.com/spreadsheets/d/1GughZm85kNggKfgluRk36ZpkQYHLVFd1Ox9OysdIONY/edit?usp=sharing' },
  keywords: ['damage', 'armor', 'crit'],
  sections: (v) => {
    const cap = num(v, 'contractCap');
    return [
      {
        title: 'Obelisk',
        note: 'Run EXPORTSTATS on the floor you will attack from (game speed changes fight length), then tap "Fill from EXPORTSTATS".',
        fields: [
          { kind: 'number', id: 'hp', label: 'Obelisk HP remaining', default: 0, min: 0, big: true },
          { kind: 'number', id: 'armor', label: 'Obelisk armor', default: 0, min: 0, big: true },
        ],
      },
      {
        title: 'Pickaxe stats',
        fields: [
          stat('damage', 'Pickaxe damage', 'pickaxe_damage', 0, { big: true }),
          stat('attackSpeed', 'Attacks per second', 'pickaxe_attack_speed_per_second', 1),
          stat('critChance', 'Crit chance', 'pickaxe_crit_chance', 0, { suffix: '%' }),
          stat('critDamage', 'Crit damage', 'pickaxe_crit_damage', 1, { suffix: '×' }),
          stat('superChance', 'Super crit chance', 'pickaxe_super_crit_chance', 0, { suffix: '%' }),
          stat('superDamage', 'Super crit damage', 'pickaxe_super_crit_damage', 1, { suffix: '×' }),
          stat('ultraChance', 'Ultra crit chance', 'pickaxe_ultra_crit_chance', 0, { suffix: '%' }),
          stat('ultraDamage', 'Ultra crit damage', 'pickaxe_ultra_crit_damage', 1, { suffix: '×' }),
          stat('omegaChance', 'Omega crit chance', 'pickaxe_omega_crit_chance', 0, { suffix: '%' }),
          stat('omegaDamage', 'Omega crit damage', 'pickaxe_omega_crit_damage', 1, { suffix: '×' }),
          stat('gameSpeed', 'Game speed', 'game_speed_multi', 1),
          stat('timerAdd', 'Obelisk timer add', 'obelisk_timer_add', 1),
          stat('cooldownMulti', 'Obelisk cooldown multi', 'obelisk_cooldown_multi', 1),
        ],
      },
      {
        title: 'What if: contracts',
        note: 'Set "Current" to what you had at export time, then try different "What if" levels.',
        collapsed: true,
        fields: [
          { kind: 'number', id: 'contracts', label: 'Completed contracts', default: 0, min: 0, step: 1 },
          { kind: 'number', id: 'contractCap', label: 'Contract cap upgrades', default: 0, min: 0, step: 1 },
          ...CONTRACT_UPGRADES.flatMap(([id, label, idx, off]): Field[] => [
            { kind: 'number', id: id + 'Cur', label: `${label} — current`, default: 0, min: 0, step: 1, statArray: ['contracts_array', idx], statAlso: id + 'If' },
            { kind: 'number', id: id + 'If', label: `${label} — what if`, default: 0, min: 0, max: cap + off, step: 1 },
          ]),
        ],
      },
      {
        title: 'What if: Minotaur drone',
        collapsed: true,
        fields: [
          { kind: 'bool', id: 'minoCur', label: 'Minotaur equipped — current', default: false, stat: 'is_drone_minotaur_equipped', statAlso: 'minoIf' },
          { kind: 'number', id: 'minoLevelCur', label: 'Minotaur suit level — current', default: 0, min: 0, max: 15, step: 1, statArray: ['drones_suit_level_array', 11], statAlso: 'minoLevelIf' },
          { kind: 'bool', id: 'minoIf', label: 'Minotaur equipped — what if', default: false },
          { kind: 'number', id: 'minoLevelIf', label: 'Minotaur suit level — what if', default: 0, min: 0, max: 15, step: 1 },
        ],
      },
    ];
  },
  compute(v) {
    const hp = num(v, 'hp');
    const armor = num(v, 'armor');
    const now = obeliskFight(statsFrom(v), hp, armor);
    const wi = obeliskFight(whatIfStats(v), hp, armor);
    const ready = num(v, 'damage') > 0 && hp > 0;
    const attacks = (r: typeof now) => (r.armorTooHigh ? 'Armor > damage' : formatInt(r.attacks));
    const time = (r: typeof now) => (r.armorTooHigh ? '—' : formatDuration(r.totalTime));
    return {
      outputs: ready
        ? [
            { label: 'Attacks remaining', value: attacks(now), tone: now.armorTooHigh ? 'bad' : 'primary' },
            { label: 'Time remaining', value: time(now) },
            { label: 'Damage per fight', value: formatBig(now.perFight) },
            { label: 'Fight length', value: formatDuration(now.fightLength) },
            { label: 'Cooldown (incl. fight)', value: formatDuration(now.cooldown) },
            { label: 'What-if attacks', value: attacks(wi), tone: wi.attacks < now.attacks ? 'good' : undefined },
            { label: 'What-if time', value: time(wi) },
          ]
        : [{ label: 'Attacks remaining', value: 'Enter obelisk HP and pickaxe damage', tone: 'muted' }],
      tables: ready
        ? [{
            title: 'Damage by crit tier',
            columns: ['Tier', 'Chance', 'Damage', 'Share'],
            rows: now.tiers.map((t) => [t.name, formatPct(t.chance), formatBig(t.dmg), formatPct(now.perHit > 0 ? (t.chance * t.dmg) / now.perHit : 0)]),
          }]
        : [],
    };
  },
};
