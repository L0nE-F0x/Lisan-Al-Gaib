/**
 * Lore dataset validator. Run with `node scripts/validate-data.ts` (Node type stripping,
 * no dependencies). Exits 1 if any error is found; warnings are printed but do not fail.
 */
import { lore } from '../src/data/index.ts';
import type { ControlEntry, Span, Year } from '../src/data/types.ts';

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const BG = '#0a0705';
const [MIN, MAX] = lore.range;

// ---------------------------------------------------------------- helpers
function hexOk(c: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c);
}
function rgb(c: string): [number, number, number] {
  let h = c.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function checkColor(where: string, c: string, minContrast?: number) {
  if (!hexOk(c)) return err(`${where}: invalid hex colour "${c}"`);
  if (minContrast !== undefined) {
    const r = contrast(c, BG);
    if (r < minContrast) err(`${where}: colour ${c} contrast ${r.toFixed(2)} < ${minContrast} on ${BG}`);
  }
}
function checkYear(where: string, y: Year | undefined) {
  if (y === undefined) return;
  if (typeof y !== 'number' || Number.isNaN(y)) return err(`${where}: year is not a number`);
  if (y === 0) err(`${where}: year 0 does not exist`);
  if (y < MIN || y > MAX) err(`${where}: year ${y} outside range [${MIN}, ${MAX}]`);
}
function checkSpan(where: string, s: Span | undefined) {
  if (!s) return;
  checkYear(`${where}.from`, s.from);
  checkYear(`${where}.to`, s.to);
  if (s.from !== undefined && s.to !== undefined && s.from > s.to) err(`${where}: span from > to`);
}
function checkSorted(where: string, list: { from: Year }[] | undefined) {
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    checkYear(`${where}[${i}]`, list[i].from);
    if (i > 0 && list[i].from < list[i - 1].from) err(`${where}: not sorted ascending at index ${i}`);
  }
}
function unique(kind: string, ids: string[], seen?: Map<string, string>) {
  const local = new Set<string>();
  for (const id of ids) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) err(`${kind} "${id}": id is not kebab-case`);
    if (local.has(id)) err(`${kind}: duplicate id "${id}"`);
    local.add(id);
    if (seen) {
      const other = seen.get(id);
      if (other && other !== kind) err(`id "${id}" used by both ${other} and ${kind}`);
      seen.set(id, kind);
    }
  }
  return local;
}
function summaryLen(where: string, s: string) {
  if (!s || !s.trim()) err(`${where}: empty summary`);
  else if (s.length > 400) warn(`${where}: summary is ${s.length} chars (> 400)`);
}

// ---------------------------------------------------------------- ids
const bookIds = unique('book', lore.books.map((b) => b.id));
const eraIds = unique('era', lore.eras.map((e) => e.id));
void eraIds;
const factionIds = unique('faction', lore.factions.map((f) => f.id));
const systemIds = unique('system', lore.systems.map((s) => s.id));
const mapNs = new Map<string, string>();
const bodyIds = unique('body', lore.bodies.map((b) => b.id), mapNs);
unique('system', lore.systems.map((s) => s.id), mapNs);
unique('character', lore.characters.map((c) => c.id));
unique('event', lore.events.map((e) => e.id));
const arrNs = new Map<string, string>();
const regionIds = unique('region', lore.arrakis.regions.map((r) => r.id), arrNs);
const placeIds = unique('place', lore.arrakis.places.map((p) => p.id), arrNs);
unique('moon', lore.arrakis.moons.map((m) => m.id), arrNs);

const bodyById = new Map(lore.bodies.map((b) => [b.id, b]));
const placeById = new Map(lore.arrakis.places.map((p) => [p.id, p]));

function checkSources(where: string, src: string[]) {
  if (!src || src.length === 0) warn(`${where}: no sources`);
  for (const s of src ?? []) if (!bookIds.has(s)) err(`${where}: unknown book "${s}"`);
}
function checkControl(where: string, list: ControlEntry[]) {
  checkSorted(where, list);
  for (const c of list) if (!factionIds.has(c.faction)) err(`${where}: unknown faction "${c.faction}"`);
}

// ---------------------------------------------------------------- range & books
if (!(MIN < MAX)) err('range: start must be < end');
checkYear('defaultYear', lore.defaultYear);
for (const b of lore.books) {
  checkYear(`book ${b.id}.span[0]`, b.span[0]);
  checkYear(`book ${b.id}.span[1]`, b.span[1]);
  if (b.span[0] > b.span[1]) err(`book ${b.id}: span reversed`);
}

