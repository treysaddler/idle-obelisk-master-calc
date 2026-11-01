// Expected values are the cached results from the original sheets/pages.
import { describe, expect, it } from 'vitest';
import { cherryVsD20 } from './cherry';
import { contractPoints, normCdf, upgradeCost } from './contracts';
import upgrades from '../data/contractUpgrades.json';
import { chanceWithin, DRONES, expectedTime } from './droneCards';
import { froggerRates } from './frogger';
import { obeliskFight } from './obeliskFight';
import { pickaxeDamage } from './pickaxe';
import { distribute, RARITIES, relicTotals } from './relics';
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
