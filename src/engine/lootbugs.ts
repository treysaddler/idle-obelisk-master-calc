// Ultimate Gem Calculator 2.2 — lootbug block (MyCalc C99:R154, the copy the results use).
// Not shown in the UI yet: it feeds the full gem engine, which is ported in stages.

export type BugLoot =
  | 'gems' | 'itemChests' | 'relicChests' | 'cherryCharges'
  | 'oreMinutes' | 'speedMinutes' | 'veinMinutes' | 'starMinutes' | 'autoCatchMinutes'
  | 'bombMinutes' | 'archSeconds' | 'fishingTicks';

/** Which gem buffs you always buy when a non-golden lootbug offers them. */
export type Purchase = 'itemChests' | 'relicChests' | 'speed' | 'bomb' | 'ore' | 'vein' | 'star' | 'autoCatch' | 'arch' | 'fishing' | 'cherry';

export interface LootbugInputs {
  obeliskLevel: number;
  gameSpeed: number; // including W3/W4 floor modifiers
  spawnRate: number; // without the Bear drone buff
  tripleChance: number; // 0-1
  goldenChance: number; // 0-1
  bankCap: number;
  costReduction: number; // gems off each gem buff
  lootMulti: number;
  archHighStage: number;
  stoneVeinResearched: boolean;
  telescope: boolean; // Aries star level >= 1
  autoCatch75: boolean; // star auto-catch >= 75% without buffs
  bear: { fueled: boolean; grade: number; fuelGemsPerHour: number };
  /**
   * Gem buffs you buy. For timed buffs this is a 0–1 factor: the share of paid buffs that
   * isn't wasted because other sources already cover the hour (MyCalc L86, L94:L97).
   */
  buys: Partial<Record<Purchase, boolean | number>>;
}

const buyFactor = (i: LootbugInputs, p: Purchase) => {
  const b = i.buys[p];
  return b === true ? 1 : typeof b === 'number' ? Math.min(Math.max(b, 0), 1) : 0;
};

interface Row { loot: BugLoot; amount: number; weight: number; perGameTime?: boolean }
interface GemRow extends Row { cost: number; buy: Purchase }

/** Unlock flags, matching YourMiner!T3:T13 / MyMiner!W1:W10. */
export function unlocks(i: LootbugInputs) {
  const ob = i.obeliskLevel;
  return {
    cards: ob >= 15, // gates the loot multiplier in the sheet
    pets: ob >= 17, // gates triple chance
    vein: ob >= 19 && i.stoneVeinResearched,
    telescope: ob >= 23 && i.telescope,
    autoCatch: ob >= 23 && i.telescope && i.autoCatch75,
    arch: ob >= 30,
    fishing: ob >= 37,
  };
}

function tables(i: LootbugInputs, bear: boolean) {
  const u = unlocks(i);
  const m = u.cards ? i.lootMulti : 0;
  const tele = u.telescope ? 1 : 0;
  // 2x game speed is counted in game minutes, so its amounts are double the ore buff's.
  const free: Row[] = [
    { loot: 'gems', amount: 2 * m, weight: 30 },
    { loot: 'itemChests', amount: 1 * m, weight: 35 },
    { loot: 'relicChests', amount: 1 * m, weight: 5 },
    { loot: 'cherryCharges', amount: 10 * m, weight: 20 },
    { loot: 'speedMinutes', amount: 4 * m, weight: 15, perGameTime: true },
    { loot: 'oreMinutes', amount: 2 * m, weight: 15, perGameTime: true },
    { loot: 'veinMinutes', amount: 2 * m, weight: u.vein ? 20 : 0, perGameTime: true },
    // The sheet doesn't gate the free star buff on the telescope (the gem one is).
    { loot: 'starMinutes', amount: 2 * m, weight: u.autoCatch ? 26 : 16, perGameTime: true },
    { loot: 'autoCatchMinutes', amount: 4 * m, weight: (u.autoCatch ? 0 : 20) * tele, perGameTime: true },
  ];
  const c = (base: number) => base - i.costReduction;
  // The sheet's Bear table uses 8 / 10 / 10 for 10x bomb, arch and fishing ticks; the
  // regular table (and the wiki) use 3 / 8 / 11. Kept as-is so results match the sheet.
  const gem: GemRow[] = [
    { loot: 'itemChests', amount: 3 * m, weight: u.arch ? 14 : 18, cost: c(15), buy: 'itemChests' },
    { loot: 'relicChests', amount: 1 * m, weight: 10, cost: c(15), buy: 'relicChests' },
    { loot: 'speedMinutes', amount: 20 * m, weight: 24, cost: c(15), buy: 'speed', perGameTime: true },
    { loot: 'bombMinutes', amount: 2 * m, weight: bear ? 8 : 3, cost: c(15), buy: 'bomb', perGameTime: true },
    { loot: 'oreMinutes', amount: 10 * m, weight: 24, cost: c(15), buy: 'ore', perGameTime: true },
    { loot: 'veinMinutes', amount: 10 * m, weight: 20, cost: c(15), buy: 'vein', perGameTime: true },
    { loot: 'starMinutes', amount: 10 * m, weight: (u.autoCatch ? 26 : 16) * tele, cost: c(25), buy: 'star', perGameTime: true },
    { loot: 'autoCatchMinutes', amount: 20 * m, weight: (u.autoCatch ? 0 : 20) * tele, cost: c(25), buy: 'autoCatch', perGameTime: true },
    { loot: 'archSeconds', amount: (i.obeliskLevel <= 65 ? 600 : 6 + 2 * Math.min(i.archHighStage, 200)) * m, weight: u.arch ? (bear ? 10 : 8) : 0, cost: c(25), buy: 'arch' },
    { loot: 'cherryCharges', amount: 100 * m, weight: u.fishing ? 0 : 20, cost: c(15), buy: 'cherry' },
    { loot: 'fishingTicks', amount: 12 * m, weight: u.fishing ? (bear ? 10 : 11) : 0, cost: c(35), buy: 'fishing' },
  ];
  return { free, gem };
}

