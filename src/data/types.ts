/**
 * Lore schema for Lisan al-Gaib.
 *
 * CANON RULE: Frank Herbert's six novels only (Dune, Dune Messiah, Children of Dune,
 * God Emperor of Dune, Heretics of Dune, Chapterhouse: Dune), plus the appendices/
 * glossary of Dune. No Brian Herbert / Kevin J. Anderson material.
 * Where the novels give no date, a value may be marked `approx: true` and the
 * `note` should say what it is inferred from.
 *
 * YEARS: Imperial reckoning. Positive = AG (After Guild), negative = BG.
 * There is no year 0. Fractions are allowed for ordering within a year.
 *
 * IDS: stable kebab-case strings. Never reference by array index.
 * All files must import with explicit `.ts` extensions (Node runs the validator directly).
 */

export type Year = number;

export type BookId = 'dune' | 'messiah' | 'children' | 'god-emperor' | 'heretics' | 'chapterhouse';

export interface Book {
  id: BookId;
  title: string;
  published: number; // real-world year
  /** In-universe span the novel covers (approx). */
  span: [Year, Year];
}

/** An inclusive in-universe interval. Missing bound = open-ended. */
export interface Span {
  from?: Year;
  to?: Year;
  approx?: boolean;
}

export interface Era {
  id: string;
  name: string;
  start: Year;
  end: Year;
  /** Hex colour used for the timeline and accents while this era is active. */
  color: string;
  summary: string;
  books: BookId[];
}

export type FactionKind =
  | 'imperial'
  | 'great-house'
  | 'minor-house'
  | 'order' // Bene Gesserit, Mentats, Suk, etc.
  | 'guild'
  | 'people' // Fremen, Tleilaxu, Fish Speakers, Honored Matres...
  | 'religion'
  | 'commerce'; // CHOAM, smugglers

export interface Faction {
  id: string;
  name: string;
  kind: FactionKind;
  /** Hex colour on the map. Must stay legible on a near-black background. */
  color: string;
  summary: string;
  /** Optional heraldry keyword used by the UI to pick a sigil: 'hawk', 'griffin', 'lion', 'crysknife', ... */
  sigil?: string;
  exists?: Span;
  sources: BookId[];
}

/** Who controls something from a given year onward (until the next entry). Sorted ascending by `from`. */
export interface ControlEntry {
  from: Year;
  faction: string; // Faction.id
  approx?: boolean;
  note?: string;
}

export interface NameEntry {
  from: Year;
  name: string;
}

// ---------------------------------------------------------------------------
// Known Universe (galactic scale)
// ---------------------------------------------------------------------------

export interface StarSystem {
  id: string;
  /** Star name, e.g. "Canopus". */
  star: string;
  /** Galactic map position. Arbitrary units; roughly -1000..1000 on both axes. Canopus near the centre. */
  x: number;
  y: number;
  /** Hex colour of the star glow. */
  color: string;
  summary?: string;
}

export type BodyKind = 'planet' | 'moon' | 'station';

export interface Body {
  id: string;
  /** Name at the earliest time shown; see `names` for renamings (Arrakis -> Rakis, Giedi Prime -> Gammu). */
  name: string;
  names?: NameEntry[];
  kind: BodyKind;
  system: string; // StarSystem.id
  /** For moons: the Body.id they orbit. */
  parent?: string;
  /** Orbital index within the system (e.g. Arrakis is Canopus III -> 3). Optional for moons. */
  ordinal?: number;
  /** Relative visual orbit radius (1 = closest typical planet). */
  orbit: number;
  /** Relative visual size (1 = Earth-ish). */
  size: number;
  /** Hex base colour for the planet disc. */
  color: string;
  summary: string;
  /** Short bullet facts. Each one sentence, paraphrased (no long verbatim quotations). */
  facts: string[];
  /** Main export or resource, if any. */
  export?: string;
  control: ControlEntry[];
  exists?: Span;
  sources: BookId[];
}

// ---------------------------------------------------------------------------
// Characters & events
// ---------------------------------------------------------------------------

export interface Whereabouts {
  from: Year;
  body: string; // Body.id
  /** Optional Arrakis place id when body === 'arrakis'. */
  place?: string;
  approx?: boolean;
}

export type RelationType =
  | 'parent'
  | 'child'
  | 'sibling'
  | 'spouse'
  | 'concubine'
  | 'mentor'
  | 'student'
  | 'ally'
  | 'enemy'
  | 'servant'
  | 'master'
  | 'ghola-of';

export interface Relation {
  id: string; // Character.id
  type: RelationType;
}

export interface Character {
  id: string;
  name: string;
  /** Titles and names by which they are known: "Muad'Dib", "Usul", ... */
  aliases?: string[];
  born?: Year;
  died?: Year;
  approxDates?: boolean;
  /** Primary allegiance over time. */
  allegiance: ControlEntry[];
  /** One or two sentences. Paraphrase, no long quotations. */
  summary: string;
  whereabouts: Whereabouts[];
  relations: Relation[];
  sources: BookId[];
  /** True for gholas/reincarnations so the UI can explain overlapping lifespans (e.g. Duncan Idaho). */
  ghola?: boolean;
  note?: string;
}

export type EventKind = 'war' | 'political' | 'religious' | 'ecological' | 'death' | 'birth' | 'discovery' | 'founding';

export interface LoreEvent {
  id: string;
  year: Year;
  title: string;
  summary: string;
  kind: EventKind;
  /** Where it happened (Body.id) so the map can fly there. */
  body?: string;
  /** Arrakis place id, when relevant. */
  place?: string;
  characters?: string[];
  book?: BookId;
  approx?: boolean;
}

// ---------------------------------------------------------------------------
// Arrakis (planetary scale)
// ---------------------------------------------------------------------------

/** Geographic coordinates on Arrakis. lat -90..90 (north +), lon -180..180 (east +). */
export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface ArrakisRegion extends GeoPoint {
  id: string;
  name: string;
  /** Approximate angular radius in degrees, for drawing a soft region glow. */
  radius: number;
  summary: string;
  /** 1 (habitable) .. 5 (lethal) */
  danger: 1 | 2 | 3 | 4 | 5;
}

export type PlaceKind = 'city' | 'sietch' | 'fortress' | 'landmark' | 'basin' | 'station' | 'shrine';

export interface ArrakisPlace extends GeoPoint {
  id: string;
  name: string;
  names?: NameEntry[];
  kind: PlaceKind;
  region?: string; // ArrakisRegion.id
  summary: string;
  facts: string[];
  exists?: Span;
  control: ControlEntry[];
  /** Approximate population when notable, free text: "~1,000,000", "a few hundred". */
  population?: string;
  sources: BookId[];
}

export interface Moon {
  id: string;
  name: string;
  /** Orbit radius in planet radii (visual). */
  orbit: number;
  /** Visual radius relative to the planet (planet = 1). Keep < 0.35. */
  size: number;
  /** Orbital period in days (visual, approximate). */
  period: number;
  color: string;
  summary: string;
  sources: BookId[];
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export interface Lore {
  books: Book[];
  eras: Era[];
  factions: Faction[];
  systems: StarSystem[];
  bodies: Body[];
  characters: Character[];
  events: LoreEvent[];
  arrakis: {
    regions: ArrakisRegion[];
    places: ArrakisPlace[];
    moons: Moon[];
  };
  /** Year the UI opens on by default. */
  defaultYear: Year;
  /** Full range of the timeline slider. */
  range: [Year, Year];
}
