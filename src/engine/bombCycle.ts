// Bomb charges and firing.
//
// `bombSteadyState` is the model to use: one Auto-Bomber bomb, an optional second bomb held on
// Fire Slow (the "spoon strat"), bombs fired by hand with Fire All, and a target for the cherry
// stack — the setups the wiki describes.
//
// `sheetRotationCycle` ports Ultimate Gem Calculator 2.2's bomb cycle (MyCalc BF1:EH14), which
// fires an hour of charges through a fixed 57-step "rotation". That rotation is the sheet
// author's approximation, not an in-game strategy; it is kept only to check this port against
// the sheet's own numbers.
import rotations from '../data/bombRotations.json';

export type Bomb = 'cherry' | 'gem' | 'battery' | 'd20' | 'founder';
/** The sheet's preset rotations, used only to check this port against the original. */
export const SHEET_ROTATIONS = rotations as Record<string, Bomb[]>;

/** Base cooldowns in seconds (before game speed and recharge). "other" stands for every other bomb. */
const COOLDOWN = { cherry: 330, gem: 315, battery: 345, d20: 400, founder: 540, other: 120 };

export interface CardLevels { cherry: number; gem: number; battery: number; d20: number; founder: number }

export interface BombInputs {
  gameSpeed: number;
  recharge: number; // bomb recharge speed, incl. Minotaur
  freeChance: number; // 0-1
  cherryTriple: number; // 0-1
  gemChance: number; // gems per gem-bomb charge
  d20Refills: number;
  bombCapacity: number; // 0 = no cap
  cards: CardLevels; // card level 0-3 (or a raw multiplier above 3)
  founder: boolean;
  founderCap: number; // founder bomb charges cap (0 when not a founder)
  veinmorpher: boolean;
  megabomb: boolean;
  transmuter: boolean;
  /** Recharge stays at 10x all the time (no extra from buffs). */
  always10x: boolean;
  rotation: Bomb[];
}

/** Charges and minutes added by other sources, per hour. */
export interface BombExtras {
  tenXMinutes: number[]; // 10x recharge buff minutes per hour, one entry per source
  cherryCharges: number; // from lootbugs, Bear, supply drops
  frogFires: number; // unfueled Frogger fires per hour
  fueledFrogFires: number;
}

const cardMulti = (lvl: number) => (lvl === 0 ? 1 : lvl === 1 ? 1.5 : lvl === 2 ? 2 : lvl === 3 ? 3 : lvl);

export function sheetRotationCycle(i: BombInputs, x: BombExtras) {
  const free = 1 / (1 - i.freeChance);
  const triple = 1 + 2 * i.cherryTriple;
  const bombCount = 11 + (i.veinmorpher ? 1 : 0) + (i.founder ? 1 : 0);
  const frogTargets = 9 + (i.veinmorpher ? 1 : 0) + (i.founder ? 1 : 0) + (i.megabomb ? 1 : 0) + (i.transmuter ? 1 : 0);
  const batteryRefill = 2 / (bombCount - 1.7);
  const d20Refill = (i.d20Refills / (bombCount - 1.7)) * 0.05;
  const founderSpeed = ((1 / 3) * (i.founder ? 1 : 0) / i.gameSpeed) * 0.1 * 0.3;
  const batteryBonusChance = 0.1 / 100;

  // Natural charges per hour plus 10x-buff extras (+9x while active) and Frogger fires.
  const cards: Record<keyof typeof COOLDOWN, number> = {
    cherry: cardMulti(i.cards.cherry), gem: cardMulti(i.cards.gem), battery: cardMulti(i.cards.battery),
    d20: cardMulti(i.cards.d20), founder: cardMulti(i.cards.founder), other: 1,
  };
  const tenX = x.tenXMinutes.reduce((a, b) => a + b, 0);
  const perHour = (b: keyof typeof COOLDOWN) => {
    const cd = COOLDOWN[b] / (i.gameSpeed * i.recharge);
    const natural = (60 * 60) / cd * (i.always10x ? 10 : 1) * cards[b];
    const buffed = i.always10x ? 0 : (9 * tenX * 60) / cd * cards[b];
    return natural + buffed;
  };
  const fb = x.frogFires / frogTargets;
  const ff = x.fueledFrogFires / frogTargets;
  const freeHit = -1 + i.freeChance;
  const frog = {
    cherryCharges: (fb + ff) * triple,
    allRefills: fb * (batteryRefill + d20Refill + freeHit) + ff * (batteryRefill + d20Refill),
    battery: fb * (d20Refill + freeHit) + ff * d20Refill,
    d20: fb * (batteryRefill + freeHit) + ff * batteryRefill,
  };

  const start = {
    charges: x.cherryCharges + frog.cherryCharges,
    cherry: perHour('cherry') + frog.allRefills,
    gem: perHour('gem') + frog.allRefills,
    battery: perHour('battery') + frog.battery,
    d20: perHour('d20') + frog.d20,
    founder: perHour('founder') + frog.allRefills,
    other: perHour('other') + frog.allRefills,
    gems: (fb + ff) * i.gemChance,
    batteryBonus: (fb + ff) * batteryBonusChance,
    speedMinutes: (fb + ff) * founderSpeed,
  };

  // The sheet scales the hour down when charges would exceed bomb capacity or the founder cap.
  const maxRate = Math.max(start.charges, start.cherry, start.gem, start.battery, start.d20);
  const scaleDown = Math.max(1, i.founder && i.founderCap > 0 ? start.founder / i.founderCap : 1, i.bombCapacity > 0 ? maxRate / i.bombCapacity : 1);
  const s = Object.fromEntries(Object.entries(start).map(([k, v]) => [k, v / scaleDown])) as typeof start;
  s.founder = Math.min(s.founder, i.founderCap);

  let peak = Math.max(s.cherry, s.gem, s.battery, s.d20);
  for (const bomb of i.rotation) {
    if (bomb === 'cherry') {
      s.charges += s.cherry * free * triple;
      s.cherry = 0;
    } else {
      const fired = s[bomb] * free + s.charges;
      s.charges = 0;
      s[bomb] = 0;
      if (bomb === 'gem') s.gems += fired * i.gemChance;
      else if (bomb === 'founder') s.speedMinutes += fired * founderSpeed;
      else {
        const amount = fired * (bomb === 'battery' ? batteryRefill : d20Refill);
        if (bomb === 'battery') s.batteryBonus += fired * batteryBonusChance;
        for (const other of ['cherry', 'gem', 'battery', 'd20', 'other'] as const) if (other !== bomb) s[other] += amount;
        s.founder = Math.min(s.founder + amount, i.founderCap);
      }
    }
    peak = Math.max(peak, s.cherry, s.gem, s.battery, s.d20);
  }

  return {
    gems: s.gems * scaleDown,
    batteryBonus: s.batteryBonus * scaleDown,
    founderSpeedMinutes: s.speedMinutes * scaleDown,
    otherBombCharges: s.other * scaleDown,
    peakCharges: peak * scaleDown,
    naturalPerHour: { cherry: perHour('cherry'), gem: perHour('gem'), battery: perHour('battery'), d20: perHour('d20'), founder: perHour('founder'), other: perHour('other') },
  };
}

