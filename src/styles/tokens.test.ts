import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');

/** Reads a custom property's value out of the :root block. */
function token(name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`token --${name} is not defined in tokens.css`);
  return match[1].trim();
}

function relativeLuminance(hex: string): number {
  const channels = hex.replace('#', '').match(/../g)!.map((pair) => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('the palette matches the approved values exactly', () => {
  expect(token('c-deep-sea')).toBe('#0B3C53');
  expect(token('c-sivota-blue')).toBe('#006994');
  expect(token('c-olive')).toBe('#5A6639');
  expect(token('c-ink')).toBe('#1B2A32');
  expect(token('c-sand')).toBe('#E9E1D5');
  expect(token('c-limestone')).toBe('#F7F4EF');
});

test('every colour pair in use clears AA for body text', () => {
  const pairs: [string, string][] = [
    ['c-ink', 'c-limestone'],
    ['c-ink', 'c-sand'],
    ['c-deep-sea', 'c-limestone'],
    ['c-deep-sea', 'c-sand'],
    ['c-sivota-blue', 'c-limestone'],
    ['c-olive', 'c-limestone'],
    ['c-white', 'c-deep-sea'],
    ['c-white', 'c-sivota-blue'],
    ['c-white', 'c-olive'],
  ];

  for (const [fg, bg] of pairs) {
    const ratio = contrast(token(fg), token(bg));
    // 4.5:1 is the body-text threshold. Large-text 3:1 is deliberately not
    // used here: these colours carry ordinary paragraphs, not just headings.
    expect(ratio, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test('the type and spacing scales are defined', () => {
  for (const name of [
    'fs-display-xl', 'fs-display-l', 'fs-display-m',
    'fs-lead', 'fs-body', 'fs-small', 'fs-eyebrow',
    'sp-1', 'sp-4', 'sp-7', 'sp-10',
    'ease-out', 'dur-fast', 'dur', 'dur-slow',
    'font-display', 'font-body',
  ]) {
    expect(() => token(name), `--${name} missing`).not.toThrow();
  }
});
