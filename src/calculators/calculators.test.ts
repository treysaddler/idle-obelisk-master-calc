// Expected values are the cached results from the original sheets/pages.
import { describe, expect, it } from 'vitest';
import { baseGameSpeed, FLOOR_ORES, floorRates, FLOORS, perfectRate, portalValue, type FarmStats } from './bestFloor';
import { portalWeight, variantMulti, veinFloorRates, VEINS, type VeinStats } from './bestVeins';
import { cherryVsD20 } from './cherry';
import { contractPoints, normCdf, upgradeCost } from './contracts';
import upgrades from '../data/contractUpgrades.json';
import { chanceWithin, DRONES, expectedTime } from './droneCards';
import { froggerRates } from './frogger';
import { obeliskFight } from './obeliskFight';
import { pickaxeDamage } from './pickaxe';
import { binomialAtLeast, distribute, DIVINE_CHANCE, divineRerollPlan, RARITIES, relicTotals } from './relics';
import { pathCost, skillPath } from './skills';
import { transmuterBreakpoint } from './transmuter';
import { dronePointsGold, levelExp, prestigePoints } from './wiki';
import { formatBig, formatDuration, parseNumber } from '../lib/format';

describe('format', () => {
  it('parses game notation', () => {
    expect(parseNumber('326oc')).toBeCloseTo(3.26e29, -20);
    expect(parseNumber('1.5k')).toBe(1500);
    expect(parseNumber('3.26e29')).toBe(3.26e29);
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('12zz')).toBeNaN();
  });
  it('formats', () => {
    expect(formatBig(17.3e9)).toBe('17.3b');
    expect(formatBig(999)).toBe('999');
    expect(formatDuration(3 * 86400 + 3600 * 2 + 60 * 5)).toBe('3d 2h 5m');
  });
});

describe('wiki calculators', () => {
  it('match the wiki defaults', () => {
    expect(formatBig(levelExp(100), 1)).toBe('17.3b');
    expect(formatBig(prestigePoints(100, 1), 1)).toBe('17.1k');
    expect(dronePointsGold(100, 100)).toBe(12475); // wiki shows "12.5k"
  });
});

describe('pickaxe damage', () => {
  it('is 1 with nothing set and scales base damage', () => {
    expect(pickaxeDamage({})).toBe(1);
    expect(pickaxeDamage({ baseDamage: 155, polyBonus: 1 })).toBe((156 * 157) / 2);
  });
});

describe('skill points', () => {
  it('sums the path from owned to wanted', () => {
    // Stars lvl3 (88) from Frog Frenzy lvl1 (82): 950 + 1188 + 1485
    expect(pathCost(82, 88)).toBe(3623);
    expect(skillPath(88).map((s) => s.id).slice(0, 4)).toEqual([88, 87, 86, 82]);
    expect(pathCost(75, 88)).toBeNaN();
  });
});

describe('frogger', () => {
  it('matches the sheet sample', () => {
    const rows = froggerRates({
      fuelDurationMulti: 2.08, fuelSaveChance: 0.25, freeBombChance: 0.2, d20Charges: 50, cherryTripleChance: 0.1,
      gemBombChance: 0.035, cherryBattery: true, froggerLevel: 14, gameSpeed: 3.27,
    });
    expect(rows[0].netPerHour).toBeCloseTo(-63.29093624, 6);
    expect(rows[4].netPerHour).toBeCloseTo(0.05468015346, 8);
    expect(rows[45].netPerHour).toBeCloseTo(291.4267198, 5);
    expect(rows[0].breakEvenInterval).toBeCloseTo(4.168985417, 8);
  });
});

describe('drone cards', () => {
  it('matches the sheet sample (speed 6.24, 8h)', () => {
    const bear = DRONES[0];
    expect(+(chanceWithin(bear.card, 8, 6.24) * 100).toFixed(2)).toBe(87.51);
    expect(+(chanceWithin(bear.poly, 8, 6.24) * 100).toFixed(2)).toBe(93.56);
    expect(+(chanceWithin(bear.infernal, 8, 6.24) * 100).toFixed(2)).toBe(30.51);
    expect(+(expectedTime(bear.card, 6.24) / 3600).toFixed(2)).toBe(3.85);
    expect(+(chanceWithin(DRONES[9].card, 8, 6.24) * 100).toFixed(2)).toBe(29.3);
  });
});

describe('contracts', () => {
  it('matches the average points sample', () => {
    const r = contractPoints({ base: 19, x2: 68, x3: 76, x5: 12, x10: 13.26 });
    expect(r.average).toBeCloseTo(261.1217081, 6);
    expect(r.sd).toBeCloseTo(598.0934851, 5);
    expect(+normCdf((1390000 - r.average * 5003) / (Math.sqrt(5003) * r.sd)).toFixed(2)).toBe(0.98);
  });
  it('matches the upgrade cost sample', () => {
    // Sheet: Triple Craft Chance level 16 costs 399 at a 0.13 multiplier.
    expect(upgradeCost(upgrades[1] as never, 0, 16, 0.13)).toBe(399);
    expect(upgradeCost(upgrades[0] as never, 0, 3, 0.13)).toBe(262);
  });
});

