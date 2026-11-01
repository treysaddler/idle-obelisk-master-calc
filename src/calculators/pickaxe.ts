import { formatBig, formatNum } from '../lib/format';
import { bool, num, str, type CalculatorDef, type Field, type Section, type Values } from '../lib/types';

const n = (id: string, label: string, max?: number, extra: Partial<Field> = {}): Field =>
  ({ kind: 'number', id, label, default: 0, min: 0, step: 1, max, ...extra }) as Field;
const b = (id: string, label: string, help?: string): Field => ({ kind: 'bool', id, label, default: false, help });

const STATUE_TIERS = ['None', 'Built', 'Gilded', 'Platinised'].map((s) => ({ value: s, label: s }));

/** Group multipliers, in the same structure as the original sheet. */
export function pickaxeGroups(v: Values) {
  const B = (id: string) => num(v, id);
  const F = (id: string) => num(v, id);
  const T = (id: string) => (bool(v, id) ? 1 : 0);
  const poly = B('polyBonus');

  const artifacts = 1 + F('art10') * 0.1 + F('art25') * 0.25 + F('art60') * 0.6 + F('artStatue') * 0.1 * B('totalStatues');
  const primal = T('primalMeat') * (1 + T('goldenPrimalMeat'));
  const burger = T('hamburger') ? (3 + 0.12 * B('hamburgerWorkshop')) * (1 + T('goldenHamburger')) : 1;
  const items = (1 + T('rockCake') * 0.3 + primal) * burger;
  const relics = 1 + F('relic3') * 0.03 + F('relic10') * 0.1;
  const store = (1 + F('store020') * 0.2) * (1 + T('founder') * 0.25);
  const workshop = (1 + F('ws3') * 0.03) * (1 + F('ws008') * 0.08) * (1 + F('ws010') * 0.1);
  const skills =
    (1 + T('swingHarder') * 0.2 + T('superDamage') * 0.4 + T('relicRampage') * 0.001 * B('totalRelics') + T('ultraCrits') * 2) *
    (1 + T('tonsOfDamage')) * (1 + T('polyPower') * (poly - 1)) * (1 + T('mincer') * 1.5);
  const challenges = 1 + F('chal1') * 0.01 * B('challenges') + F('chalNode') * 0.01 * B('skillNodes') + F('chalOb') * 0.02 * B('obeliskLevel');
  const cards = (1 + F('cardAlex')) * (1 + F('cardDwarf')) * (1 + F('cardBear'));
  const pets = (1 + F('dwarf') * 0.2 + F('whale') * 0.1 + T('dwarfSkin') * 0.5) * (1 + F('dino') * 0.2);
  const tier = (id: string, vals: number[]) => vals[Math.max(0, ['None', 'Built', 'Gilded', 'Platinised'].indexOf(str(v, id)))];
  const construct =
    (1 + (str(v, 'comfort') === 'Built' ? 0.5 * B('w4Statues') : 0) + (str(v, 'rodentia') === 'Built' ? 0.6 * B('w4Statues') : 0)) *
    tier('rhythm', [1, 3, 5, 8]) * tier('craftmanship', [1, 4, 25, 125]);
  const stars = 1 + F('taurus') * 0.12 + F('scorpio') * 0.15;
  const fishing = 1 + 0.15 * F('fish015');
  const base = ((F('baseDamage') + 1) * (F('baseDamage') + 2)) / 2;
  const upgrades =
    base *
    (1 + F('upRunite') * 0.1 + F('upAmethyst') * 0.15 + F('upDemonite') * 0.2 + F('upEarth') * 0.28 + F('upBlasph') * 0.35 +
      F('upCranium') * 0.01 * B('totalCards') + F('upTwinkle') * 0.05 * B('totalStatues') + F('upIcebloom') * 0.08 * B('totalStatues') +
      (F('upBloodOnyx') * 0.02 * (poly - 1)) / 0.03) *
    (1 + F('upMacaw') * 0.02) * (1 + F('upOmelet') * 0.04) * (1 + F('upCognite') * 0.06) * (1 + F('upChronite') * 0.1) * (1 + F('upCarpet') * 0.08);
  const contracts = (1 + F('con1') * 0.01 * B('contracts') + F('con15') * 0.15) * (1 + F('con008') * 0.08);

  return { artifacts, items, relics, store, workshop, skills, challenges, cards, pets, construct, stars, fishing, upgrades, contracts };
}

export function pickaxeDamage(v: Values) {
  const g = pickaxeGroups(v);
  return Math.round(Object.values(g).reduce((a, x) => a * x, 1));
}

