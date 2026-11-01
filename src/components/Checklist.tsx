import { useState } from 'preact/hooks';
import data from '../data/w3checklist.json';
import { load, save } from '../lib/storage';
import type { CalculatorDef } from '../lib/types';

interface ChecklistData {
  intro: string[];
  main: { text: string; sub: boolean }[];
  side: { title: string; note: string | null; items: string[] }[];
}
const D = data as ChecklistData;
const KEY = 'checklist:w3';

function Checklist() {
  const [done, setDone] = useState<Record<string, boolean>>(() => load(KEY, {}));
  const toggle = (k: string) => {
    const next = { ...done, [k]: !done[k] };
    setDone(next);
    save(KEY, next);
  };
  const mainDone = D.main.filter((_, i) => done['m' + i]).length;
  const item = (k: string, text: string, sub = false) => (
    <li key={k} class={sub ? 'sub' : undefined}>
      <label class="check">
        <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} />
        <span>{text}</span>
      </label>
    </li>
  );

  return (
    <div class="checklist">
      {D.intro.map((p) => <p class="muted" key={p}>{p}</p>)}
      <section class="card">
        <div class="card-head">
          <h2>Main path</h2>
          <span class="pill">{mainDone} / {D.main.length}</span>
        </div>
        <div class="progress"><div style={{ width: `${(mainDone / D.main.length) * 100}%` }} /></div>
        <ul class="checks">{D.main.map((m, i) => item('m' + i, m.text, m.sub))}</ul>
      </section>
      <section class="card">
        <h2>Side quests</h2>
        <p class="muted">Do these whenever you reach the breakpoint.</p>
        {D.side.map((g, gi) => (
          <div class="side-group" key={g.title}>
            <h3>{g.title}</h3>
            {g.note && <p class="muted">{g.note}</p>}
            <ul class="checks">{g.items.map((t, i) => item(`s${gi}-${i}`, t))}</ul>
          </div>
        ))}
      </section>
      <button class="btn ghost" onClick={() => { setDone({}); save(KEY, {}); }}>Clear all checks</button>
    </div>
  );
}

export const w3ChecklistCalc: CalculatorDef = {
  id: 'w3-checklist',
  icon: 'world-3-monument.png',
  title: 'Late World 3 Checklist',
  category: 'Progression',
  summary: 'Step-by-step late World 3 progression and World 4 prep, with saved checkmarks.',
  source: { name: 'Late World 3 Checklist', author: 'Frugal Leopard', url: 'https://docs.google.com/spreadsheets/d/1of17QvuwOt1zK11fu8jygcZvvu7vplSmdfSfNQyBz1o/edit?gid=0' },
  keywords: ['world 4', 'progression', 'guide'],
  sections: [],
  compute: () => ({ outputs: [] }),
  view: Checklist,
};
