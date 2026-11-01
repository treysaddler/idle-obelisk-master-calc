import { formatDuration, formatPct } from '../lib/format';
import { bool, num, str, type CalculatorDef } from '../lib/types';

// Per drone tick drop chances. Infernal shards scale with drone id: 1 in 98765 * (5 + id/2).
export const DRONES = ['Bear', 'Chain', 'Midas', 'Frog', 'Vein', 'Star', 'Elixir', 'Void', 'Angler', 'Prism'].map((name, id) => ({
  name,
  card: name === 'Prism' ? 1 / 518400 : 1 / 86400,
  poly: name === 'Prism' ? 1 / 196605 : 1 / 65535,
  infernal: 1 / (98765 * (5 + id / 2)),
}));

export type Drop = 'card' | 'poly' | 'infernal';

/** Chance of at least one drop within `hours` at `ticksPerSecond`. */
export const chanceWithin = (p: number, hours: number, ticksPerSecond: number) => 1 - (1 - p) ** (hours * 3600 * ticksPerSecond);
/** Seconds until the chance of at least one drop reaches `target` (0-1). */
export const timeToChance = (p: number, target: number, ticksPerSecond: number) => Math.log(1 - target) / Math.log(1 - p) / ticksPerSecond;
/** Expected seconds per drop. */
export const expectedTime = (p: number, ticksPerSecond: number) => 1 / p / ticksPerSecond;

export const droneCardsCalc: CalculatorDef = {
  id: 'drone-cards',
  title: 'Drone Cards & Shards',
  category: 'Odds',
  summary: 'Odds and time to get drone cards, polychrome shards and infernal shards.',
  source: { name: 'Drone Cards & Shards Calculator', author: 'DoJa', url: 'https://docs.google.com/spreadsheets/d/1Icjy8TFhG-YrMjuRi_99HciW2YtHfsI5/' },
  keywords: ['poly', 'infernal', 'drop'],
  sections: [
    {
      title: 'Your data',
      fields: [
        { kind: 'number', id: 'gameSpeed', label: 'Game speed', default: 1, min: 0.01, step: 0.01, stat: 'game_speed_multi' },
        { kind: 'number', id: 'w4Debuff', label: 'World 4 speed debuff', default: 30, min: 0, max: 99, step: 1, suffix: '%' },
        { kind: 'select', id: 'world', label: 'Where you farm', default: 'w13', options: [
          { value: 'w13', label: 'World 1–3' }, { value: 'w4', label: 'World 4' }, { value: 'w4fuel', label: 'World 4 (fuel depletion, 2x ticks)' },
        ] },
        { kind: 'number', id: 'hours', label: 'Time window', default: 8, min: 0.1, step: 0.5, suffix: 'h' },
        { kind: 'number', id: 'target', label: 'Target chance', default: 99, min: 1, max: 99.99, step: 0.01, suffix: '%' },
        { kind: 'bool', id: 'founder', label: 'Founder (24h offline cap)', default: true },
      ],
    },
  ],
  compute(v) {
    const speed = num(v, 'gameSpeed');
    const w4Speed = Math.round((speed / 100) * (100 - num(v, 'w4Debuff')) * 100) / 100;
    const world = str(v, 'world');
    const tps = world === 'w13' ? speed : world === 'w4' ? w4Speed : w4Speed * 2;
    const hours = num(v, 'hours');
    const target = num(v, 'target') / 100;
    const cap = bool(v, 'founder') ? 24 : 12;
    const capped = Math.min(hours, cap);
    const drops: [Drop, string][] = [['card', 'Card'], ['poly', 'Poly shard'], ['infernal', 'Infernal shard']];
    return {
      outputs: [
        { label: 'Drone ticks per second', value: tps.toFixed(2), tone: 'primary', help: world === 'w13' ? 'Game speed' : `World 4 speed ${w4Speed}` },
        { label: 'Offline window used', value: `${capped}h`, help: hours > cap ? `Capped at the ${cap}h offline limit.` : undefined },
      ],
      tables: [
        {
          title: `Chance within ${capped}h offline`,
          columns: ['Drone', ...drops.map((d) => d[1])],
          rows: DRONES.map((d) => [d.name, ...drops.map(([k]) => formatPct(chanceWithin(d[k], capped, tps)))]),
        },
        {
          title: `Time to reach ${formatPct(target, 2)} chance`,
          columns: ['Drone', ...drops.map((d) => d[1])],
          rows: DRONES.map((d) => [d.name, ...drops.map(([k]) => formatDuration(timeToChance(d[k], target, tps)))]),
        },
        {
          title: 'Average time per drop',
          columns: ['Drone', ...drops.map((d) => d[1])],
          rows: DRONES.map((d) => [d.name, ...drops.map(([k]) => formatDuration(expectedTime(d[k], tps)))]),
        },
      ],
      notes: ['Assumes one drone tick per game-speed second, as in the original sheet (version 2.0.5).'],
    };
  },
};
