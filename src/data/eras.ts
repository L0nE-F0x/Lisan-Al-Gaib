import type { Era } from './types.ts';

/**
 * Contiguous eras covering the full timeline range. Adjacent eras share a boundary year
 * (`next.start === prev.end`); `eraAt` returns the earlier era at an exact boundary, so
 * boundaries are chosen so that the key year of each era (e.g. 10191 for Dune) falls
 * inside it. All colours are checked for >= 4.5:1 contrast against #0a0705.
 */
export const eras: Era[] = [
  {
    id: 'butlerian-jihad',
    name: 'The Butlerian Jihad',
    start: -250,
    end: -108,
    color: '#ff7f66',
    summary:
      'Humanity rises against thinking machines and conscious robots in a crusade the glossary dates from 201 BG to 108 BG. Its commandment, preserved in the Orange Catholic Bible, forbids making a machine in the likeness of a human mind.',
    books: ['dune', 'god-emperor'],
  },
  {
    id: 'founding',
    name: 'Founding of the Imperium',
    start: -108,
    end: 1,
    color: '#f0a35e',
    summary:
      'After the Jihad, the Battle of Corrin (88 BG, near Sigma Draconis) raises a house from Salusa Secundus to the throne, and the Spacing Guild\'s monopoly on space travel begins the Imperial calendar at year 1 AG.',
    books: ['dune'],
  },
  {
    id: 'corrino-imperium',
    name: 'The Corrino Imperium',
    start: 1,
    end: 10190,
    color: '#e6b84a',
    summary:
      'Some ten thousand years of Padishah Emperors of House Corrino, balanced against the Landsraad, the Spacing Guild and CHOAM. Mentats, Bene Gesserit and Suk doctors fill the roles once held by machines.',
    books: ['dune'],
  },
  {
    id: 'dune',
    name: 'Dune',
    start: 10190,
    end: 10193,
    color: '#f2c879',
    summary:
      'House Atreides takes Arrakis from the Harkonnens, is betrayed and broken, and Paul Atreides rises among the Fremen as Muad\'Dib to defeat the Emperor at Arrakeen and take the throne.',
    books: ['dune'],
  },
  {
    id: 'jihad',
    name: 'Muad\'Dib\'s Jihad',
    start: 10193,
    end: 10207,
    color: '#ff9a4d',
    summary:
      'Fremen legions carry Muad\'Dib\'s holy war across the Imperium for twelve years. A conspiracy of Guild, Bene Gesserit and Tleilaxu moves against the Emperor, who ends the era blind and walking into the desert.',
    books: ['messiah'],
  },
  {
    id: 'regency',
    name: 'The Regency',
    start: 10207,
    end: 10219,
    color: '#7fd18b',
    summary:
      'Alia rules as regent for Paul\'s twins, Leto II and Ghanima, and slowly falls to Abomination. The Preacher walks the streets of Arrakeen, and Leto II accepts the sandtrout skin to begin the Golden Path.',
    books: ['children'],
  },
  {
    id: 'god-emperor',
    name: 'Reign of the God Emperor',
    start: 10219,
    end: 13725,
    color: '#f5dd5a',
    summary:
      'Leto II, slowly becoming a sandworm, rules for some 3,500 years from his Citadel in the Sareer. His enforced peace, Fish Speaker army and control of the spice are meant to teach humanity a lesson it will never forget.',
    books: ['god-emperor'],
  },
  {
    id: 'scattering',
    name: 'Famine Times & the Scattering',
    start: 13725,
    end: 15200,
    color: '#9fb4d6',
    summary:
      'After the Tyrant\'s death the Old Empire suffers the Famine Times, and humanity spreads beyond the known worlds in the Scattering. Arrakis becomes Rakis, home of the Priesthood of the Divided God.',
    books: ['heretics'],
  },
  {
    id: 'heretics',
    name: 'Heretics & Chapterhouse',
    start: 15200,
    end: 15300,
    color: '#d99bf0',
    summary:
      'About 1,500 years after Leto II, the Honored Matres return from the Scattering. The Bene Gesserit, guided by Taraza and then Odrade, raise a Duncan Idaho ghola, lose Rakis, and seed their Chapterhouse world with sandtrout.',
    books: ['heretics', 'chapterhouse'],
  },
];
