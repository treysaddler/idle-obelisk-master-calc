import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { freebies, type FreebieInputs } from './freebies';
import { FOUNDER_TIERS, supplyDrops, type SupplyInputs } from './supply';

const supply: SupplyInputs = {
  founderTier: 1, worlds: 2, obeliskLevel: 50, archHighStage: 10, fishingTickSeconds: 30, gameSpeed: 2,
  stoneVeinResearched: true, telescope: false, autoCatch75: false,
};

describe('supply drops', () => {
  it('follows the founder tier table', () => {
    expect(FOUNDER_TIERS[0]).toMatchObject({ interval: 60, double: 0, triple: 0, golden: 0 });
    expect(FOUNDER_TIERS[12].interval).toBe(36);
    expect(FOUNDER_TIERS[12].double).toBeCloseTo(0.78, 10);
    expect(FOUNDER_TIERS[12].triple).toBeCloseTo(0.64, 10);
    expect(FOUNDER_TIERS[12].golden).toBeCloseTo(0.14, 10);
    expect(supplyDrops({ ...supply, founderTier: 0 }).dropsPerHour).toBe(0);
  });

  it('scales guaranteed loot by worlds and jackpots by the world multiplier', () => {
    const r = supplyDrops(supply);
    expect(r.dropsPerHour).toBe(1);
    // 10 gems x 2 worlds, plus the 1/100 jackpot (2 x (50*10+50)) and the 1/69,696 1000-gem jackpot.
    expect(r.loot.gems).toBeCloseTo(20 + 1100 / 100 + 1000 / 69696, 10);
    expect(r.loot.relicChests).toBeCloseTo(2 + (2 * 160) / 500 + 100 / 69696, 10);
    expect(r.loot.speedMinutes).toBeCloseTo((20 * 2) / 2, 10); // game minutes / game speed
    expect(r.loot.archSeconds).toBe(80);
    expect(r.loot.fishingTicks).toBe(10);
    expect(r.loot.autoCatchMinutes).toBe(0); // needs the telescope
  });

  it('applies 2x / 3x / golden crits', () => {
    const t13 = FOUNDER_TIERS[12];
    const r = supplyDrops({ ...supply, founderTier: 13 });
    const critAll = (1 + t13.double) * (1 + 2 * t13.triple) * (1 + 4 * t13.golden);
    expect(r.loot.itemChests).toBeCloseTo((60 / 36) * 2 * 2 * critAll, 10);
  });
});

const freebie: FreebieInputs = {
  cooldownSeconds: 600, gameSpeed: 2, gemsPerPack: 5, relicChance: 0.1, extraRelicChance: 0, skillShardChance: 0,
  jackpotChance: 0, refreshChance: 0, bankCap: 2,
  stonks: { chance: 0, multi: 1 }, superStonks: { chance: 0, multi: 2 }, ultraStonks: { chance: 0, multi: 25 }, sopranoTier: 0,
};

describe('freebies', () => {
  it('matches the sheet defaults (600s, 5 gems, 1x speed)', () => {
    const r = freebies({ ...freebie, gameSpeed: 1, relicChance: 0 });
    expect(r.packsPerHour).toBe(6);
    expect(r.loot.gems).toBe(30);
    expect(r.bankFullMinutes).toBe(20);
  });

  it("matches the template sheet's cached results (game speed floor 0.2)", () => {
    // MyCalc!AH1 = 1.2 packs, F60 (gems) = 6, F78 (item chests) = 1.2, AF53 (bank timer) = 100.
    const r = freebies({ ...freebie, gameSpeed: 0.2, relicChance: 0 });
    expect(r.packsPerHour).toBeCloseTo(1.2, 12);
    expect(r.loot.gems).toBeCloseTo(6, 12);
    expect(r.loot.itemChests).toBeCloseTo(1.2, 12);
    expect(r.bankFullMinutes).toBeCloseTo(100, 12);
  });

  it('adds refresh, jackpots and stonks tiers', () => {
    const r = freebies({ ...freebie, refreshChance: 0.2, jackpotChance: 0.1, stonks: { chance: 0.5, multi: 2 }, superStonks: { chance: 0.5, multi: 3 }, ultraStonks: { chance: 0.5, multi: 10 } });
    const eff = 1 / 0.8 + 0.4;
    expect(r.loot.gems).toBeCloseTo(12 * 5 * eff, 10);
    expect(r.loot.relicChests).toBeCloseTo(12 * 0.1 * eff, 10);
    // plain 0.25 x2, super 0.125 x6, ultra 0.125 x60
    const scale = 0.25 * 2 + 0.125 * 6 + 0.125 * 60;
    expect(r.loot.stonksGems).toBeCloseTo(12 * 1.25 * scale * 200, 8);
  });
});

const statsPath = new URL('../data/example-stats.json', import.meta.url);
describe.skipIf(!existsSync(statsPath))('supply and freebies on local EXPORTSTATS', () => {
  it('gives finite, sensible results', () => {
    const s = JSON.parse(readFileSync(statsPath, 'utf-8')).stats;
    const pct = (k: string) => (s[k] ?? 0) / 100;
    const f = freebies({
      ...freebie, cooldownSeconds: s.freebie_cooldown_seconds || 600, gameSpeed: s.game_speed_multi,
      gemsPerPack: Math.max(Math.round(s.freebie_gems_bonus ?? 5), 5), jackpotChance: pct('freebie_5x_chance'), refreshChance: pct('freebie_refresh_chance'),
      bankCap: Math.max(Math.round(s.freebie_bank_cap ?? 2), 2),
      stonks: { chance: pct('stonks_chance'), multi: Math.max(s.stonks_multi ?? 1, 1) },
      superStonks: { chance: pct('super_stonks_chance'), multi: Math.max(s.super_stonks_multi ?? 2, 2) },
      ultraStonks: { chance: pct('ultra_stonks_chance'), multi: Math.max(s.ultra_stonks_multi ?? 25, 25) },
    });
    for (const v of Object.values(f.loot)) expect(Number.isFinite(v)).toBe(true);
    expect(f.loot.gems).toBeGreaterThan(0);
  });
});
