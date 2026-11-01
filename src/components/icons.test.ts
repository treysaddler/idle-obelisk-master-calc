import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UI_ICONS } from './uiIcons';

const iconsDir = new URL('../../public/icons/', import.meta.url);
const srcDir = new URL('../', import.meta.url);

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(new URL(`${e.name}/`, dir)) : /\.(ts|tsx)$/.test(e.name) ? [new URL(e.name, dir)] : [],
  );
}

describe('icons', () => {
  it('every icon referenced in code exists', () => {
    const missing: string[] = [];
    for (const file of sourceFiles(srcDir)) {
      const text = readFileSync(file, 'utf-8');
      for (const [, name] of text.matchAll(/'([a-z0-9-]+\.png)'/g)) {
        if (!existsSync(new URL(name, iconsDir))) missing.push(`${name} (${file.pathname.split('/src/')[1]})`);
      }
      for (const [, name] of text.matchAll(/'tabler:([a-z0-9-]+)'/g)) {
        if (!UI_ICONS[name]) missing.push(`tabler:${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
