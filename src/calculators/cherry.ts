import { formatNum } from '../lib/format';
import { bool, num, type CalculatorDef } from '../lib/types';

interface Bombs { gem: number; cherry: number; battery: number; d20: number; cherryCharges: number; gemsFired: number }

/** Port of tabatkins' simulation: compare the long-run gem bomb stacks of two firing orders. */
export function cherryVsD20(i: { freeBombChance: number; d20Charges: number; tripleCherryChance: number; founderBomb: boolean }) {
  const freeMult = 1 / (1 - i.freeBombChance);
  // Start bombs scaled by recharge time relative to gem bomb (315s).
  const start = (): Bombs => ({ gem: 1, cherry: 315 / 330, battery: 315 / 345, d20: 315 / 400, cherryCharges: 0, gemsFired: 0 });
  const gemFire = (c: Bombs) => {
    c.gemsFired += c.gem * freeMult + c.cherryCharges;
    c.gem = 0;
    c.cherryCharges = 0;
  };
  const cherryFire = (c: Bombs) => {
    c.cherryCharges += c.cherry * (1 + i.tripleCherryChance * 2) * freeMult;
    c.cherry = 0;
  };
  // A battery adds 2 charges spread over ~11.3 other bombs (founder bomb counts partially).
  const batteryFire = (c: Bombs) => {
    const amount = (c.battery * freeMult + c.cherryCharges) * (2 / 11.3);
    c.gem += amount;
    c.cherry += amount;
    c.d20 += amount;
    c.battery = 0;
    c.cherryCharges = 0;
  };
  // A d20 gives N charges 5% of the time, spread over the other bombs.
  const d20Fire = (c: Bombs) => {
    const amount = (c.d20 * freeMult + c.cherryCharges) * ((i.d20Charges * 0.05) / (i.founderBomb ? 11.3 : 11));
    c.gem += amount;
    c.cherry += amount;
    c.battery += amount;
    c.d20 = 0;
    c.cherryCharges = 0;
  };

  const g = start();
  cherryFire(g);
  gemFire(g);
  for (let limit = 1000; g.battery > 0.01 && limit-- > 0; ) {
    batteryFire(g);
    d20Fire(g);
  }
  cherryFire(g);
  gemFire(g);

  const d = start();
  for (let limit = 1000; d.cherry > 0.01 && limit-- > 0; ) {
    cherryFire(d);
    d20Fire(d);
    batteryFire(d);
  }
  gemFire(d);

  return { cherryGem: g.gemsFired, cherryD20: d.gemsFired };
}

export const cherryCalc: CalculatorDef = {
  id: 'cherry-vs-d20',
  title: 'Cherry: Gem vs D20',
  category: 'Decisions',
  summary: 'Should your cherry charges go into Gem Bomb or D20 Bomb?',
  source: { name: 'Cherry into Gem vs D20 Calculator', author: 'Tab Atkins', url: 'https://tabatkins.com/obelisk/cherry/' },
  keywords: ['bomb', 'gem bomb', 'd20'],
  sections: [
    {
      title: 'Your bombs',
      fields: [
        { kind: 'number', id: 'free', label: 'Free bomb chance', default: 20, min: 0, max: 50, step: 1, suffix: '%' },
        { kind: 'number', id: 'd20', label: 'D20 charges', default: 58, min: 20, max: 100, step: 1 },
        { kind: 'number', id: 'triple', label: 'Triple cherry chance', default: 14, min: 0, max: 50, step: 0.5, suffix: '%' },
        { kind: 'bool', id: 'founder', label: 'Have founder bomb', default: true },
      ],
    },
  ],
  compute(v) {
    const r = cherryVsD20({ freeBombChance: num(v, 'free') / 100, d20Charges: num(v, 'd20'), tripleCherryChance: num(v, 'triple') / 100, founderBomb: bool(v, 'founder') });
    const d20Wins = r.cherryD20 > r.cherryGem;
    return {
      outputs: [
        { label: 'Best choice', value: d20Wins ? 'Cherry into D20' : 'Cherry into Gem', tone: 'primary' },
        { label: 'Gem stacks: cherry → gem', value: formatNum(r.cherryGem, 3), tone: d20Wins ? undefined : 'good', help: 'Cherry gem, cycle battery/d20 until exhausted, cherry gem again.' },
        { label: 'Gem stacks: cherry → d20', value: formatNum(r.cherryD20, 3), tone: d20Wins ? 'good' : undefined, help: 'Cycle cherry → d20 → battery until exhausted, then fire gems.' },
        { label: 'Difference', value: `${formatNum((Math.abs(r.cherryD20 - r.cherryGem) / Math.min(r.cherryGem, r.cherryD20)) * 100, 1)}%` },
      ],
      notes: ['Spoiler from the original: cherry → D20 needs the World 4 statue that adds +4 workshop caps before it wins.'],
    };
  },
};
