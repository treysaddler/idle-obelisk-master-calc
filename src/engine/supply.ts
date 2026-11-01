// Ultimate Gem Calculator 2.2 — Founder supply drop block (MyCalc T1:AB56).
// Contents match the wiki's Founder page. Where the sheet and the current wiki differ
// (flat 50 cherry charges, 20 game-minutes of 2x speed, a 75% auto-catch switch, no Cosmic
// Candy jackpot) the sheet's values are kept so results can be matched against it.

export type SupplyLoot =
  | 'gems' | 'itemChests' | 'relicChests' | 'cherryCharges'
  | 'speedMinutes' | 'oreMinutes' | 'veinMinutes' | 'starMinutes' | 'autoCatchMinutes' | 'expMinutes'
  | 'archSeconds' | 'fishingTicks' | 'gifts' | 'mythicChests' | 'divineChests'
  | 'frogspawn' | 'sushi' | 'lobster' | 'frogurt';

export interface SupplyInputs {
  founderTier: number; // 0 = not a founder, 1-13
  worlds: number;
  obeliskLevel: number;
  archHighStage: number;
  fishingTickSeconds: number; // 60 minus tick reduction
  gameSpeed: number;
  stoneVeinResearched: boolean;
  telescope: boolean;
  autoCatch75: boolean;
}

/** Founder VIP tiers: drop interval (minutes) and 2x / 3x / golden (5x) drop chances. */
export const FOUNDER_TIERS = Array.from({ length: 13 }, (_, k) => {
  const t = k + 1;
  return {
    tier: t,
    interval: 60 - 2 * (t - 1),
    double: t >= 2 ? 0.12 + 0.06 * (t - 2) : 0,
    triple: t >= 7 ? 0.16 + 0.08 * (t - 7) : 0,
    golden: t >= 11 ? 0.1 + 0.02 * (t - 11) : 0,
  };
});

const HWM = [1, 1, 2, 4, 25]; // highest-world multiplier for jackpots, by worlds unlocked

interface Row { loot: SupplyLoot; amount: number; chance: number; guaranteed?: boolean; perGameTime?: boolean }

export function supplyRows(i: SupplyInputs): Row[] {
  const tele = i.telescope;
  const hwm = HWM[Math.min(Math.max(Math.round(i.worlds), 1), 4)];
  const ob = i.obeliskLevel;
  return [
    // Every crate; scaled by worlds unlocked and all crit types.
    { loot: 'gems', amount: 10, chance: 1, guaranteed: true },
    { loot: 'itemChests', amount: 2, chance: 1, guaranteed: true },
    { loot: 'relicChests', amount: 1, chance: 1, guaranteed: true },
    { loot: 'cherryCharges', amount: 50, chance: 1, guaranteed: true },
    { loot: 'speedMinutes', amount: 20, chance: 1, guaranteed: true, perGameTime: true },
    { loot: 'oreMinutes', amount: 5, chance: 1, guaranteed: true, perGameTime: true },
    { loot: 'veinMinutes', amount: 5, chance: i.stoneVeinResearched ? 1 : 0, guaranteed: true, perGameTime: true },
    { loot: 'starMinutes', amount: 4, chance: tele ? 1 : 0, guaranteed: true, perGameTime: true },
    { loot: 'autoCatchMinutes', amount: 8, chance: tele && !i.autoCatch75 ? 1 : 0, guaranteed: true, perGameTime: true },
    { loot: 'expMinutes', amount: 5, chance: tele && i.autoCatch75 ? 1 : 0, guaranteed: true, perGameTime: true },
    // Jackpots; 2x / 3x drops apply, golden doesn't.
    { loot: 'gems', amount: hwm * (ob * 10 + 50) * (ob >= 70 ? 3 : 1), chance: 1 / 100 },
    { loot: 'relicChests', amount: hwm * (ob * 3 + 10), chance: 1 / 500 },
    { loot: 'gifts', amount: 10, chance: 1 / 1234 },
    { loot: 'mythicChests', amount: 1, chance: 1 / 2000 },
    { loot: 'divineChests', amount: 1, chance: 1 / 69696 },
    { loot: 'relicChests', amount: 100, chance: 1 / 69696 },
    { loot: 'gems', amount: 1000, chance: 1 / 69696 },
    { loot: 'frogspawn', amount: 5, chance: 1 / 500 },
    { loot: 'sushi', amount: 100, chance: 1 / 750 },
    { loot: 'archSeconds', amount: i.archHighStage * 3 + 50, chance: 1 },
    { loot: 'fishingTicks', amount: i.fishingTickSeconds > 0 ? (i.worlds * 150) / i.fishingTickSeconds : 0, chance: 1 },
    { loot: 'lobster', amount: 5, chance: 1 / 1500 },
    { loot: 'frogurt', amount: 10, chance: 1 / 1111 },
  ];
}

export type SupplyTotals = Record<SupplyLoot, number>;

/** Expected loot per real hour. Supply drops run on a real-time timer, unaffected by game speed. */
export function supplyDrops(i: SupplyInputs) {
  const out = Object.fromEntries(supplyRows(i).map((r) => [r.loot, 0])) as SupplyTotals;
  const tier = FOUNDER_TIERS[Math.round(i.founderTier) - 1];
  if (!tier) return { dropsPerHour: 0, intervalMinutes: 0, loot: out };
  const dropsPerHour = 60 / tier.interval;
  const critNoGolden = ((1 - tier.double) + 2 * tier.double) * ((1 - tier.triple) + 3 * tier.triple);
  const critAll = critNoGolden * ((1 - tier.golden) + 5 * tier.golden);
  for (const r of supplyRows(i)) {
    const perHour = dropsPerHour * r.chance * r.amount * (r.guaranteed ? critAll * i.worlds : critNoGolden);
    out[r.loot] += r.perGameTime ? perHour / i.gameSpeed : perHour;
  }
  return { dropsPerHour, intervalMinutes: tier.interval, loot: out };
}
