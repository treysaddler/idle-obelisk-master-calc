// Ultimate Gem Calculator 2.2 — freebie pack block (MyCalc AD1:AI57, results column G for Stonks).

export interface FreebieInputs {
  cooldownSeconds: number; // 600 if unknown
  gameSpeed: number;
  gemsPerPack: number;
  relicChance: number; // 0-1, "Chance for Relic from Freebie Pack"
  extraRelicChance: number; // 0-1
  skillShardChance: number; // 0-1
  jackpotChance: number; // 0-1, 5x rewards
  refreshChance: number; // 0-1, instant refresh after claiming
  bankCap: number;
  stonks: { chance: number; multi: number }; // chance 0-1
  superStonks: { chance: number; multi: number };
  ultraStonks: { chance: number; multi: number };
  /** Statue of Soprano tier 0-3; only counts with Stone Vein research and World 3 mastery. */
  sopranoTier: number;
}

export interface FreebieLoot {
  gems: number;
  itemChests: number;
  relicChests: number;
  skillShards: number;
  gifts: number;
  stonksGems: number;
  stonksItemChests: number;
  stonksRelicChests: number;
}

const SOPRANO_GIFT_CHANCE = [0, 0.005, 0.0075, 0.01];

export function freebies(i: FreebieInputs) {
  const packsPerHour = 3600 / (i.cooldownSeconds / i.gameSpeed);
  const refresh = 1 / (1 - i.refreshChance);
  // Jackpots give 5x, i.e. 4 extra on top of the refreshed pack.
  const efficiency = refresh + 4 * i.jackpotChance;
  const stonksMulti = i.stonks.chance > 0 ? i.stonks.multi : 0;
  // Stonks tiers are exclusive: a super roll replaces a plain one, ultra replaces super.
  const plain = i.stonks.chance * (1 - i.superStonks.chance);
  const sup = i.stonks.chance * i.superStonks.chance * (1 - i.ultraStonks.chance);
  const ultra = i.stonks.chance * i.superStonks.chance * i.ultraStonks.chance;
  const stonksScale = plain * stonksMulti + sup * stonksMulti * i.superStonks.multi + ultra * stonksMulti * i.superStonks.multi * i.ultraStonks.multi;
  const stonksPerHour = packsPerHour * refresh * stonksScale;

  const loot: FreebieLoot = {
    gems: packsPerHour * i.gemsPerPack * efficiency,
    itemChests: packsPerHour * efficiency,
    relicChests: packsPerHour * (i.relicChance + i.extraRelicChance) * efficiency,
    skillShards: packsPerHour * i.skillShardChance * efficiency,
    gifts: packsPerHour * (SOPRANO_GIFT_CHANCE[Math.round(i.sopranoTier)] ?? 0) * refresh,
    stonksGems: stonksPerHour * 200,
    stonksItemChests: stonksPerHour * 20,
    stonksRelicChests: stonksPerHour * 10,
  };
  return {
    packsPerHour,
    loot,
    /** Minutes until the freebie bank is full. */
    bankFullMinutes: (60 * i.bankCap) / packsPerHour,
  };
}
