import { test, expect } from 'vitest';
import en from './en.json';
import gr from './gr.json';

/** Every leaf path in an object, dot-joined and sorted. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

test('en and gr expose exactly the same key paths', () => {
  const a = keyPaths(en).sort();
  const b = keyPaths(gr).sort();

  expect(b.filter((k) => !a.includes(k)), 'keys in gr.json missing from en.json').toEqual([]);
  expect(a.filter((k) => !b.includes(k)), 'keys in en.json missing from gr.json').toEqual([]);
});

test('no locale ships an empty or whitespace-only string', () => {
  for (const [name, data] of [['en', en], ['gr', gr]] as const) {
    const blank = keyPaths(data).filter((path) => {
      const value = path.split('.').reduce<any>((acc, k) => acc?.[k], data);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(blank, `${name}.json has blank values`).toEqual([]);
  }
});