// ---------------------------------------------------------------- eras
const eras = lore.eras;
if (eras.length === 0) err('eras: empty');
else {
  if (eras[0].start !== MIN) err(`eras: first era starts ${eras[0].start}, range starts ${MIN}`);
  if (eras[eras.length - 1].end !== MAX) err(`eras: last era ends ${eras[eras.length - 1].end}, range ends ${MAX}`);
  eras.forEach((e, i) => {
    checkYear(`era ${e.id}.start`, e.start);
    checkYear(`era ${e.id}.end`, e.end);
    if (e.start >= e.end) err(`era ${e.id}: start >= end`);
    if (i > 0 && e.start !== eras[i - 1].end)
      err(`era ${e.id}: starts ${e.start} but previous ends ${eras[i - 1].end} (eras must share boundaries: gap or overlap)`);
    checkColor(`era ${e.id}`, e.color, 4.5);
    summaryLen(`era ${e.id}`, e.summary);
    for (const b of e.books) if (!bookIds.has(b)) err(`era ${e.id}: unknown book "${b}"`);
  });
}

// ---------------------------------------------------------------- factions
for (const f of lore.factions) {
  checkColor(`faction ${f.id}`, f.color, 4.5);
  checkSpan(`faction ${f.id}.exists`, f.exists);
  summaryLen(`faction ${f.id}`, f.summary);
  checkSources(`faction ${f.id}`, f.sources);
}

// ---------------------------------------------------------------- systems & bodies
for (const s of lore.systems) {
  checkColor(`system ${s.id}`, s.color);
  if (Math.abs(s.x) > 1100 || Math.abs(s.y) > 1100) warn(`system ${s.id}: position (${s.x}, ${s.y}) outside ~-1000..1000`);
}
const usedSystems = new Set(lore.bodies.map((b) => b.system));
for (const s of lore.systems) if (!usedSystems.has(s.id)) warn(`system ${s.id}: has no bodies`);

for (const b of lore.bodies) {
  const w = `body ${b.id}`;
  if (!systemIds.has(b.system)) err(`${w}: unknown system "${b.system}"`);
  checkColor(w, b.color);
  checkSorted(`${w}.names`, b.names);
  checkControl(`${w}.control`, b.control);
  checkSpan(`${w}.exists`, b.exists);
  summaryLen(w, b.summary);
  checkSources(w, b.sources);
  if (b.facts.length === 0) warn(`${w}: no facts`);
  for (const f of b.facts) if (f.length > 220) warn(`${w}: fact longer than 220 chars`);
  if (b.kind === 'moon') {
    if (!b.parent) err(`${w}: moon without parent`);
    else {
      const p = bodyById.get(b.parent);
      if (!p) err(`${w}: unknown parent "${b.parent}"`);
      else {
        if (p.kind === 'moon') err(`${w}: parent "${b.parent}" is itself a moon`);
        if (p.system !== b.system) err(`${w}: parent "${b.parent}" is in a different system`);
      }
    }
  } else {
    if (b.parent) err(`${w}: only moons may have a parent`);
    if (b.control.length === 0) warn(`${w}: empty control history`);
  }
  if (b.size <= 0 || b.orbit <= 0) err(`${w}: size and orbit must be positive`);
}

// ---------------------------------------------------------------- Arrakis
function checkGeo(where: string, lat: number, lon: number) {
  if (!(lat >= -90 && lat <= 90)) err(`${where}: lat ${lat} out of range`);
  if (!(lon >= -180 && lon <= 180)) err(`${where}: lon ${lon} out of range`);
}
for (const r of lore.arrakis.regions) {
  checkGeo(`region ${r.id}`, r.lat, r.lon);
  if (r.radius <= 0) err(`region ${r.id}: radius must be positive`);
  if (![1, 2, 3, 4, 5].includes(r.danger)) err(`region ${r.id}: danger must be 1..5`);
  summaryLen(`region ${r.id}`, r.summary);
}
for (const p of lore.arrakis.places) {
  const w = `place ${p.id}`;
  checkGeo(w, p.lat, p.lon);
  if (p.region && !regionIds.has(p.region)) err(`${w}: unknown region "${p.region}"`);
  checkSorted(`${w}.names`, p.names);
  checkControl(`${w}.control`, p.control);
  checkSpan(`${w}.exists`, p.exists);
  summaryLen(w, p.summary);
  checkSources(w, p.sources);
  if (p.exists?.from !== undefined && p.control.length && p.control[0].from > p.exists.from + 1)
    warn(`${w}: control history starts after the place exists`);
}
for (const m of lore.arrakis.moons) {
  checkColor(`moon ${m.id}`, m.color);
  if (m.size >= 0.35) err(`moon ${m.id}: size must be < 0.35`);
  if (m.orbit <= 1) err(`moon ${m.id}: orbit must be > 1 planet radius`);
  summaryLen(`moon ${m.id}`, m.summary);
}

