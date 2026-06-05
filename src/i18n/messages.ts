import 'server-only';
import type { Locale } from './config';
import en from '../../messages/en.json';
import de from '../../messages/de.json';

const CATALOG: Record<Locale, Record<string, unknown>> = { en, de };

/** Load the full message catalog for a locale (used by RSC + server channels). */
export function loadMessages(locale: Locale): Record<string, unknown> {
  return CATALOG[locale] ?? en;
}
