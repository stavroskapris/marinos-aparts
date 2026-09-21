import type { Locale } from './locales';
import en from './en.json';
import gr from './gr.json';

export type Strings = typeof en;

const DATA: Record<Locale, Strings> = { en, gr: gr as Strings };

export function t(locale: Locale): Strings {
  return DATA[locale];
}