// ---------------------------------------------------------------- characters
const charById = new Map(lore.characters.map((c) => [c.id, c]));
const RECIPROCAL: Record<string, string | undefined> = {
  parent: 'child',
  child: 'parent',
  sibling: 'sibling',
  spouse: 'spouse',
  concubine: 'concubine',
  mentor: 'student',
  student: 'mentor',
  servant: 'master',
  master: 'servant',
  ally: 'ally',
  enemy: 'enemy',
  'ghola-of': undefined,
};
function checkWhere(where: string, body: string, place: string | undefined, year: Year) {
  const b = bodyById.get(body);
  if (!b) return err(`${where}: unknown body "${body}"`);
  if (b.exists && (year < (b.exists.from ?? -Infinity) || year > (b.exists.to ?? Infinity)))
    warn(`${where}: body "${body}" does not exist in ${year}`);
  if (place !== undefined) {
    if (body !== 'arrakis') err(`${where}: place "${place}" given but body is "${body}"`);
    const p = placeById.get(place);
    if (!p) return err(`${where}: unknown place "${place}"`);
    if (p.exists && (year < (p.exists.from ?? -Infinity) || year > (p.exists.to ?? Infinity)))
      warn(`${where}: place "${place}" does not exist in ${year}`);
  }
}
for (const c of lore.characters) {
  const w = `character ${c.id}`;
  checkYear(`${w}.born`, c.born);
  checkYear(`${w}.died`, c.died);
  if (c.born !== undefined && c.died !== undefined && c.born > c.died) err(`${w}: born after died`);
  if (c.died === undefined && c.born !== undefined && c.born < MAX - 150)
    warn(`${w}: no death year; will appear alive until the end of the timeline`);
  checkControl(`${w}.allegiance`, c.allegiance);
  checkSorted(`${w}.whereabouts`, c.whereabouts);
  summaryLen(w, c.summary);
  checkSources(w, c.sources);
  for (const [i, wh] of c.whereabouts.entries()) {
    const ww = `${w}.whereabouts[${i}]`;
    checkWhere(ww, wh.body, wh.place, wh.from);
    if ((c.born !== undefined && wh.from < c.born) || (c.died !== undefined && wh.from > c.died))
      warn(`${ww}: year ${wh.from} outside lifespan`);
  }
  for (const a of c.allegiance)
    if ((c.born !== undefined && a.from < c.born) || (c.died !== undefined && a.from > c.died))
      warn(`${w}.allegiance: entry ${a.from} outside lifespan`);
  for (const r of c.relations) {
    if (r.id === c.id) err(`${w}: relation to self`);
    const other = charById.get(r.id);
    if (!other) {
      err(`${w}: unknown relation target "${r.id}"`);
      continue;
    }
    if (!(r.type in RECIPROCAL)) err(`${w}: unknown relation type "${r.type}"`);
    const back = RECIPROCAL[r.type];
    if (back && !other.relations.some((x) => x.id === c.id && x.type === back))
      warn(`${w}: ${r.type} -> ${r.id} has no reciprocal ${back}`);
    if (r.type === 'ghola-of' && !c.ghola) warn(`${w}: ghola-of relation but ghola flag not set`);
  }
}

// ---------------------------------------------------------------- events
const evs = lore.events;
evs.forEach((e, i) => {
  const w = `event ${e.id}`;
  checkYear(w, e.year);
  if (i > 0 && e.year < evs[i - 1].year) err(`${w}: events not sorted (year ${e.year} after ${evs[i - 1].year})`);
  summaryLen(w, e.summary);
  if (e.book && !bookIds.has(e.book)) err(`${w}: unknown book "${e.book}"`);
  if (e.place && e.body !== 'arrakis') err(`${w}: place given without body "arrakis"`);
  if (e.body) checkWhere(w, e.body, e.place, e.year);
  for (const id of e.characters ?? []) {
    const c = charById.get(id);
    if (!c) {
      err(`${w}: unknown character "${id}"`);
      continue;
    }
    // Small tolerance: birth/death events sit exactly at the boundary.
    if ((c.born !== undefined && e.year < c.born - 0.5) || (c.died !== undefined && e.year > c.died + 0.5))
      warn(`${w}: character "${id}" not alive in ${e.year}`);
  }
});

// ---------------------------------------------------------------- report
const stats = {
  books: lore.books.length,
  eras: lore.eras.length,
  factions: lore.factions.length,
  systems: lore.systems.length,
  bodies: lore.bodies.length,
  characters: lore.characters.length,
  events: lore.events.length,
  regions: lore.arrakis.regions.length,
  places: lore.arrakis.places.length,
  moons: lore.arrakis.moons.length,
};

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  x ${e}`);
}
console.log('\nLore stats:');
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(11)} ${v}`);
console.log(`  range       ${MIN} .. ${MAX}, default ${lore.defaultYear}`);
console.log(`  unused ids  factions=${[...factionIds].filter((f) => !JSON.stringify([lore.bodies, lore.characters, lore.arrakis.places]).includes(`"${f}"`)).join(',') || 'none'}`);
void bodyIds;
void placeIds;

if (errors.length) {
  console.log(`\nFAILED with ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`\nOK: 0 errors, ${warnings.length} warning(s).`);