describe('relics', () => {
  it('matches the Data tab for 400k relic chests', () => {
    const [common, rare, epic, , mythic] = relicTotals(400000, 12, 0);
    // The sheet's common stages forget to subtract the Bomb Damage row (SUM(K3:K7) skips row 8),
    // double-counting relics; we keep the total equal to the pool instead.
    expect(common.counts.reduce((a, b) => a + b, 0)).toBeCloseTo(common.pool, 6);
    expect(common.counts[0]).toBeCloseTo(57335.41667, 3);
    // Rare: the sheet's totals drop the last stage (SUM(H13:L13) skips column M).
    expect(rare.counts.reduce((a, b) => a + b, 0)).toBeCloseTo(rare.pool, 6);
    expect(rare.counts[4]).toBeCloseTo(2500, 6);
    expect(epic.counts[0]).toBeCloseTo(52700, 3);
    expect(mythic.counts[1]).toBeCloseTo(3742, 3);
  });
  it('matches DivineChest Calc odds', () => {
    expect(binomialAtLeast(1, 110000, DIVINE_CHANCE)).toBeCloseTo(0.9877237405, 9);
    expect(binomialAtLeast(5, 110000, DIVINE_CHANCE)).toBeCloseTo(0.4488177254, 9);
    const plan = divineRerollPlan({ relicChests: 110000, divineChests: 0, current: 13, gems: 305000 });
    expect(plan.rerolls).toBe(1525);
    expect(+(plan.nextProb * 100).toFixed(1)).toBe(26.4);
    expect(plan.nextGems).toBe(994600);
    expect(plan.verdict).toBe('Probably not worth it');
  });
  it("matches Rody's exact-count odds with guaranteed divine chests", () => {
    // 370k relics + 18 divine chests: P(exactly 32 divines) = P(14 rolled).
    const exact = binomialAtLeast(14, 370000, DIVINE_CHANCE) - binomialAtLeast(15, 370000, DIVINE_CHANCE);
    expect(exact).toBeCloseTo(0.1036824312, 9);
    expect(binomialAtLeast(38 - 18, 370000, DIVINE_CHANCE) - binomialAtLeast(39 - 18, 370000, DIVINE_CHANCE)).toBeCloseTo(0.03904336374, 9);
  });
  it('respects caps', () => {
    const got = distribute(RARITIES[0].types, 1e7);
    expect(got[2]).toBeCloseTo(100);
  });
});

describe('cherry vs d20', () => {
  it('prefers gem with default inputs below the W4 statue breakpoint', () => {
    const r = cherryVsD20({ freeBombChance: 0.2, d20Charges: 50, tripleCherryChance: 0.14, founderBomb: true });
    expect(r.cherryGem).toBeGreaterThan(r.cherryD20);
  });
});

describe('transmuter', () => {
  it('picks an ore breakpoint', () => {
    const r = transmuterBreakpoint({ free: 20, x2: 50, x3: 30, x5: 10, x10: 5, x20: 1, x100: 0, craftCost: 0.5, bop: 3, trans: 2, transBop: 10, bopGold: 0, goldChance: 1, goldMult: 3 });
    expect(r.costTransition).toBeGreaterThan(0);
    expect(r.lowOre).toBeDefined();
  });
});