function sections(v: Values): Section[] {
  const B = (id: string) => num(v, id);
  const upCap = (extra: number) => B('upLunarium') + B('upPinguinus') + extra;
  const conCap = (extra: number) => B('contractCap') + extra;
  return [
    {
      title: 'Your progress',
      note: 'These feed the "per statue / per card / per contract" bonuses and the upgrade caps below.',
      fields: [
        n('artifactCap', 'Artifact cap upgrades', 7),
        n('t4ArtifactCap', 'T4 artifact cap upgrades', 20),
        n('totalStatues', 'Total statues', 63),
        n('workshopCap', 'Workshop cap upgrades', 22),
        n('gemUpgradeCap', 'Gem upgrade cap', 12),
        n('totalRelics', 'Total relics', undefined, { big: true }),
        { kind: 'number', id: 'polyBonus', label: 'Polychrome power bonus', default: 1, min: 1, step: 0.01, help: 'The multiplier shown for Polychrome Power, e.g. 1.6.' },
        n('challenges', 'Challenges completed', 90),
        n('skillNodes', 'Skill-tree nodes unlocked', 64),
        n('obeliskLevel', 'Obelisk level', 70),
        n('petLevelCap', 'Pet level cap upgrades', 10),
        n('xanthe', 'Xanthe', 5),
        n('w4Statues', 'W4 statues', 9),
        n('t1NoticeCap', 'Tier 1 notice cap', 15),
        n('totalCards', 'Total cards', 1412 + (bool(v, 'founder') ? 3 : 0)),
        n('contractCap', 'Contract cap upgrades', 14),
        n('contracts', 'Contracts completed', undefined, { big: true }),
      ],
    },
    {
      title: 'Artifacts',
      fields: [
        n('art10', 'Pickaxe damage +10%', 25 + B('artifactCap')),
        n('art25', 'Pickaxe damage +25%', 25 + B('artifactCap')),
        n('art60', 'Pickaxe damage +60%', 25 + B('artifactCap')),
        n('artStatue', 'Pickaxe damage per statue +10%', 25 + B('artifactCap') + B('t4ArtifactCap')),
      ],
    },
    {
      title: 'Items',
      fields: [
        b('rockCake', 'Rock Cake'),
        b('primalMeat', 'Primal Meat'),
        b('goldenPrimalMeat', 'Golden Primal Meat'),
        b('hamburger', 'Hamburger'),
        b('goldenHamburger', 'Golden Hamburger'),
        n('hamburgerWorkshop', 'Hamburger workshop upgrade', 25 + B('workshopCap')),
      ],
    },
    { title: 'Relics', fields: [n('relic3', 'Pickaxe damage +3% relics', undefined, { big: true }), n('relic10', 'Pickaxe damage +10% relics', undefined, { big: true })] },
    {
      title: 'Store',
      fields: [n('store020', 'Pickaxe damage +0.20x', 10 + B('gemUpgradeCap')), b('founder', 'Founder bundle')],
    },
    {
      title: 'Workshop',
      fields: [
        n('ws3', 'Pickaxe damage +3%', 20 + B('workshopCap')),
        n('ws008', 'Pickaxe damage +0.08x', 25 + B('workshopCap')),
        n('ws010', 'Pickaxe & bomb damage +0.10x', 30 + B('workshopCap')),
      ],
    },
    {
      title: 'Skills',
      fields: [
        b('swingHarder', 'Swing Harder'),
        b('superDamage', 'Super Damage'),
        b('relicRampage', 'Relic Rampage'),
        b('ultraCrits', 'Wait My Ultra Crits Can Crit?'),
        b('tonsOfDamage', 'Tons of Damage'),
        b('polyPower', 'Polychrome Power'),
        b('mincer', 'Idle Obelisk Mincer'),
      ],
    },
    {
      title: 'Challenges',
      fields: [
        n('chal1', 'Per challenge complete +1%', 3),
        n('chalNode', 'Per skill-tree node +1%', 3),
        n('chalOb', 'Per obelisk level +2%', 3),
      ],
    },
    {
      title: 'Cards',
      note: 'Enter each card bonus as a fraction, e.g. 0.5 for +50%.',
      fields: [
        n('cardAlex', 'Alex misc card', undefined, { step: 0.01 }),
        n('cardDwarf', 'Infernal Dwarf pet card', undefined, { step: 0.01 }),
        n('cardBear', 'Infernal Bear drone card', undefined, { step: 0.01 }),
      ],
    },
    {
      title: 'Pets',
      fields: [
        n('dwarf', 'Dwarf level', 10 + B('petLevelCap')),
        n('whale', 'Whale level', 10 + B('petLevelCap')),
        n('dino', 'Dino level', 10 + B('petLevelCap') + B('xanthe')),
        b('dwarfSkin', 'Dwarf skin'),
      ],
    },
    {
      title: 'Construct',
      fields: [
        { kind: 'select', id: 'rhythm', label: 'Statue of Rhythm', default: 'None', options: STATUE_TIERS },
        { kind: 'select', id: 'craftmanship', label: 'Statue of Craftmanship', default: 'None', options: STATUE_TIERS },
        { kind: 'select', id: 'comfort', label: 'Statue of Comfort', default: 'None', options: STATUE_TIERS.slice(0, 2) },
        { kind: 'select', id: 'rodentia', label: 'Statue of Rodentia', default: 'None', options: STATUE_TIERS.slice(0, 2) },
      ],
    },
    { title: 'Stargazing', fields: [n('taurus', 'Taurus level', 22), n('scorpio', 'Scorpio level', 117)] },
    { title: 'Fishing', fields: [n('fish015', 'Pickaxe & bomb damage +0.15x', 25 + B('t1NoticeCap'))] },
    {
      title: 'Upgrades',
      fields: [
        n('baseDamage', 'Base damage', 155),
        n('upLunarium', 'Increase upgrade caps +1 (Lunarium)', 3),
        n('upPinguinus', 'Increase upgrade caps +1 (Pinguinus)', 3),
        n('upRunite', '+10% (Runite)', upCap(10)),
        n('upAmethyst', '+15% (Amethyst)', upCap(10)),
        n('upDemonite', '+20% (Demonite)', upCap(10)),
        n('upEarth', '+28% (Earth-C-137)', upCap(10)),
        n('upBlasph', '+35% (Blasphemite)', upCap(15)),
        n('upCranium', 'Per card owned +1% (Cranium)', upCap(10)),
        n('upTwinkle', 'Per statue +5% (Twinklestone)', upCap(94)),
        n('upIcebloom', 'Per statue +8% (Icebloom)', upCap(94)),
        n('upMacaw', '+0.02x (Macawrock)', upCap(44)),
        n('upBloodOnyx', 'Per poly card +2% (Blood Onyx)', upCap(44)),
        n('upOmelet', '+0.04x (Omeletite)', upCap(44)),
        n('upCognite', 'Pickaxe & bomb +0.06x (Cognite)', upCap(44)),
        n('upChronite', '+0.1x (Chronite)', upCap(44)),
        n('upCarpet', 'Pickaxe & bomb +0.08x (Carpetite)', upCap(44)),
      ],
    },
    {
      title: 'Contracts',
      fields: [
        n('con1', 'Per contract complete +1%', conCap(1)),
        n('con15', 'Pickaxe damage +15%', conCap(3)),
        n('con008', 'Pickaxe damage +0.08x', conCap(5)),
      ],
    },
  ];
}

