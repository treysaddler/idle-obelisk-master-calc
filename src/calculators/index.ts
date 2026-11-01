import type { CalculatorDef } from '../lib/types';
import { w3ChecklistCalc } from '../components/Checklist';
import { bestFloorCalc } from './bestFloor';
import { bestVeinsCalc } from './bestVeins';
import { cherryCalc } from './cherry';
import { contractCalc } from './contracts';
import { droneCardsCalc } from './droneCards';
import { froggerCalc } from './frogger';
import { obeliskFightCalc } from './obeliskFight';
import { pickaxeCalc } from './pickaxe';
import { relicCalc } from './relics';
import { skillPointCalc } from './skills';
import { transmuterCalc } from './transmuter';
import { wikiCalculators } from './wiki';

export const calculators: CalculatorDef[] = [
  pickaxeCalc,
  skillPointCalc,
  obeliskFightCalc,
  contractCalc,
  bestFloorCalc,
  bestVeinsCalc,
  transmuterCalc,
  cherryCalc,
  froggerCalc,
  droneCardsCalc,
  relicCalc,
  w3ChecklistCalc,
  ...wikiCalculators,
];

export const byId = new Map(calculators.map((c) => [c.id, c]));

export const CATEGORY_ORDER = ['Costs & Gains', 'Decisions', 'Gems', 'Odds', 'Progression', 'Wiki Calculators', 'Simulators'] as const;
