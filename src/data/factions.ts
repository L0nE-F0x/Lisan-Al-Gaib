import type { Faction } from './types.ts';

/**
 * Factions referenced by `control` and `allegiance` entries. Colours are chosen to be
 * mutually distinct and to keep >= 4.5:1 contrast on #0a0705 (checked by the validator).
 *
 * `unaligned` is a neutral pseudo-faction for worlds whose rulers the novels do not
 * record in a given era (mostly after the God Emperor's death), so the map never shows
 * an anachronistic owner.
 */
export const factions: Faction[] = [
  {
    id: 'corrino',
    name: 'House Corrino',
    kind: 'imperial',
    color: '#e6b345',
    sigil: 'lion',
    summary:
      'The Padishah Emperors, named for the Battle of Corrin and originally from Salusa Secundus. They rule from Kaitain with Sardaukar terror troops until Shaddam IV is defeated on Arrakis.',
    exists: { from: -88 },
    sources: ['dune', 'messiah', 'children'],
  },
  {
    id: 'sardaukar',
    name: 'Sardaukar',
    kind: 'imperial',
    color: '#c9a99b',
    summary:
      'The Emperor\'s fanatical soldiers, forged on the prison planet Salusa Secundus. Their reputation for invincibility ends when Fremen defeat them on Arrakis.',
    exists: { to: 10219, approx: true },
    sources: ['dune', 'children'],
  },
  {
    id: 'landsraad',
    name: 'Landsraad Houses',
    kind: 'imperial',
    color: '#a9b3c2',
    summary:
      'The assembly of the Great and Minor Houses that balances the Emperor. Used here for worlds held by houses the novels do not name.',
    sources: ['dune', 'messiah'],
  },
  {
    id: 'atreides',
    name: 'House Atreides',
    kind: 'great-house',
    color: '#62c47f',
    sigil: 'hawk',
    summary:
      'The Great House of Caladan, with its red hawk crest. Duke Leto is betrayed on Arrakis, and his son Paul becomes Muad\'Dib and Emperor.',
    sources: ['dune', 'messiah', 'children', 'god-emperor', 'heretics', 'chapterhouse'],
  },
  {
    id: 'harkonnen',
    name: 'House Harkonnen',
    kind: 'great-house',
    color: '#7296ff',
    sigil: 'griffin',
    summary:
      'The Great House of Giedi Prime under its blue griffin banner, sworn to kanly with the Atreides. Baron Vladimir Harkonnen rules Arrakis for CHOAM and the Emperor until his death in 10,193 AG.',
    exists: { to: 10193 },
    sources: ['dune'],
  },
  {
    id: 'moritani',
    name: 'House Moritani',
    kind: 'minor-house',
    color: '#ee8a78',
    summary:
      'Ruling house of Grumman, known in the Dune glossary chiefly for its feud with House Ginaz.',
    sources: ['dune'],
  },
  {
    id: 'fremen',
    name: 'Fremen',
    kind: 'people',
    color: '#ef8f4c',
    sigil: 'crysknife',
    summary:
      'The free tribes of Arrakis, descended from Zensunni wanderers. They live in sietches, ride sandworms, and dream of a green planet; under Muad\'Dib they become the legions of the Jihad.',
    sources: ['dune', 'messiah', 'children', 'god-emperor'],
  },
  {
    id: 'smugglers',
    name: 'Smugglers',
    kind: 'commerce',
    color: '#c2a47e',
    summary:
      'Spice smugglers who trade with the Fremen and evade Imperial and Harkonnen control; Gurney Halleck hides among them after the fall of the Atreides.',
    sources: ['dune', 'children'],
  },
  {
    id: 'bene-gesserit',
    name: 'Bene Gesserit',
    kind: 'order',
    color: '#cf93ee',
    summary:
      'The ancient sisterhood of mental and physical training whose centuries-long breeding program aims at the Kwisatz Haderach. Its Mother School is on Wallach IX; by the Heretics era it is ruled from the hidden world Chapterhouse.',
    sources: ['dune', 'messiah', 'children', 'god-emperor', 'heretics', 'chapterhouse'],
  },
  {
    id: 'spacing-guild',
    name: 'Spacing Guild',
    kind: 'guild',
    color: '#5fcad8',
    summary:
      'Holders of the monopoly on interstellar transport and banking. Their spice-drenched Navigators fold space through prescience, which makes the Guild utterly dependent on Arrakis.',
    exists: { from: 1 },
    sources: ['dune', 'messiah', 'children', 'god-emperor', 'heretics', 'chapterhouse'],
  },
  {
    id: 'choam',
    name: 'CHOAM',
    kind: 'commerce',
    color: '#9ed8c2',
    summary:
      'The Combine Honnete Ober Advancer Mercantiles, the universal development corporation controlled by the Emperor and the Great Houses, with the Guild and Bene Gesserit as silent partners.',
    sources: ['dune', 'messiah', 'heretics', 'chapterhouse'],
  },
  {
    id: 'bene-tleilax',
    name: 'Bene Tleilax',
    kind: 'people',
    color: '#a9cc5c',
    summary:
      'The secretive Tleilaxu of Tleilax, makers of gholas, twisted Mentats and shape-shifting Face Dancers. By the Heretics era their Masters pursue a hidden religious design of their own.',
    sources: ['dune', 'messiah', 'children', 'god-emperor', 'heretics', 'chapterhouse'],
  },
  {
    id: 'ixians',
    name: 'Ix',
    kind: 'people',
    color: '#93b9d0',
    summary:
      'The machine culture of Ix, which skirts the Butlerian prohibitions. Ix supplies Leto II and later builds the no-ships and no-chambers that hide from prescience.',
    sources: ['dune', 'messiah', 'children', 'god-emperor', 'heretics', 'chapterhouse'],
  },
  {
    id: 'richese',
    name: 'Richese',
    kind: 'people',
    color: '#bba7e0',
    summary:
      'A machine culture classed with Ix and its commercial rival, noted for miniaturization.',
    sources: ['dune', 'god-emperor', 'heretics'],
  },
  {
    id: 'qizarate',
    name: 'Qizarate',
    kind: 'religion',
    color: '#f3d48e',
    summary:
      'The priesthood of Muad\'Dib\'s religion, missionaries and bureaucrats of the Jihad who outgrow the man they worship.',
    exists: { from: 10193, to: 10219, approx: true },
    sources: ['messiah', 'children'],
  },
  {
    id: 'atreides-empire',
    name: 'Empire of the God Emperor',
    kind: 'imperial',
    color: '#f7e46a',
    sigil: 'worm',
    summary:
      'The Atreides Empire of Leto II, held together by his monopoly on spice, his Fish Speaker army and some 3,500 years of enforced peace.',
    exists: { from: 10219, to: 13725 },
    sources: ['children', 'god-emperor'],
  },
  {
    id: 'fish-speakers',
    name: 'Fish Speakers',
    kind: 'people',
    color: '#ff96bd',
    summary:
      'Leto II\'s all-female army and priesthood, devoted to the God Emperor and commanded in his time by successive Duncan Idaho gholas.',
    exists: { from: 10219, approx: true },
    sources: ['god-emperor', 'heretics'],
  },
  {
    id: 'rakian-priesthood',
    name: 'Priesthood of the Divided God',
    kind: 'religion',
    color: '#dcbf8f',
    summary:
      'The priests of Rakis who worship the sandworms as Shai-Hulud, the Divided God, believing each worm carries a pearl of Leto II\'s awareness.',
    exists: { from: 13725, to: 15228, approx: true },
    sources: ['heretics'],
  },
  {
    id: 'honored-matres',
    name: 'Honored Matres',
    kind: 'people',
    color: '#ff6464',
    summary:
      'A violent sisterhood returning from the Scattering, who rule through sexual enslavement and overwhelming force and who destroy Rakis, Lampadas and the Tleilaxu worlds.',
    exists: { from: 15200, approx: true },
    sources: ['heretics', 'chapterhouse'],
  },
  {
    id: 'unaligned',
    name: 'Unrecorded / Unaligned',
    kind: 'people',
    color: '#9a948c',
    summary:
      'Placeholder for worlds whose rulers in a given era are not recorded in the novels, chiefly in the Old Empire after the God Emperor\'s death.',
    sources: ['heretics'],
  },
];
