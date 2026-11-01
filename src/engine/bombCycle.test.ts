import { describe, expect, it } from 'vitest';
import { bombSteadyState, sheetRotationCycle, SHEET_ROTATIONS, STREAM_FIRES_PER_HOUR, type BombInputs } from './bombCycle';

// The template sheet with no stats: game speed 0.2, recharge 0.9975…, F2P, "Your Battery!" rotation.
const template: BombInputs = {
  gameSpeed: 0.2, recharge: 0.9975062344, freeChance: 0, cherryTriple: 0, gemChance: 0, d20Refills: 20, bombCapacity: 0,
  cards: { cherry: 0, gem: 0, battery: 0, d20: 0, founder: 0 }, founder: false, founderCap: 0,
  veinmorpher: false, megabomb: false, transmuter: false, always10x: false, rotation: SHEET_ROTATIONS['Your Battery'],
};
const noExtras = { tenXMinutes: [], cherryCharges: 0, frogFires: 0, fueledFrogFires: 0 };

describe('bomb cycle', () => {
  it("matches the template sheet's natural charges (MyCalc BT5:BT10)", () => {
    const r = sheetRotationCycle(template, noExtras);
    expect(r.naturalPerHour.cherry).toBeCloseTo(2.176377239, 8);
    expect(r.naturalPerHour.gem).toBeCloseTo(2.28001425, 8);
    expect(r.naturalPerHour.battery).toBeCloseTo(2.081752141, 8);
    expect(r.naturalPerHour.d20).toBeCloseTo(1.795511222, 8);
    expect(r.naturalPerHour.other).toBeCloseTo(5.985037406, 8);
  });

  it("matches the template sheet's cycle results (MyCalc ED10, EE12, ED14)", () => {
    const r = sheetRotationCycle(template, noExtras);
    expect(r.otherBombCharges).toBeCloseTo(7.675548223, 8);
    expect(r.batteryBonus).toBeCloseTo(0.006287088732, 11);
    expect(r.peakCharges).toBeCloseTo(2.71123797, 7);
    expect(r.gems).toBe(0); // gem chance is 0 in the template
  });

  it('turns gem charges and stacked cherry charges into gems', () => {
    const only = (rotation: BombInputs['rotation']) => sheetRotationCycle({ ...template, gameSpeed: 1, recharge: 1, gemChance: 0.05, rotation }, noExtras);
    // Gem alone: 3600/315 charges x 5% gems.
    expect(only(['gem']).gems).toBeCloseTo((3600 / 315) * 0.05, 10);
    // Cherry first stacks its charges into the gem bomb.
    expect(only(['cherry', 'gem']).gems).toBeCloseTo((3600 / 315 + 3600 / 330) * 0.05, 10);
  });

  it('firing setup: all bombs by hand matches a long repeated rotation', () => {
    const inputs = { ...template, gameSpeed: 2, recharge: 1.2, freeChance: 0.2, cherryTriple: 0.3, gemChance: 0.04, d20Refills: 50 };
    const steady = bombSteadyState(inputs, noExtras, {
      modes: { cherry: 'manual', gem: 'manual', battery: 'manual', d20: 'manual', founder: 'off' }, cherryTarget: 'gem',
    });
    // Repeating cherry → gem → battery → d20 drains refills until nothing is left, which is the steady state.
    const rotation = Array.from({ length: 200 }, () => ['cherry', 'gem', 'battery', 'd20'] as const).flat();
    const cycle = sheetRotationCycle({ ...inputs, rotation: [...rotation] }, noExtras);
    expect(steady.gems).toBeCloseTo(cycle.gems, 8);
  });

  it('firing setup: spoon gets the cherry stack and streams cap at one shot per 1.25s', () => {
    const inputs = { ...template, gameSpeed: 1, recharge: 1, gemChance: 0.05 };
    const r = bombSteadyState(inputs, noExtras, {
      modes: { cherry: 'auto', gem: 'spoon', battery: 'off', d20: 'off', founder: 'off' }, cherryTarget: 'battery',
    });
    expect(r.fires.gem).toBeCloseTo(3600 / 315 + 3600 / 330, 10); // own charges + every cherry charge
    expect(r.fires.battery).toBe(0); // off: fills to capacity, never fires
    const fast = bombSteadyState({ ...inputs, gameSpeed: 1000 }, noExtras, {
      modes: { cherry: 'auto', gem: 'spoon', battery: 'off', d20: 'off', founder: 'off' }, cherryTarget: 'gem',
    });
    expect(fast.fires.gem).toBe(STREAM_FIRES_PER_HOUR);
    expect(fast.capped).toContain('gem');
  });

  it('firing setup: cherry charges are wasted with no target being fired', () => {
    const r = bombSteadyState({ ...template, gameSpeed: 1, recharge: 1 }, noExtras, {
      modes: { cherry: 'auto', gem: 'off', battery: 'off', d20: 'off', founder: 'off' }, cherryTarget: 'gem',
    });
    expect(r.wastedCherry).toBeCloseTo(3600 / 330, 10);
  });

  it('adds 10x recharge buff minutes as +9x charges', () => {
    const base = sheetRotationCycle({ ...template, gameSpeed: 1, recharge: 1, rotation: [] }, noExtras).naturalPerHour.gem;
    const buffed = sheetRotationCycle({ ...template, gameSpeed: 1, recharge: 1, rotation: [] }, { ...noExtras, tenXMinutes: [6] }).naturalPerHour.gem;
    expect(buffed / base).toBeCloseTo(1 + 9 * 0.1, 10);
  });
});
