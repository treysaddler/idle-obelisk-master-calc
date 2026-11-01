import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { fillValues } from '../components/CalculatorPage';
import { parseExportStats, setExportStats } from '../lib/exportStats';
import type { Values } from '../lib/types';
import { byId, calculators } from './index';

const fill = (id: string, start: Values = {}) => fillValues(byId.get(id)!, start).next;

describe('fill from EXPORTSTATS (synthetic export)', () => {
  beforeAll(() => {
    setExportStats(parseExportStats(JSON.stringify({
      stats: {
        bomb_free_chance: 20, bomb_cherry3x_chance: 11, coal_fuel_save_chance: 28.85, drones_suit_level_array: [15, 15, 15, 12, 15, 15, 15, 15, 12, 0, 0],
        chain_fuel_grade: 37, bear_fuel_grade: 14, contract_points_rewarded: 15, contract_cap_increase: 8, contract_upgrade_cost_reduction: 0.2427,
        contracts_array: [1, 13, 13, 13, 13, 13, 11, 11, 11, 9, 6, 11, 10, 10],
      },
      version: 'v2.2.51',
    })));
  });

  it('fills mapped fields and array slots', () => {
    const frog = fill('frogger-gems');
    expect(frog).toMatchObject({ freeBomb: 20, cherryTriple: 11, fuelSave: 28.85, level: 12 });
    const con = fill('contracts');
    expect(con).toMatchObject({ base: 15, cap: 8, costMulti: 0.2427, u0c: 1, u1c: 13, u13c: 10 });
  });

  it('reads stat names that depend on other inputs', () => {
    expect(fill('drone-grade', { suit: '1' }).current).toBe(37); // Chain Bomber
    expect(fill('drone-grade', { suit: '0' }).current).toBe(14); // Bomb Bear
  });

  it('leaves fields alone when the export has no value', () => {
    expect(fill('frogger-gems').gemChance).toBe(3.5);
  });
});

// Local-only: every calculator against a real export, if one is saved (it is git-ignored).
const statsPath = new URL('../data/example-stats.json', import.meta.url);
describe.skipIf(!existsSync(statsPath))('fill from local EXPORTSTATS', () => {
  it('fills without NaNs and computes', () => {
    setExportStats(parseExportStats(readFileSync(statsPath, 'utf-8')));
    for (const def of calculators) {
      const { next, filled } = fillValues(def, {});
      for (const [k, v] of Object.entries(next)) expect(Number.isNaN(v as number), `${def.id}.${k}`).toBe(false);
      expect(() => def.compute(next)).not.toThrow();
      if (def.sections.length || typeof def.sections === 'function') console.log(`FILL ${def.id}: ${filled}`);
    }
  });
});
