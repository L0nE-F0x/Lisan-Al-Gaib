/**
 * Derived, year-aware model of the Known Universe: id lookups, system membership,
 * stylised (but deterministic) orbital mechanics, and control/colour state per year.
 *
 * World units: the systems' x/y from the data (roughly -1000..1000). Planet orbits are
 * `body.orbit * ORBIT_UNIT` world units around their star; moons orbit their `parent`.
 */
import { lore } from '../data/index.ts';
import { bodyExists, controlAt, nameAt, nextControl } from '../data/query.ts';
import type { Body, Character, ControlEntry, Faction, LoreEvent, StarSystem, Year } from '../data/types.ts';

export const ORBIT_UNIT = 13;
/** Visual radius of a star's core, in world units. */
export const STAR_R = 3.2;
/** Territory glow radius around a controlled system, world units. */
export const TERRITORY_R = 150;

export const issues: string[] = [];

export const systemById = new Map<string, StarSystem>(lore.systems.map((s) => [s.id, s]));
export const bodyById = new Map<string, Body>(lore.bodies.map((b) => [b.id, b]));
export const characterById = new Map<string, Character>(lore.characters.map((c) => [c.id, c]));
export const eventById = new Map<string, LoreEvent>(lore.events.map((e) => [e.id, e]));
export const factionById = new Map<string, Faction>(lore.factions.map((f) => [f.id, f]));
export const bookById = new Map(lore.books.map((b) => [b.id, b]));

/** Events sorted by year (stable), the order every view uses. */
export const eventsSorted: LoreEvent[] = [...lore.events].sort((a, b) => a.year - b.year);

/** Planets/stations per system (sorted by orbit) and moons per parent body. */
export const planetsBySystem = new Map<string, Body[]>();
export const moonsByParent = new Map<string, Body[]>();

for (const s of lore.systems) planetsBySystem.set(s.id, []);
for (const b of lore.bodies) {
  if (!systemById.has(b.system)) {
    issues.push(`body "${b.id}" references unknown system "${b.system}"`);
    continue;
  }
  if (b.kind === 'moon') {
    const parent = b.parent ? bodyById.get(b.parent) : undefined;
    if (!parent) {
      issues.push(`moon "${b.id}" has unknown parent "${b.parent ?? ''}"; drawn as a planet`);
      planetsBySystem.get(b.system)!.push(b);
      continue;
    }
    if (parent.system !== b.system) issues.push(`moon "${b.id}" is in a different system from its parent`);
    const list = moonsByParent.get(parent.id) ?? [];
    list.push(b);
    moonsByParent.set(parent.id, list);
  } else {
    planetsBySystem.get(b.system)!.push(b);
  }
}
for (const list of planetsBySystem.values()) list.sort((a, b) => a.orbit - b.orbit);
for (const list of moonsByParent.values()) list.sort((a, b) => a.orbit - b.orbit);

for (const b of lore.bodies) {
  for (const c of b.control) if (!factionById.has(c.faction)) issues.push(`body "${b.id}" control references unknown faction "${c.faction}"`);
  for (let i = 1; i < b.control.length; i++) if (b.control[i].from < b.control[i - 1].from) issues.push(`body "${b.id}" control entries are not sorted`);
}
for (const c of lore.characters) {
  for (const w of c.whereabouts) if (!bodyById.has(w.body)) issues.push(`character "${c.id}" whereabouts references unknown body "${w.body}"`);
  for (const r of c.relations) if (!characterById.has(r.id)) issues.push(`character "${c.id}" relation references unknown character "${r.id}"`);
}
for (const e of lore.events) {
  if (e.body && !bodyById.has(e.body)) issues.push(`event "${e.id}" references unknown body "${e.body}"`);
  for (const id of e.characters ?? []) if (!characterById.has(id)) issues.push(`event "${e.id}" references unknown character "${id}"`);
}

// ---------------------------------------------------------------------------
// Map bounds and decorative lanes
// ---------------------------------------------------------------------------

const xs = lore.systems.map((s) => s.x);
const ys = lore.systems.map((s) => s.y);
const PAD = 240;
export const bounds = {
  minX: Math.min(0, ...xs) - PAD,
  maxX: Math.max(0, ...xs) + PAD,
  minY: Math.min(0, ...ys) - PAD,
  maxY: Math.max(0, ...ys) + PAD,
};

