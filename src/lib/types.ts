import type { ComponentType } from 'preact';

export type Values = Record<string, number | boolean | string>;

interface FieldBase {
  id: string;
  label: string;
  help?: string;
  /** EXPORTSTATS key used by "Fill from EXPORTSTATS". */
  stat?: string;
  /** Read from an exported array instead: [key, 1-based index]. */
  statArray?: [string, number];
  /** Multiply an exported value into this field's unit (e.g. 100 for 0.25 -> 25%). */
  statScale?: number;
  /** Also copy the exported value into this field (e.g. seed a what-if with the current level). */
  statAlso?: string;
}

export interface NumberField extends FieldBase {
  kind: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** Accept game notation (1.2qi, 3e45) and show a text keyboard. */
  big?: boolean;
  suffix?: string;
}

export interface BoolField extends FieldBase {
  kind: 'bool';
  default: boolean;
}

export interface SelectField extends FieldBase {
  kind: 'select';
  default: string;
  options: { value: string; label: string }[];
}

export type Field = NumberField | BoolField | SelectField;

export interface Section {
  title: string;
  note?: string;
  fields: Field[];
  collapsed?: boolean;
}

export type Tone = 'primary' | 'good' | 'bad' | 'muted';

export interface Output {
  label: string;
  value: string;
  tone?: Tone;
  help?: string;
}

export interface Table {
  title: string;
  note?: string;
  columns: string[];
  rows: (string | number)[][];
  highlight?: number;
}

export interface Result {
  outputs: Output[];
  tables?: Table[];
  notes?: string[];
}

export type Category = 'Costs & Gains' | 'Decisions' | 'Gems' | 'Odds' | 'Progression' | 'Wiki Calculators';

export interface Source {
  name: string;
  author?: string;
  url: string;
}

export interface CalculatorDef {
  id: string;
  /** File in public/icons (sprites from the wiki). */
  icon?: string;
  title: string;
  category: Category;
  summary: string;
  source: Source;
  sections: Section[] | ((v: Values) => Section[]);
  compute: (v: Values) => Result;
  /** Fully custom page body, used instead of the generic form. */
  view?: ComponentType<{ def: CalculatorDef }>;
  keywords?: string[];
}

export interface ExternalTool {
  id: string;
  icon?: string;
  title: string;
  category: Category | 'Simulators';
  summary: string;
  source: Source;
  /** Why it isn't ported yet. */
  status: string;
}

export const num = (v: Values, id: string) => {
  const x = v[id];
  if (x === undefined || x === '') return 0;
  return typeof x === 'number' ? x : typeof x === 'boolean' ? (x ? 1 : 0) : Number(x);
};
export const bool = (v: Values, id: string) => v[id] === true;
export const str = (v: Values, id: string) => String(v[id] ?? '');