// ---- Firing setup (how the game is actually played) ------------------------------------
//
// The rotation above assumes every bomb is fired by hand. In the game, Auto-Bomber fires one
// chosen bomb every 1.25s, and "Fire Slow" held down (the spoon strat) fires a second one at the
// same pace. Cherry charges make the *next* bomb fired free, so with a spoon they all go to the
// spoon bomb. Bombs nobody fires just fill to capacity and stop recharging.

export type FireMode = 'auto' | 'spoon' | 'manual' | 'off';
export interface FiringSetup {
  modes: Record<Bomb, FireMode>;
  /** Bomb that receives the cherry stack when no spoon bomb is set (fired by hand). */
  cherryTarget: Bomb;
}

/** One shot every 1.25 seconds. Assumed to run in real time. */
export const STREAM_FIRES_PER_HOUR = 3600 / 1.25;

/**
 * Long-run fires per hour of each bomb under a firing setup. Battery and D20 fires refill every
 * other bomb, so this solves the steady state by repeated substitution.
 */
export function bombSteadyState(i: BombInputs, x: BombExtras, setup: FiringSetup) {
  const natural = sheetRotationCycle({ ...i, rotation: [] }, x).naturalPerHour;
  const free = 1 / (1 - i.freeChance);
  const triple = 1 + 2 * i.cherryTriple;
  const bombCount = 11 + (i.veinmorpher ? 1 : 0) + (i.founder ? 1 : 0);
  const batteryRefill = 2 / (bombCount - 1.7);
  const d20Refill = (i.d20Refills / (bombCount - 1.7)) * 0.05;
  const founderSpeed = ((1 / 3) * (i.founder ? 1 : 0) / i.gameSpeed) * 0.1 * 0.3;
  const bombs: Bomb[] = ['cherry', 'gem', 'battery', 'd20', 'founder'];
  const fired = (b: Bomb) => setup.modes[b] !== 'off';
  const spoon = bombs.find((b) => setup.modes[b] === 'spoon');
  const target = spoon ?? (fired(setup.cherryTarget) ? setup.cherryTarget : undefined);
  const cap = (b: Bomb) => (setup.modes[b] === 'auto' || setup.modes[b] === 'spoon' ? STREAM_FIRES_PER_HOUR : Infinity);

  const fires: Record<Bomb, number> = { cherry: 0, gem: 0, battery: 0, d20: 0, founder: 0 };
  let cherryStack = 0;
  for (let iter = 0; iter < 500; iter++) {
    const next = { ...fires };
    for (const b of bombs) {
      if (!fired(b)) {
        next[b] = 0;
        continue;
      }
      const charges = natural[b] + (b !== 'battery' ? fires.battery * batteryRefill : 0) + (b !== 'd20' ? fires.d20 * d20Refill : 0);
      const fromCherry = b === target && b !== 'cherry' ? cherryStack : 0;
      next[b] = Math.min(charges * free + fromCherry, cap(b));
    }
    cherryStack = next.cherry * triple + x.cherryCharges;
    const delta = bombs.reduce((a, b) => a + Math.abs(next[b] - fires[b]), 0);
    Object.assign(fires, next);
    if (delta < 1e-12) break;
  }
  return {
    fires,
    cherryStackPerHour: cherryStack,
    /** Cherry charges with nowhere to go (no target bomb being fired). */
    wastedCherry: target ? 0 : cherryStack,
    gems: fires.gem * i.gemChance,
    batteryBonus: fires.battery * 0.001,
    founderSpeedMinutes: fires.founder * founderSpeed,
    /** Streams that hit the 1.25s limit. */
    capped: bombs.filter((b) => cap(b) !== Infinity && fires[b] >= cap(b) - 1e-9),
  };
}
