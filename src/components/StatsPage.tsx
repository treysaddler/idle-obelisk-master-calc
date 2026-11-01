import { useState } from 'preact/hooks';
import { clearExportStats, countStats, parseExportStats, setExportStats } from '../lib/exportStats';
import { useExportStats } from './hooks';

export function StatsPage() {
  const stats = useExportStats();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const apply = (t: string) => {
    try {
      setExportStats(parseExportStats(t));
      setText('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that.');
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setText(t);
      apply(t);
    } catch {
      setError('Clipboard access was blocked. Long-press the box below and paste instead.');
    }
  };

  return (
    <div class="calc-page">
      <header class="calc-head">
        <a href="#/" class="back">‹ All calculators</a>
        <h1>Your EXPORTSTATS</h1>
        <p class="muted">
          Paste your stats once and every calculator can fill itself in. In the game, open the code menu and enter{' '}
          <code>EXPORTSTATS</code> — it copies your stats to the clipboard.
        </p>
      </header>

      {stats && (
        <section class="card">
          <div class="card-head">
            <h2>Saved on this device</h2>
            <span class="pill">{countStats()} stats</span>
          </div>
          <p class="muted">Updated {new Date(stats.updatedAt).toLocaleString()}.</p>
          <p class="muted">Stats never leave your browser. Re-export after big upgrades or when you change floors (game speed changes per floor).</p>
          <button class="btn ghost" onClick={clearExportStats}>Delete saved stats</button>
        </section>
      )}

      <section class="card">
        <h2>{stats ? 'Replace with a new export' : 'Add your export'}</h2>
        <button class="btn" onClick={paste}>Paste from clipboard</button>
        <textarea
          rows={8}
          placeholder='{"stats": { "pickaxe_damage": ... } }'
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
        {error && <p class="error">{error}</p>}
        <button class="btn" disabled={!text.trim()} onClick={() => apply(text)}>Save stats</button>
      </section>
    </div>
  );
}