describe('best floor', () => {
  const base: FarmStats = {
    oresPerScreen: 10, oreIncome: 1, baseSpeed: 1, fishingNoticeW3: false, w4Quests: 0,
    goldenFloorChance: 0, goldenFloorMulti: 1, rainbowFloorChance: 0, rainbowFloorMulti: 1,
    galacticFloorChance: 0, galacticFloorMulti: 1, prismaticFloorChance: 0, prismaticFloorMulti: 1,
    goldenOreChance: 0, goldenOreMulti: 1, rainbowOreChance: 0, rainbowOreMulti: 1,
    voidChance: 0, voidBaseMulti: 1, voidMulti: 0, goldenVoidChance: 0, goldenVoidMulti: 1,
    rainbowVoidChance: 0, rainbowVoidMulti: 1, galacticVoidChance: 0, galacticVoidMulti: 1,
  };
  it('lays out floors like the sheet', () => {
    expect(FLOORS[0]).toMatchObject({ oreA: 1, oreB: 2, shareA: 0.8, world: 1 });
    expect(FLOORS[48]).toMatchObject({ oreA: 31, oreB: 32, world: 2 });
    expect(FLOOR_ORES[FLOORS[48].oreA - 1].name).toBe('Sandcasium');
    expect(FLOORS[70]).toMatchObject({ goldenFloor: 0.5, speed: 0.75 });
    expect(FLOORS[122]).toMatchObject({ prismatic: -0.15, speed: 0.6 });
  });
  it('matches the cached Floors values for Tin', () => {
    const r = floorRates(base, 1);
    expect(r[0].base).toBe(23040);
    expect(r[1].base).toBe(14400);
    expect(r[2].base).toBe(0);
    expect(perfectRate(base)).toBe(28800);
  });
  it('credits void portals by tier', () => {
    const s = { ...base, voidChance: 0.1, voidMulti: 3 };
    expect(portalValue(s)).toBeCloseTo(0.3);
    // Floor 49 has no Tin, but portals turn rocks into Tin: 0.8/31 + 0.2/32 of portal rocks.
    const r = floorRates(s, 1)[48];
    expect(r.base).toBe(0);
    expect(r.void).toBeCloseTo(10 * 0.3 * (0.8 / 31 + 0.2 / 32) * 2880, 6);
    // Sheet's cached portal share for floor 49 / Tin.
    expect(0.8 / 31 + 0.2 / 32).toBeCloseTo(0.03205645161, 10);
  });
  it('removes floor speed modifiers from exported speed', () => {
    expect(baseGameSpeed(3, 71, true, 0)).toBeCloseTo(4); // floor 71 is -25%
    expect(baseGameSpeed(1.4, 80, false, 0)).toBeCloseTo(2); // W3 without fishing notice is 70%
  });
});

describe('best floor for veins', () => {
  const farm = {
    oresPerScreen: 10, oreIncome: 1, baseSpeed: 1, fishingNoticeW3: false, w4Quests: 0,
    goldenFloorChance: 0, goldenFloorMulti: 1, rainbowFloorChance: 0, rainbowFloorMulti: 1,
    galacticFloorChance: 0, galacticFloorMulti: 1, prismaticFloorChance: 0, prismaticFloorMulti: 1,
    goldenOreChance: 0, goldenOreMulti: 1, rainbowOreChance: 0, rainbowOreMulti: 1,
    voidChance: 0, voidBaseMulti: 1, voidMulti: 0, goldenVoidChance: 0, goldenVoidMulti: 1,
    rainbowVoidChance: 0, rainbowVoidMulti: 1, galacticVoidChance: 0, galacticVoidMulti: 1,
  };
  const vs: VeinStats = {
    oresPerScreen: 10, spawnRate: 1, income: 1, goldenChance: 0, goldenMulti: 1, rainbowChance: 0, rainbowMulti: 1,
    gleamingChance: 0, gleamingMulti: 1, morphChance: 0, morphGoldenChance: 0, doubleSpawn: false,
  };
  it('matches the cached sheet values for Stone Vein', () => {
    const r = veinFloorRates(farm, vs, VEINS[0]);
    expect(r[0].base).toBeCloseTo(192, 9); // 10 ores, 1/15 rarity... capped at spawn rate / rarity
    expect(r[8].base).toBe(0); // floor 9 is outside the zone
    expect(portalWeight(VEINS[0], 39)).toBeCloseTo(0.1282051282, 9);
    const f39 = FLOORS[38];
    expect(portalWeight(VEINS[0], f39.oreA) * f39.shareA + portalWeight(VEINS[0], f39.oreB) * (1 - f39.shareA)).toBeCloseTo(0.2066666667, 9);
  });
  it('applies variants and void portals', () => {
    expect(variantMulti({ ...vs, goldenChance: 0.5, goldenMulti: 3, rainbowChance: 0.5, rainbowMulti: 2 })).toBeCloseTo(0.5 + 0.25 * 3 + 0.25 * 6);
    const withVoid = veinFloorRates({ ...farm, voidChance: 0.5, voidMulti: 2 }, vs, VEINS[0]);
    // Floor 39: half the rocks become portals worth 2x, of which 0.2067 roll Stone Vein ores.
    expect(withVoid[38].void).toBeCloseTo((1 / 15) * 2880 * 0.5 * 0.2066666667 * 2, 4);
  });
});

describe('obelisk fight', () => {
  it('counts attacks', () => {
    const r = obeliskFight(
      { damage: 1000, attackSpeed: 2, critChance: 50, critDamage: 2, superChance: 0, superDamage: 1, ultraChance: 0, ultraDamage: 1, omegaChance: 0, omegaDamage: 1, gameSpeed: 2, timerAdd: 1, cooldownMulti: 1 },
      1e6, 0,
    );
    // per hit 1500, dps 3000, fight 15s, per fight 3000*15*2 = 90000
    expect(r.perFight).toBe(90000);
    expect(r.attacks).toBe(12);
    expect(r.cooldown).toBe(600);
  });
});
