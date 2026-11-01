import { useEffect, useState } from 'preact/hooks';
import { byId, calculators, CATEGORY_ORDER } from './calculators';
import { externalTools } from './calculators/external';
import { CalculatorPage } from './components/CalculatorPage';
import { CATEGORY_ICONS, Icon } from './components/Icon';
import { useExportStats, useHashRoute } from './components/hooks';
import { StatsPage } from './components/StatsPage';
import { setNotation, type Notation } from './lib/format';
import { load, save } from './lib/storage';

function Home() {
  const [q, setQ] = useState('');
  const stats = useExportStats();
  const needle = q.trim().toLowerCase();
  const match = (...parts: (string | undefined)[]) => !needle || parts.join(' ').toLowerCase().includes(needle);
  const calcs = calculators.filter((c) => match(c.title, c.summary, c.category, c.source.name, ...(c.keywords ?? [])));
  const ext = externalTools.filter((t) => match(t.title, t.summary, t.category, t.source.name));

  return (
    <div class="home">
      <section class="hero">
        <h1>Idle Obelisk Miner calculators</h1>
        <p class="muted">The community's calculators from the wiki, in one mobile-friendly app. Inputs save on your device.</p>
        <a class={`stats-banner${stats ? ' ok' : ''}`} href="#/stats">
          {stats ? 'EXPORTSTATS saved — calculators can auto-fill' : 'Paste your EXPORTSTATS once to auto-fill calculators ›'}
        </a>
        <input class="search" type="search" placeholder="Search calculators…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search calculators" />
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const list = calcs.filter((c) => c.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h2 class="cat"><Icon file={CATEGORY_ICONS[cat]} size={20} />{cat}</h2>
            <div class="tiles">
              {list.map((c) => (
                <a class="tile" href={`#/c/${c.id}`} key={c.id}>
                  <Icon file={c.icon} />
                  <div class="tile-text">
                    <strong>{c.title}</strong>
                    <span>{c.summary}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      })}

      {ext.length > 0 && (
        <section>
          <h2 class="cat">Not ported yet</h2>
          <p class="muted">These open the original tool in a new tab.</p>
          <div class="tiles">
            {ext.map((t) => (
              <a class="tile external" href={t.source.url} target="_blank" rel="noopener noreferrer" key={t.id}>
                <Icon file={t.icon} />
                <div class="tile-text">
                  <strong>{t.title} ↗</strong>
                  <span>{t.summary}</span>
                  <small>{t.status}</small>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {!calcs.length && !ext.length && <p class="muted">Nothing matches “{q}”.</p>}
    </div>
  );
}

export function App() {
  const route = useHashRoute();
  const [notation, setNotationState] = useState<Notation>(() => load<Notation>('notation', 'game'));
  setNotation(notation);

  useEffect(() => save('notation', notation), [notation]);

  let page;
  if (route.startsWith('c/')) {
    const def = byId.get(route.slice(2));
    page = def ? <CalculatorPage def={def} key={`${def.id}:${notation}`} /> : <p class="muted">Calculator not found. <a href="#/">Back</a></p>;
  } else if (route === 'stats') {
    page = <StatsPage />;
  } else {
    page = <Home />;
  }

  return (
    <>
      <header class="topbar">
        <a href="#/" class="brand">
          <img src="icon.svg" alt="" width="28" height="28" />
          <span>Obelisk Calc</span>
        </a>
        <div class="topbar-actions">
          <button
            class="chip"
            title="Number notation"
            onClick={() => setNotationState(notation === 'game' ? 'scientific' : 'game')}
          >
            {notation === 'game' ? '1.2qi' : '1.2e18'}
          </button>
          <a class="chip" href="#/stats">Stats</a>
        </div>
      </header>
      <main>{page}</main>
      <footer class="footer">
        <p>
          Community tool, not affiliated with Checkbox Team. Every calculator credits and links its original author. Source list:{' '}
          <a href="https://shminer.miraheze.org/wiki/External_Resources" target="_blank" rel="noopener noreferrer">wiki External Resources</a>.
          {' '}Game icons are Idle Obelisk Miner art by Checkbox Team, via the{' '}
          <a href="https://shminer.miraheze.org/" target="_blank" rel="noopener noreferrer">Idle Obelisk Miner Wiki</a>;
          interface icons are <a href="https://tabler.io/icons" target="_blank" rel="noopener noreferrer">Tabler Icons</a> (MIT).
        </p>
      </footer>
    </>
  );
}
