/**
 * Assembled lore dataset for Lisan al-Gaib. Import `lore` from here.
 * Canon: Frank Herbert's six Dune novels and Dune's appendices only (see types.ts).
 */
import type { Lore } from './types.ts';
import { books } from './books.ts';
import { eras } from './eras.ts';
import { factions } from './factions.ts';
import { systems, bodies } from './universe.ts';
import { characters } from './characters.ts';
import { events } from './events.ts';
import { regions, places, moons } from './arrakis.ts';

export const lore: Lore = {
  books,
  eras,
  factions,
  systems,
  bodies,
  characters,
  events,
  arrakis: { regions, places, moons },
  defaultYear: 10191,
  range: [-250, 15300],
};

export default lore;
export * from './types.ts';
