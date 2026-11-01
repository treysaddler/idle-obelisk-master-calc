import skills from '../data/skills.json';
import { formatDuration, formatInt } from '../lib/format';
import { num, str, type CalculatorDef, type Values } from '../lib/types';

interface Skill { id: number; name: string; cost: number; parent: number | null }
const SKILLS = skills as Skill[];
const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

/** The wanted skill and all of its ancestors, nearest first (ends at "No Skills"). */
export function skillPath(wantedId: number): Skill[] {
  const path: Skill[] = [];
  let cur = BY_ID.get(wantedId);
  while (cur) {
    path.push(cur);
    cur = cur.parent == null ? undefined : BY_ID.get(cur.parent);
  }
  return path;
}

/** Skill points to buy every skill after `ownedId` on the way to `wantedId`. */
export function pathCost(ownedId: number, wantedId: number) {
  let total = 0;
  for (const s of skillPath(wantedId)) {
    if (s.id === ownedId) return total;
    total += s.cost;
  }
  return NaN; // owned skill isn't on the path
}

export function skillPointPlan(i: { wantedId: number; ownedId: number; points: number; shards: number; shardChance: number; cooldown: number; gameSpeed: number }) {
  const cost = pathCost(i.ownedId, i.wantedId);
  // 10 shards make a skill point.
  const needed = Math.max(0, cost - (i.points + Math.floor(i.shards / 10)));
  const gems = needed * 125;
  // The sheet subtracts all shards again here; only the leftover (<10) shards still count.
  const freebies = Math.max(0, Math.ceil((needed * 10 - (i.shards % 10)) / (i.shardChance / 100)));
  const seconds = (freebies * i.cooldown) / i.gameSpeed;
  return { cost, needed, gems, freebies, seconds };
}

function ownedOptions(v: Values) {
  const wanted = Number(str(v, 'wanted'));
  return skillPath(wanted).slice(1).map((s) => ({ value: String(s.id), label: s.name }));
}

export const skillPointCalc: CalculatorDef = {
  id: 'skill-points',
  title: 'Skill Points',
  category: 'Costs & Gains',
  summary: 'Gems or freebies needed to reach a skill from the closest one you own.',
  source: { name: 'Skill Point Calculator', author: 'ZanyT', url: 'https://docs.google.com/spreadsheets/d/16uskww9x0IkO_Cv7jhD4ZvdU2UsO4ugSwvkpaYJMQlM/edit?usp=sharing' },
  keywords: ['skill tree', 'freebie', 'shards'],
  sections: (v) => {
    const owned = ownedOptions(v);
    return [
      {
        title: 'Your stats',
        fields: [
          { kind: 'number', id: 'points', label: 'Current skill points', default: 0, min: 0, step: 1 },
          { kind: 'number', id: 'shards', label: 'Current skill shards', default: 0, min: 0, step: 1 },
          { kind: 'number', id: 'shardChance', label: 'Freebie skill shard chance', default: 10, min: 0.01, max: 100, step: 0.1, suffix: '%' },
          { kind: 'number', id: 'cooldown', label: 'Freebie cooldown', default: 600, min: 1, step: 1, suffix: 's', stat: 'freebie_cooldown_seconds' },
          { kind: 'number', id: 'gameSpeed', label: 'Game speed', default: 1, min: 0.01, step: 0.01, stat: 'game_speed_multi' },
        ],
      },
      {
        title: 'Skills',
        fields: [
          { kind: 'select', id: 'wanted', label: 'Skill you want', default: '30', options: SKILLS.slice(1).map((s) => ({ value: String(s.id), label: s.name })) },
          { kind: 'select', id: 'owned', label: 'Closest skill you own on that path', default: owned[0]?.value ?? '0', options: owned },
        ],
      },
    ];
  },
  compute(v) {
    const wantedId = Number(str(v, 'wanted'));
    let ownedId = Number(str(v, 'owned'));
    const path = skillPath(wantedId);
    // If the wanted skill changed, fall back to the nearest ancestor.
    if (!path.slice(1).some((s) => s.id === ownedId)) ownedId = path[1]?.id ?? 0;
    const r = skillPointPlan({
      wantedId, ownedId, points: num(v, 'points'), shards: num(v, 'shards'),
      shardChance: num(v, 'shardChance'), cooldown: num(v, 'cooldown'), gameSpeed: num(v, 'gameSpeed'),
    });
    const toBuy = path.slice(0, path.findIndex((s) => s.id === ownedId)).reverse();
    let running = 0;
    return {
      outputs: [
        { label: 'Skill points still needed', value: formatInt(r.needed), tone: 'primary' },
        { label: 'Gems needed', value: formatInt(r.gems), help: '125 gems per skill point' },
        { label: 'Freebies needed', value: formatInt(r.freebies) },
        { label: 'Time for freebies', value: formatDuration(r.seconds) },
        { label: 'Total path cost', value: formatInt(r.cost), tone: 'muted' },
      ],
      tables: [{
        title: 'Skills to buy, in order',
        columns: ['Skill', 'Cost', 'Running total'],
        rows: toBuy.map((s) => [s.name, formatInt(s.cost), formatInt((running += s.cost))]),
      }],
      notes: ['Skill data from game version 2.0.5.'],
    };
  },
};
