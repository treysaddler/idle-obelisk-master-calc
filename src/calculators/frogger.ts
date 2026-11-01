import { formatNum } from '../lib/format';
import { bool, num, type CalculatorDef } from '../lib/types';

export interface FroggerInputs {
  fuelDurationMulti: number;
  fuelSaveChance: number; // 0-1
  freeBombChance: number; // 0-1
  d20Charges: number;
  cherryTripleChance: number; // 0-1
  gemBombChance: number; // 0-1
  cherryBattery: boolean;
  froggerLevel: number;
  gameSpeed: number;
}

/** Steady-state gem rate from fuelling the Frogger suit, per grade. Port of the "Mucky Gubbins" tab. */
export function froggerRates(i: FroggerInputs, grades = 46) {
  const fuelSaveIncrease = 1 / (1 - i.fuelSaveChance);
  const freeMult = 1 / (1 - i.freeBombChance);
  const a = (2 / 13) * freeMult; // battery refill per bomb
  const b = (i.d20Charges * freeMult) / (20 * 13); // d20 refill per bomb
  const ch = (1 + 2 * i.cherryTripleChance) * freeMult; // cherry charges per bomb
  const d = i.gemBombChance * freeMult; // gems per gem bomb
  const denomA = 1 - a * b - a * ch - a * b * ch;
  // Strategy A: cherry charges go to battery bombs. Strategy B: to gem bombs.
  const valueA = ((a * d + a * b * d) + (b * d + a * b * d) + (a * ch * d + a * b * ch * d)) / denomA + d;
  const valueB = (a * d + a * b * d + a * ch * d + a * b * ch * d) / (1 - a * b) + (b * d + a * b * d + b * ch * d + a * b * ch * d) / (1 - a * b) + ch * d + d;
  const timeBetweenFires = (30 - i.froggerLevel * 1.5) / i.gameSpeed;

  return Array.from({ length: grades }, (_, grade) => {
    const avgBombs = (Math.min(grade + 5, 10) + grade + 5) / 2;
    const perBomb = avgBombs / 13;
    const gemsPerFire = perBomb * (i.cherryBattery ? valueA : valueB);
    const fuelDuration = (180 + grade * 9) * i.fuelDurationMulti * fuelSaveIncrease;
    const consumption = 5 / fuelDuration;
    const production = gemsPerFire / (timeBetweenFires * i.gameSpeed);
    return {
      grade,
      firesPerFuel: 5 / gemsPerFire,
      fuelDuration,
      breakEvenInterval: fuelDuration / (5 / gemsPerFire),
      netPerHour: (production - consumption) * 3600 * i.gameSpeed,
    };
  });
}

export const froggerCalc: CalculatorDef = {
  id: 'frogger-gems',
  icon: 'drone-frogger.png',
  title: 'Frogger Gem Rate',
  category: 'Gems',
  summary: 'Net gems per hour from fuelling the Frogger drone suit at each grade.',
  source: { name: 'Frogger Gem Rate Calculator', author: 'minnie1089', url: 'https://docs.google.com/spreadsheets/d/1dIJdoyMPoETzPG56U_gnaHpw7K4lvlCecIzXEBJHHyM/' },
  keywords: ['fuel', 'drone', 'gem bomb'],
  sections: [
    {
      title: 'Your stats',
      fields: [
        { kind: 'number', id: 'fuelDurationMulti', label: 'Fuel duration multiplier', default: 1, min: 0.01, step: 0.01, stat: 'coal_fuel_duration_multi' },
        { kind: 'number', id: 'fuelSave', label: 'Fuel save chance', default: 0, min: 0, max: 99, step: 0.1, suffix: '%' },
        { kind: 'number', id: 'freeBomb', label: 'Free bomb chance', default: 0, min: 0, max: 99, step: 0.1, suffix: '%' },
        { kind: 'number', id: 'd20', label: 'D20 charges refilled', default: 20, min: 0, step: 1 },
        { kind: 'number', id: 'cherryTriple', label: 'Cherry bomb triple chance', default: 0, min: 0, max: 100, step: 0.1, suffix: '%' },
        { kind: 'number', id: 'gemChance', label: 'Gem bomb gem chance', default: 3.5, min: 0, max: 100, step: 0.1, suffix: '%' },
        { kind: 'bool', id: 'cherryBattery', label: 'Use cherry charges on battery bombs', default: true, help: 'Off = cherry charges go to gem bombs.' },
        { kind: 'number', id: 'level', label: 'Frogger level', default: 0, min: 0, max: 19, step: 1 },
        { kind: 'number', id: 'gameSpeed', label: 'Game speed', default: 1, min: 0.01, step: 0.01, stat: 'game_speed_multi' },
      ],
    },
  ],
  compute(v) {
    const rows = froggerRates({
      fuelDurationMulti: num(v, 'fuelDurationMulti'), fuelSaveChance: num(v, 'fuelSave') / 100, freeBombChance: num(v, 'freeBomb') / 100,
      d20Charges: num(v, 'd20'), cherryTripleChance: num(v, 'cherryTriple') / 100, gemBombChance: num(v, 'gemChance') / 100,
      cherryBattery: bool(v, 'cherryBattery'), froggerLevel: num(v, 'level'), gameSpeed: num(v, 'gameSpeed'),
    });
    const firstPositive = rows.findIndex((r) => r.netPerHour > 0);
    return {
      outputs: [
        { label: 'Gem-positive from grade', value: firstPositive < 0 ? 'Never (in grades 0–45)' : String(firstPositive), tone: firstPositive < 0 ? 'bad' : 'primary' },
        ...(firstPositive >= 0 ? [{ label: `Net gems/hour at grade ${firstPositive}`, value: formatNum(rows[firstPositive].netPerHour, 2) }] : []),
      ],
      tables: [{
        title: 'Per grade',
        columns: ['Grade', 'Net gems / hour', 'Break-even fire interval (s)'],
        rows: rows.map((r) => [r.grade, formatNum(r.netPerHour, 2), formatNum(r.breakEvenInterval, 2)]),
        highlight: firstPositive < 0 ? undefined : firstPositive,
      }],
      notes: ['"Break-even fire interval" is the longest gap between Frogger fires (in game time) that still pays back the fuel.'],
    };
  },
};