export type LootTotals = Record<BugLoot, number>;
const emptyTotals = (): LootTotals => ({
  gems: 0, itemChests: 0, relicChests: 0, cherryCharges: 0, oreMinutes: 0, speedMinutes: 0, veinMinutes: 0,
  starMinutes: 0, autoCatchMinutes: 0, bombMinutes: 0, archSeconds: 0, fishingTicks: 0,
});

/**
 * Expected loot per real hour from `bugsPerHour` lootbug spawns. Buff minutes are converted from
 * game time to real time, like the sheet's summary rows.
 */
function lootFrom(i: LootbugInputs, bugsPerHour: number, bear: boolean) {
  const u = unlocks(i);
  const triple = Math.min(1, u.pets ? i.tripleChance : 0);
  const tripleEff = (1 - triple) + 3 * triple;
  const { free, gem } = tables(i, bear);
  const out = emptyTotals();
  let gemsSpent = 0;

  const add = (rows: Row[], bugs: number, paid: boolean) => {
    const total = rows.reduce((a, r) => a + r.weight, 0);
    if (!total) return;
    for (const r of rows) {
      let n = bugs * (r.weight / total);
      if (paid) {
        const g = r as GemRow;
        n *= buyFactor(i, g.buy);
        gemsSpent += n * g.cost;
      }
      out[r.loot] += (n * r.amount) / (r.perGameTime ? i.gameSpeed : 1);
    }
  };

  const all = bugsPerHour * tripleEff;
  add(free, all, false);
  add(gem, bugsPerHour * i.goldenChance * tripleEff, false); // golden bugs: gem buff for free
  add(gem, bugsPerHour * (1 - i.goldenChance) * tripleEff, true);
  out.gems -= gemsSpent;
  return { loot: out, gemsSpent, spawns: all };
}

export function lootbugs(i: LootbugInputs) {
  const basePerHour = 3 * i.gameSpeed * i.spawnRate;
  const bearPerHour = i.bear.fueled ? basePerHour * (0.3 + 0.03 * i.bear.grade) : 0;
  const pure = lootFrom(i, basePerHour, false);
  const bear = lootFrom(i, bearPerHour, true);
  bear.loot.gems -= i.bear.fueled ? i.bear.fuelGemsPerHour : 0;
  return {
    basePerHour,
    bearPerHour,
    pure,
    bear,
    /** Minutes until the lootbug bank is full. */
    bankFullMinutes: (60 * i.bankCap) / (basePerHour + bearPerHour),
  };
}

/** Spawn rate as exported includes the Bear drone buff; the sheet divides it back out. */
export function spawnRateWithoutBear(exported: number, bearFueled: boolean, bearGrade: number) {
  return Math.max(Math.round(exported * 1e4) / 1e4 / (bearFueled ? bearGrade * 0.03 + 1.3 : 1), 1);
}
