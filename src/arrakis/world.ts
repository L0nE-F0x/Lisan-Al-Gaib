/**
 * Year-derived state for the Arrakis atlas: planet name, greening, storms, faction colours,
 * place kinds. Pure helpers over `lore`, no DOM.
 */
import { lore } from '../data/index.ts';
import { controlAt, nameAt, placeExists, whereaboutsAt } from '../data/query.ts';
import type { ArrakisPlace, ArrakisRegion, Character, Faction, PlaceKind, Year } from '../data/types.ts';
import { clamp } from '../shared/dom.ts';

export const BOOK_TITLES: Record<string, string> = Object.fromEntries(lore.books.map((b) => [b.id, b.title]));

const factionById = new Map<string, Faction>(lore.factions.map((f) => [f.id, f]));
const regionById = new Map<string, ArrakisRegion>(lore.arrakis.regions.map((r) => [r.id, r]));
const placeById = new Map<string, ArrakisPlace>(lore.arrakis.places.map((p) => [p.id, p]));
const charById = new Map<string, Character>(lore.characters.map((c) => [c.id, c]));

export const NEUTRAL = '#c8a97a';

export function faction(id: string | undefined): Faction | undefined {
  return id ? factionById.get(id) : undefined;
}
export function factionColor(id: string | undefined): string {
  return faction(id)?.color ?? NEUTRAL;
}
export function factionName(id: string | undefined): string {
  return faction(id)?.name ?? (id ? humanize(id) : 'Unrecorded');
}
export function region(id: string | undefined): ArrakisRegion | undefined {
  return id ? regionById.get(id) : undefined;
}
export function place(id: string | undefined): ArrakisPlace | undefined {
  return id ? placeById.get(id) : undefined;
}
export function character(id: string | undefined): Character | undefined {
  return id ? charById.get(id) : undefined;
}
export function bodyName(id: string, year: Year): string {
  const b = lore.bodies.find((x) => x.id === id);
  return b ? nameAt(b.name, b.names, year) : humanize(id);
}

export function humanize(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Arrakis" or "Rakis", from the universe data. */
export function planetName(year: Year): string {
  return bodyName('arrakis', year) || 'Arrakis';
}

export const KIND_LABEL: Record<PlaceKind, string> = {
  city: 'City',
  sietch: 'Sietch',
  fortress: 'Fortress',
  landmark: 'Landmark',
  basin: 'Basin',
  station: 'Station',
  shrine: 'Shrine',
};

/** Label priority for collision avoidance (higher wins). */
export const KIND_PRIORITY: Record<PlaceKind, number> = {
  city: 6,
  fortress: 5,
  sietch: 4,
  shrine: 3,
  station: 2,
  basin: 2,
  landmark: 1,
};

export function placeName(p: ArrakisPlace, year: Year): string {
  return nameAt(p.name, p.names, year);
}
export function placeController(p: ArrakisPlace, year: Year): string | undefined {
  return controlAt(p.control ?? [], year)?.faction;
}
export function placeAt(p: ArrakisPlace, year: Year): boolean {
  return placeExists(p, year);
}

// ---------------------------------------------------------------------------
// Ecology over time

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Leto II's green Arrakis. Canon: Kynes's plan begins to show after Muad'Dib (plantings and
 * open water by Children of Dune, ~10219); by God Emperor (~13725) the planet is largely green
 * except the preserved Sareer; after the Tyrant's death the worms and the desert return, and by
 * Heretics (~15225) Rakis is desert again.
 */
export function greeningAt(year: Year): number {
  if (year < 10195) return 0;
  if (year < 10220) return 0.14 * smooth(10195, 10220, year);
  if (year < 13725) return 0.14 + 0.86 * smooth(10220, 13000, year);
  return 1 - smooth(13725, 14500, year);
}

/** Coriolis storm coverage: fierce on the desert world, calmed by greening, gone on a dead Rakis. */
export function stormsAt(year: Year): number {
  if (scorchedAt(year)) return 0.9; // ash and glass-dust over the burned world
  return 0.6 * (1 - greeningAt(year) * 0.85);
}

/** After the Honored Matres sterilise Rakis (Chapterhouse). Uses the planet's control history. */
const arrakisBody = lore.bodies.find((b) => b.id === 'arrakis');
export function scorchedAt(year: Year): boolean {
  const c = arrakisBody ? controlAt(arrakisBody.control, year) : undefined;
  return c?.faction === 'honored-matres';
}

/** The Sareer (Leto II's preserved desert), if the data defines it. */
export function sareerPoint(): { lat: number; lon: number } | undefined {
  const r = lore.arrakis.regions.find((x) => /sareer/i.test(x.id) || /sareer/i.test(x.name));
  if (r) return r;
  const p = lore.arrakis.places.find((x) => /sareer/i.test(x.id) || /sareer/i.test(x.name));
  return p;
}

export function eraColor(year: Year): string {
  for (const e of lore.eras) if (year >= e.start && year <= e.end) return e.color;
  return lore.eras.length ? (year < lore.eras[0].start ? lore.eras[0].color : lore.eras[lore.eras.length - 1].color) : '#f0a44a';
}

/** Arrakis-relevant events for the timeline. */
export const arrakisEvents = lore.events
  .filter((e) => e.body === 'arrakis' || !!e.place || (!e.body && !e.place))
  .sort((a, b) => a.year - b.year);

export function eventsAtPlace(id: string) {
  return arrakisEvents.filter((e) => e.place === id);
}

/** Characters alive and at this Arrakis place in this year. */
export function charactersAt(placeId: string, year: Year): Character[] {
  return lore.characters.filter((c) => {
    const w = whereaboutsAt(c, year);
    return w?.body === 'arrakis' && w.place === placeId;
  });
}

/** Characters alive and somewhere on Arrakis in this year. */
export function charactersOnArrakis(year: Year): Character[] {
  return lore.characters.filter((c) => whereaboutsAt(c, year)?.body === 'arrakis');
}