/** Minimum spanning tree between systems: faint decorative fold-space lanes. */
export const lanes: [StarSystem, StarSystem][] = (() => {
  const out: [StarSystem, StarSystem][] = [];
  const list = lore.systems;
  if (list.length < 2) return out;
  const inTree = new Set<number>([0]);
  while (inTree.size < list.length) {
    let best = Infinity;
    let pair: [number, number] = [0, 0];
    for (const i of inTree) {
      for (let j = 0; j < list.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
        if (d < best) {
          best = d;
          pair = [i, j];
        }
      }
    }
    inTree.add(pair[1]);
    out.push([list[pair[0]], list[pair[1]]]);
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Planet disc radius in world units. */
export function bodyRadius(b: Body): number {
  const s = clampN(Number.isFinite(b.size) ? b.size : 1, 0.05, 4);
  return b.kind === 'moon' ? 0.22 + s * 1.1 : 0.9 + s * 1.1;
}

/** Orbit radius around the star (planets) or the parent (moons), world units. */
export function orbitRadius(b: Body): number {
  const o = Number.isFinite(b.orbit) ? Math.max(0.05, b.orbit) : 1;
  if (b.kind === 'moon' && b.parent && bodyById.has(b.parent)) {
    return bodyRadius(bodyById.get(b.parent)!) * 1.9 + o * 16;
  }
  return Math.max(0.8, o) * ORBIT_UNIT;
}

/** Orbital period in years (stylised, slow enough to watch while the timeline plays). */
export function periodYears(b: Body): number {
  const o = Number.isFinite(b.orbit) ? Math.max(0.05, b.orbit) : 1;
  if (b.kind === 'moon' && b.parent && bodyById.has(b.parent)) return 6 * Math.pow(o / 0.2, 1.5);
  return 60 * Math.pow(Math.max(0.8, o) / 3, 1.5);
}

/** Deterministic orbital angle at a given year. */
export function angleAt(b: Body, year: Year): number {
  const p = periodYears(b);
  return Math.PI * 2 * (hash01(b.id) + (year % p) / p);
}

/** Outer edge of a system's drawn content, world units. */
export function systemRadius(systemId: string): number {
  let r = STAR_R * 4;
  for (const b of planetsBySystem.get(systemId) ?? []) {
    let extra = bodyRadius(b);
    for (const m of moonsByParent.get(b.id) ?? []) extra = Math.max(extra, orbitRadius(m) + bodyRadius(m));
    r = Math.max(r, orbitRadius(b) + extra);
  }
  return r;
}

export interface Pos {
  x: number;
  y: number;
  /** Angle from the star (planets) or parent (moons). */
  a: number;
}

/** World position of a body at `year`. Moons orbit their parent's position. */
export function positionAt(b: Body, year: Year): Pos {
  const sys = systemById.get(b.system);
  const sx = sys?.x ?? 0;
  const sy = sys?.y ?? 0;
  const parent = b.kind === 'moon' && b.parent ? bodyById.get(b.parent) : undefined;
  if (parent && parent.kind !== 'moon') {
    const p = positionAt(parent, year);
    const a = angleAt(b, year);
    const r = orbitRadius(b);
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, a };
  }
  const a = angleAt(b, year);
  const r = orbitRadius(b);
  return { x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r, a };
}

/** A body is drawn when it exists in this year (and so does its parent, for moons). */
export function visibleAt(b: Body, year: Year): boolean {
  if (!bodyExists(b, year)) return false;
  if (b.kind === 'moon' && b.parent) {
    const p = bodyById.get(b.parent);
    if (p && !bodyExists(p, year)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Names, factions and control
// ---------------------------------------------------------------------------

export const UNKNOWN_FACTION: Faction = {
  id: 'unrecorded',
  name: 'Unrecorded',
  kind: 'people',
  color: '#8a8378',
  summary: 'The novels do not record who held this world at this time.',
  sources: [],
};

export function faction(id: string | undefined): Faction {
  if (!id) return UNKNOWN_FACTION;
  return factionById.get(id) ?? { ...UNKNOWN_FACTION, id, name: id };
}

/** Neutral holders (unrecorded / 'unaligned') get no territory glow. */
export function hasTerritory(f: Faction): boolean {
  return f.id !== UNKNOWN_FACTION.id && f.id !== 'unaligned';
}

export function bodyName(b: Body, year: Year): string {
  return nameAt(b.name, b.names, year);
}

/** Star name without parenthetical notes, for map labels: "Kaitain (star unnamed)" -> "Kaitain". */
export function starLabel(s: StarSystem): string {
  return s.star.replace(/\s*\(.*\)\s*$/, '').trim() || s.star;
}

export function controllerAt(b: Body, year: Year): { faction: Faction; entry: ControlEntry | undefined } {
  const entry = controlAt(b.control, year);
  return { faction: entry ? faction(entry.faction) : UNKNOWN_FACTION, entry };
}

export interface ControlBlend {
  cur: Faction;
  next: Faction | null;
  /** 0 = fully `cur`, 1 = fully `next`. */
  mix: number;
}

const FADE_YEARS = 1.5;

/** Current controller plus a short cross-fade toward the next one just before a change. */
export function controlBlend(b: Body, year: Year): ControlBlend {
  const curE = controlAt(b.control, year);
  const cur = curE ? faction(curE.faction) : UNKNOWN_FACTION;
  const nextE = nextControl(b.control, year);
  if (!nextE) return { cur, next: null, mix: 0 };
  const span = curE ? nextE.from - curE.from : FADE_YEARS * 2;
  const win = Math.max(0.05, Math.min(FADE_YEARS, span * 0.5));
  const dt = nextE.from - year;
  if (dt > win) return { cur, next: null, mix: 0 };
  return { cur, next: faction(nextE.faction), mix: clampN(1 - dt / win, 0, 1) };
}

/** Factions controlling at least one visible body this year, sorted by how many they hold. */
export function factionsInYear(year: Year): { faction: Faction; count: number }[] {
  const counts = new Map<string, { faction: Faction; count: number }>();
  for (const b of lore.bodies) {
    if (b.kind === 'moon' || !visibleAt(b, year)) continue;
    const { faction: f, entry } = controllerAt(b, year);
    if (!entry) continue;
    const c = counts.get(f.id) ?? { faction: f, count: 0 };
    c.count++;
    counts.set(f.id, c);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.faction.name.localeCompare(b.faction.name));
}

/** Static importance used to prioritise labels: how often a system's worlds appear in the lore. */
export const systemImportance = new Map<string, number>();
for (const s of lore.systems) {
  let score = s.id === 'canopus' ? 100 : 0;
  for (const b of planetsBySystem.get(s.id) ?? []) {
    score += b.sources.length * 2 + b.facts.length;
    score += eventsSorted.filter((e) => e.body === b.id).length * 3;
  }
  systemImportance.set(s.id, score);
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function devReportIssues(): void {
  if (import.meta.env.DEV && issues.length) console.info('[universe] data notes:\n - ' + issues.join('\n - '));
}
