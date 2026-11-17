import type { Book } from './types.ts';

/**
 * Frank Herbert's six Dune novels. `span` is the approximate in-universe interval each
 * novel covers (Imperial reckoning, AG). Only Dune's dates are anchored by the text
 * (10,191 AG for the arrival on Arrakis); the others are derived from relative statements
 * in the novels (twelve years of Jihad, the twins aged nine, a ~3,500-year reign, Heretics
 * set some 1,500 years after the Tyrant's death) and are approximate.
 */
export const books: Book[] = [
  { id: 'dune', title: 'Dune', published: 1965, span: [10191, 10193] },
  { id: 'messiah', title: 'Dune Messiah', published: 1969, span: [10205, 10207] },
  { id: 'children', title: 'Children of Dune', published: 1976, span: [10216, 10219] },
  { id: 'god-emperor', title: 'God Emperor of Dune', published: 1981, span: [13724, 13725] },
  { id: 'heretics', title: 'Heretics of Dune', published: 1984, span: [15225, 15228] },
  { id: 'chapterhouse', title: 'Chapterhouse: Dune', published: 1985, span: [15229, 15240] },
];