const LABELS: Record<string, string> = {
  artifacts: 'Artifacts', items: 'Items', relics: 'Relics', store: 'Store', workshop: 'Workshop', skills: 'Skills',
  challenges: 'Challenges', cards: 'Cards', pets: 'Pets', construct: 'Construct', stars: 'Stargazing', fishing: 'Fishing',
  upgrades: 'Upgrades (incl. base)', contracts: 'Contracts',
};

export const pickaxeCalc: CalculatorDef = {
  id: 'pickaxe-damage',
  title: 'Pickaxe Damage',
  category: 'Costs & Gains',
  summary: 'Adds up every source of pickaxe damage so you can see what an upgrade is worth.',
  source: { name: "Pickaxe Damage Calculator (Minnie's Version)", author: 'Minnie', url: 'https://docs.google.com/spreadsheets/d/1IHgJtGmvgRwF7UzIqPF9aM2S4dzNOREdHF_XyhXS39M/edit?usp=sharing' },
  sections,
  compute(v) {
    const g = pickaxeGroups(v);
    const total = pickaxeDamage(v);
    return {
      outputs: [{ label: 'Total pickaxe damage', value: formatBig(total), tone: 'primary', help: total < 1e15 ? total.toLocaleString('en-US') : total.toExponential(3) }],
      tables: [{
        title: 'Multiplier by source',
        columns: ['Source', 'Multiplier'],
        rows: Object.entries(g).map(([k, x]) => [LABELS[k], '×' + formatNum(x, 3)]),
      }],
      notes: ['Max values on each field come from the original sheet (game version 2.0.x) and may lag behind the game.'],
    };
  },
};
