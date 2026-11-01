import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lootbugs, spawnRateWithoutBear, type LootbugInputs } from './lootbugs';

const base: LootbugInputs = {
  obeliskLevel: 40, gameSpeed: 2, spawnRate: 1, tripleChance: 0, goldenChance: 0, bankCap: 10,
  costReduction: 0, lootMulti: 1, archHighStage: 0, stoneVeinResearched: true, telescope: false, autoCatch75: false,
  bear: { fueled: false, grade: 0, fuelGemsPerHour: 0 }, buys: {},
};

describe('lootbug engine', () => {
  it('spawns 3 bugs per game-hour and splits the free table by weight', () => {
    const r = lootbugs(base);
    expect(r.basePerHour).toBe(6);
    // Free table without telescope: weights 30+35+5+20+15+15+20+16 = 156.
    expect(r.pure.loot.itemChests).toBeCloseTo(6 * (35 / 156), 10);
    expect(r.pure.loot.gems).toBeCloseTo(6 * (30 / 156) * 2, 10);
    // Buff minutes are game time; the sheet divides by game speed. 2x speed counts double.
    expect(r.pure.loot.oreMinutes).toBeCloseTo((6 * (15 / 156) * 2) / 2, 10);
    expect(r.pure.loot.speedMinutes).toBeCloseTo((6 * (15 / 156) * 4) / 2, 10);
    expect(r.bankFullMinutes).toBe(100);
  });

  it('charges gems only for buffs you buy, and golden bugs get them free', () => {
    const r = lootbugs({ ...base, goldenChance: 0.25, buys: { itemChests: true } });
    // Gem table at ob 40 (arch + fishing unlocked, no telescope): 14+10+24+3+24+20+8+11 = 114.
    const paidItemBugs = 6 * 0.75 * (14 / 114);
    const goldItemBugs = 6 * 0.25 * (14 / 114);
    expect(r.pure.gemsSpent).toBeCloseTo(paidItemBugs * 15, 10);
    expect(r.pure.loot.itemChests).toBeCloseTo(6 * (35 / 156) + (paidItemBugs + goldItemBugs) * 3, 10);
    // Unbought buffs from paid bugs don't count; golden ones do.
    expect(r.pure.loot.relicChests).toBeCloseTo(6 * (5 / 156) + 6 * 0.25 * (10 / 114), 10);
  });

  it('scales paid timed buffs by the useful-uptime factor', () => {
    const full = lootbugs({ ...base, buys: { ore: true } });
    const half = lootbugs({ ...base, buys: { ore: 0.5 } });
    expect(half.pure.gemsSpent).toBeCloseTo(full.pure.gemsSpent / 2, 10);
    const free = lootbugs(base).pure.loot.oreMinutes;
    expect(half.pure.loot.oreMinutes - free).toBeCloseTo((full.pure.loot.oreMinutes - free) / 2, 10);
  });

  it('uses the sheet\'s Bear table weights', () => {
    const r = lootbugs({ ...base, goldenChance: 1, bear: { fueled: true, grade: 0, fuelGemsPerHour: 0 } });
    // Bear gem table at ob 40: 14+10+24+8+24+20+10+10 = 120; regular: 114.
    expect(r.bear.loot.bombMinutes).toBeCloseTo((6 * 0.3 * (8 / 120) * 2) / 2, 10);
    expect(r.pure.loot.bombMinutes).toBeCloseTo((6 * (3 / 114) * 2) / 2, 10);
  });

  it('applies triple spawns, unlock gates, and the bear drone', () => {
    const r = lootbugs({ ...base, tripleChance: 0.5, bear: { fueled: true, grade: 10, fuelGemsPerHour: 3 } });
    expect(r.pure.spawns).toBeCloseTo(6 * 2, 10);
    expect(r.bearPerHour).toBeCloseTo(6 * 0.6, 10);
    expect(lootbugs({ ...base, obeliskLevel: 16, tripleChance: 0.5 }).pure.spawns).toBe(6); // triple needs ob 17
    expect(spawnRateWithoutBear(2.6, true, 10)).toBeCloseTo(2.6 / 1.6, 10);
  });
});

// Local-only: run the module on a real EXPORTSTATS if one is present (it is git-ignored).
const statsPath = new URL('../data/example-stats.json', import.meta.url);
describe.skipIf(!existsSync(statsPath))('lootbug engine on local EXPORTSTATS', () => {
  it('gives finite, sensible results', () => {
    const s = JSON.parse(readFileSync(statsPath, 'utf-8')).stats;
    const bearFueled = !!s.is_drone_bear_equipped_and_fueled;
    const r = lootbugs({
      obeliskLevel: s.obelisk_level, gameSpeed: s.game_speed_multi,
      spawnRate: spawnRateWithoutBear(s.lootbug_spawn_rate, bearFueled, s.bear_fuel_grade),
      tripleChance: s.lootbug_triple_chance / 100, goldenChance: s.lootbug_golden_chance / 100,
      bankCap: s.lootbug_bank_cap, costReduction: s.lootbug_gem_cost_reduction, lootMulti: s.lootbug_loot_multi,
      archHighStage: 0, stoneVeinResearched: s.vein_researched_array >= 1, telescope: s.stars_star_level_array[0] > 0,
      autoCatch75: s.star_auto_catch_chance > 75, bear: { fueled: bearFueled, grade: s.bear_fuel_grade, fuelGemsPerHour: 0 }, buys: {},
    });
    for (const v of Object.values(r.pure.loot)) expect(Number.isFinite(v)).toBe(true);
    expect(r.pure.loot.gems).toBeGreaterThan(0);
    expect(r.bankFullMinutes).toBeGreaterThan(0);
  });
});
