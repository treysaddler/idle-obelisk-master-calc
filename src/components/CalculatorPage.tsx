import { useEffect, useMemo, useState } from 'preact/hooks';
import { statArrayItem, statNumber } from '../lib/exportStats';
import { formatBig, parseNumber } from '../lib/format';
import { load, remove, save } from '../lib/storage';
import type { CalculatorDef, Field, NumberField, Result, Section, Values } from '../lib/types';
import { useExportStats } from './hooks';

function resolveSections(def: CalculatorDef, v: Values): Section[] {
  return typeof def.sections === 'function' ? def.sections(v) : def.sections;
}

/** Defaults for every field, re-evaluating dynamic sections until stable. */
function withDefaults(def: CalculatorDef, base: Values): Values {
  let v = { ...base };
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const s of resolveSections(def, v)) {
      for (const f of s.fields) {
        if (!(f.id in v)) {
          v[f.id] = f.default;
          changed = true;
        }
        if (f.kind === 'select' && !f.options.some((o) => o.value === v[f.id]) && f.options.length) {
          v[f.id] = f.default && f.options.some((o) => o.value === f.default) ? f.default : f.options[0].value;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return v;
}

function statFor(f: Field): number | undefined {
  const raw = f.statArray ? statArrayItem(f.statArray[0], f.statArray[1]) : f.stat ? statNumber(f.stat) : undefined;
  return raw === undefined ? undefined : raw * (f.statScale ?? 1);
}

function numberText(f: NumberField, value: number) {
  if (!Number.isFinite(value)) return '';
  if (f.big && Math.abs(value) >= 1e6) return value.toExponential(3).replace('e+', 'e').replace(/\.?0+e/, 'e');
  return String(Math.round(value * 1e8) / 1e8);
}

function NumberInput({ f, value, onChange }: { f: NumberField; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => numberText(f, value));
  // Sync when the value changes from outside (reset, EXPORTSTATS fill).
  useEffect(() => {
    if (parseNumber(text) !== value) setText(numberText(f, value));
  }, [value]);
  const parsed = parseNumber(text);
  const invalid = text.trim() !== '' && Number.isNaN(parsed);
  const overMax = f.max !== undefined && parsed > f.max;
  const underMin = f.min !== undefined && parsed < f.min;
  const hint = invalid
    ? 'Not a number'
    : overMax
      ? `Above max (${f.max})`
      : underMin
        ? `Below min (${f.min})`
        : f.big && Number.isFinite(parsed) && Math.abs(parsed) >= 1000
          ? `= ${formatBig(parsed)}`
          : f.max !== undefined
            ? `max ${f.max}`
            : undefined;
  return (
    <div class={`field${invalid || overMax || underMin ? ' warn' : ''}`}>
      <label for={`f-${f.id}`}>{f.label}</label>
      <div class="input-wrap">
        <input
          id={`f-${f.id}`}
          type="text"
          inputMode={f.big ? 'text' : 'decimal'}
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          value={text}
          onInput={(e) => {
            const t = (e.target as HTMLInputElement).value;
            setText(t);
            const n = parseNumber(t);
            onChange(t.trim() === '' ? 0 : n);
          }}
        />
        {f.suffix && <span class="suffix">{f.suffix}</span>}
      </div>
      {(hint || f.help) && <small class={invalid || overMax || underMin ? 'hint warn' : 'hint'}>{hint ?? f.help}{hint && f.help ? ` · ${f.help}` : ''}</small>}
    </div>
  );
}

function FieldInput({ f, values, set }: { f: Field; values: Values; set: (id: string, v: Values[string]) => void }) {
  if (f.kind === 'number') return <NumberInput f={f} value={Number(values[f.id])} onChange={(n) => set(f.id, n)} />;
  if (f.kind === 'bool') {
    return (
      <div class="field toggle-field">
        <label class="toggle">
          <input type="checkbox" checked={values[f.id] === true} onChange={(e) => set(f.id, (e.target as HTMLInputElement).checked)} />
          <span class="track" aria-hidden="true" />
          <span>{f.label}</span>
        </label>
        {f.help && <small class="hint">{f.help}</small>}
      </div>
    );
  }
  return (
    <div class="field">
      <label for={`f-${f.id}`}>{f.label}</label>
      <select id={`f-${f.id}`} value={String(values[f.id])} onChange={(e) => set(f.id, (e.target as HTMLSelectElement).value)}>
        {f.options.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}
      </select>
      {f.help && <small class="hint">{f.help}</small>}
    </div>
  );
}

function Results({ result }: { result: Result }) {
  return (
    <div class="results" id="results">
      <div class="outputs">
        {result.outputs.map((o) => (
          <div class={`output ${o.tone ?? ''}`} key={o.label}>
            <span class="output-label">{o.label}</span>
            <span class="output-value">{o.value}</span>
            {o.help && <small class="hint">{o.help}</small>}
          </div>
        ))}
      </div>
      {result.tables?.map((t) => (
        <details class="card table-card" open key={t.title}>
          <summary>{t.title}</summary>
          {t.note && <p class="muted">{t.note}</p>}
          <div class="table-scroll">
            <table>
              <thead><tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i} class={i === t.highlight ? 'hl' : undefined}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      {result.notes?.map((n) => <p class="note" key={n}>{n}</p>)}
    </div>
  );
}

export function CalculatorPage({ def }: { def: CalculatorDef }) {
  const storeKey = `calc:${def.id}`;
  const [values, setValues] = useState<Values>(() => withDefaults(def, load<Values>(storeKey, {})));
  const [resetKey, setResetKey] = useState(0);
  const [toast, setToast] = useState('');
  const stats = useExportStats();

  useEffect(() => {
    setValues(withDefaults(def, load<Values>(storeKey, {})));
    window.scrollTo(0, 0);
  }, [def.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const sections = resolveSections(def, values);
  const result = useMemo(() => {
    try {
      return def.compute(values);
    } catch (e) {
      console.error(e);
      return { outputs: [{ label: 'Error', value: 'Could not calculate with these inputs', tone: 'bad' as const }] };
    }
  }, [def, values]);

  const set = (id: string, v: Values[string]) => {
    setValues((prev) => {
      const next = withDefaults(def, { ...prev, [id]: v });
      save(storeKey, next);
      return next;
    });
  };

  const statFields = sections.flatMap((s) => s.fields).filter((f) => f.stat || f.statArray);
  const fillFromStats = () => {
    let filled = 0;
    const next = { ...values };
    for (const f of statFields) {
      const x = statFor(f);
      if (x === undefined) continue;
      next[f.id] = f.kind === 'bool' ? x !== 0 : x;
      if (f.statAlso) next[f.statAlso] = next[f.id];
      filled++;
    }
    const merged = withDefaults(def, next);
    setValues(merged);
    save(storeKey, merged);
    setResetKey((k) => k + 1);
    setToast(filled ? `Filled ${filled} field${filled === 1 ? '' : 's'} from EXPORTSTATS` : 'None of these fields were in your EXPORTSTATS');
  };

  const reset = () => {
    remove(storeKey);
    setValues(withDefaults(def, {}));
    setResetKey((k) => k + 1);
    setToast('Inputs reset');
  };

  const primary = result.outputs.find((o) => o.tone === 'primary') ?? result.outputs[0];
  const View = def.view;

  return (
    <div class="calc-page">
      <header class="calc-head">
        <a href="#/" class="back">‹ All calculators</a>
        <h1>{def.title}</h1>
        <p class="muted">{def.summary}</p>
        <p class="credit">
          Ported from <a href={def.source.url} target="_blank" rel="noopener noreferrer">{def.source.name}</a>
          {def.source.author ? <> by {def.source.author}</> : null}.
        </p>
      </header>

      {View ? (
        <View def={def} />
      ) : (
        <>
          <div class="toolbar">
            {statFields.length > 0 && (
              stats
                ? <button class="btn" onClick={fillFromStats}>Fill from EXPORTSTATS</button>
                : <a class="btn ghost" href="#/stats">Add EXPORTSTATS to auto-fill</a>
            )}
            <button class="btn ghost" onClick={reset}>Reset</button>
          </div>
          <div class="calc-grid">
            <form class="calc-form" key={resetKey} onSubmit={(e) => e.preventDefault()}>
              {sections.map((s, i) => (
                <details class="card section" open={!s.collapsed || i === 0} key={s.title}>
                  <summary>{s.title}</summary>
                  {s.note && <p class="muted">{s.note}</p>}
                  <div class="fields">
                    {s.fields.map((f) => <FieldInput f={f} values={values} set={set} key={f.id} />)}
                  </div>
                </details>
              ))}
            </form>
            <aside class="calc-results">
              <Results result={result} />
            </aside>
          </div>
          {primary && (
            <a class="result-bar" href="#results" onClick={(e) => { e.preventDefault(); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <span>{primary.label}</span>
              <strong>{primary.value}</strong>
            </a>
          )}
        </>
      )}
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}
