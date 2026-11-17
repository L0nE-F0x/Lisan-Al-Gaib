/**
 * Pure, timeline-aware lookups over the lore. Every view (hub, Arrakis, Universe)
 * must use these instead of reading `control[0]` or `name` directly, so that what is
 * shown always matches the selected year.
 */
import type {
  ArrakisPlace,
  Body,
  Character,
  ControlEntry,
  Era,
  LoreEvent,
  NameEntry,
  Span,
  Whereabouts,
  Year,
} from './types.ts';

/** Last entry whose `from` <= year, or undefined if year is before the first entry. Entries must be sorted. */
export function entryAt<T extends { from: Year }>(entries: readonly T[] | undefined, year: Year): T | undefined {
  if (!entries || entries.length === 0) return undefined;
  let found: T | undefined;
  for (const e of entries) {
    if (e.from <= year) found = e;
    else break;
  }
  return found;
}

export function controlAt(entries: readonly ControlEntry[], year: Year): ControlEntry | undefined {
  return entryAt(entries, year);
}

/** The next control change strictly after `year`, if any (used to cross-fade colours). */
export function nextControl(entries: readonly ControlEntry[], year: Year): ControlEntry | undefined {
  return entries.find((e) => e.from > year);
}

export function nameAt(base: string, names: readonly NameEntry[] | undefined, year: Year): string {
  return entryAt(names, year)?.name ?? base;
}

export function inSpan(span: Span | undefined, year: Year): boolean {
  if (!span) return true;
  if (span.from !== undefined && year < span.from) return false;
  if (span.to !== undefined && year > span.to) return false;
  return true;
}

export function bodyExists(b: Body, year: Year): boolean {
  return inSpan(b.exists, year);
}

export function placeExists(p: ArrakisPlace, year: Year): boolean {
  return inSpan(p.exists, year);
}

export function isAlive(c: Character, year: Year): boolean {
  if (c.born !== undefined && year < c.born) return false;
  if (c.died !== undefined && year > c.died) return false;
  return true;
}

/** Age in whole years, or undefined if birth unknown / not alive. */
export function ageAt(c: Character, year: Year): number | undefined {
  if (c.born === undefined || !isAlive(c, year)) return undefined;
  return Math.floor(year - c.born);
}

export function whereaboutsAt(c: Character, year: Year): Whereabouts | undefined {
  if (!isAlive(c, year)) return undefined;
  return entryAt(c.whereabouts, year);
}

export type LifeStatus = 'unborn' | 'alive' | 'dead';

export function lifeStatus(c: Character, year: Year): LifeStatus {
  if (c.born !== undefined && year < c.born) return 'unborn';
  if (c.died !== undefined && year > c.died) return 'dead';
  return 'alive';
}

export function eraAt(eras: readonly Era[], year: Year): Era {
  // Eras are contiguous and sorted; fall back to the nearest.
  for (const e of eras) if (year >= e.start && year <= e.end) return e;
  return year < eras[0].start ? eras[0] : eras[eras.length - 1];
}

/** Events with prevYear < year <= nextYear, in order. Handles several events in the same year. */
export function eventsCrossed(events: readonly LoreEvent[], prevYear: Year, nextYear: Year): LoreEvent[] {
  if (nextYear <= prevYear) return [];
  return events.filter((e) => e.year > prevYear && e.year <= nextYear);
}

/** Format a year for display: 10191 -> "10,191 AG", -1287 -> "1,287 BG". */
export function formatYear(year: Year, opts: { short?: boolean } = {}): string {
  const y = Math.floor(year);
  const abs = Math.abs(y === 0 ? 1 : y).toLocaleString('en-US');
  const suffix = y < 0 ? 'BG' : 'AG';
  return opts.short ? `${abs}` : `${abs} ${suffix}`;
}

/** Screen-reader friendly year text. */
export function spokenYear(year: Year): string {
  const y = Math.floor(year);
  return y < 0 ? `${Math.abs(y)} Before Guild` : `${y} After Guild`;
}
