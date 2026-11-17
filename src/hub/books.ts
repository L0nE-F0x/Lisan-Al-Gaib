/**
 * The Six Books: a horizontal, snap-scrolling timeline of Frank Herbert's novels.
 * Titles, years and spans come from the lore; the premises are this project's own words.
 */
import { lore } from '../data/index.ts';
import type { Book, BookId } from '../data/types.ts';
import { eraAt, formatYear } from '../data/query.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import { reducedMotion } from '../shared/prefs.ts';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** One-paragraph premises, written for this site (paraphrase, no quotation). */
const PREMISE: Record<BookId, string> = {
  dune:
    'Duke Leto Atreides accepts the desert planet Arrakis, sole source of the spice, knowing the gift is a trap. When the Harkonnens strike, his son Paul and the Lady Jessica escape into the deep desert, where the Fremen take them in and Paul’s prescience begins to wake.',
  messiah:
    'Twelve years on, Paul rules as Emperor while a holy war fought in his name burns across the stars. A conspiracy closes around his throne, and the man who can see the future must decide what he is willing to pay to step off the path he set in motion.',
  children:
    'Paul’s twins, Leto II and Ghanima, grow up under the regency of their aunt Alia, who is losing herself to the voices of her ancestors. While a blind preacher stalks Arrakeen and the planet turns green, Leto chooses a transformation no human has dared.',
  'god-emperor':
    'Three and a half thousand years later, Leto II is something between man and sandworm, ruling a galaxy he keeps deliberately still. A rebellious descendant and yet another Duncan Idaho test whether his long tyranny can end the way he intends.',
  heretics:
    'Fifteen centuries after the Tyrant, the Bene Gesserit guard a girl on Rakis who can command the worms and raise a new Duncan Idaho for purposes of their own, as the Honored Matres sweep back from the Scattering into the old worlds.',
  chapterhouse:
    'Hunted by the Honored Matres, the Sisterhood hides on its secret world and seeds it with sandtrout, turning green fields into a new desert. Mother Superior Odrade gambles everything on an alliance with an enemy she cannot outfight.',
};

/** Where the film adaptations sit. */
const FILMS: Partial<Record<BookId, string>> = {
  dune: 'On screen: Dune: Part One (2021) and Dune: Part Two (2024)',
  messiah: 'On screen: Dune: Part Three, December 2026',
};

const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;

export function initBooks(mount: HTMLElement): void {
  const books = [...lore.books].sort((a, b) => a.span[0] - b.span[0]);
  if (!books.length) return;

  const track = h('ol', {
    class: 'books__track',
    tabindex: '0',
    'aria-label': 'The six novels in story order. Scroll sideways for more.',
  });

  books.forEach((book, i) => track.appendChild(bookCard(book, i, books[i - 1])));

  const prev = h('button', { class: 'icon-btn books__nav', type: 'button', 'aria-label': 'Previous books', 'aria-controls': 'books-track' }, icon(ICONS.prev));
  const next = h('button', { class: 'icon-btn books__nav', type: 'button', 'aria-label': 'Next books', 'aria-controls': 'books-track' }, icon(ICONS.next));
  track.id = 'books-track';

  const legend = h(
    'p',
    { class: 'books__legend' },
    h('span', { class: 'books__legend-mark', 'aria-hidden': 'true' }),
    'Marked: the two novels Denis Villeneuve’s films adapt.',
  );

  const step = () => {
    const card = track.querySelector<HTMLElement>('.book');
    return card ? card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0') : 320;
  };
  const scrollByCards = (dir: number) =>
    track.scrollBy({ left: dir * step(), behavior: reducedMotion() ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => scrollByCards(-1));
  next.addEventListener('click', () => scrollByCards(1));

  let queued = false;
  const sync = () => {
    queued = false;
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= max - 4;
    controls.dataset.overflow = String(max > 4);
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(sync);
    }
  };
  track.addEventListener('scroll', queue, { passive: true });
  new ResizeObserver(queue).observe(track);

  const controls = h('div', { class: 'books__controls' }, legend, h('div', { class: 'books__buttons' }, prev, next));
  mount.replaceChildren(controls, track);
  queue();
}

function bookCard(book: Book, i: number, prevBook: Book | undefined): HTMLElement {
  const [from, to] = book.span;
  const era = lore.eras.length ? eraAt(lore.eras, from) : undefined;
  const accent = era?.color ?? '#f0a44a';
  const gap = prevBook ? Math.round(from - prevBook.span[1]) : 0;
  const span = Math.floor(from) === Math.floor(to) ? formatYear(from) : `${formatYear(from, { short: true })}–${formatYear(to)}`;
  const film = FILMS[book.id];
  const titleId = `book-${book.id}`;

  return h(
    'li',
    { class: `book reveal${film ? ' book--film' : ''}`, style: `--accent:${accent};--i:${i}` },
    h(
      'div',
      { class: 'book__marker', 'aria-hidden': 'true' },
      h('span', { class: 'book__dot' }),
      h('span', { class: 'book__when mono' }, formatYear(from)),
      gap > 0 ? h('span', { class: 'book__gap mono' }, `${plural(gap, 'year')} later`) : null,
    ),
    h(
      'article',
      { class: 'book__card', 'aria-labelledby': titleId },
      h('p', { class: 'book__num display', 'aria-hidden': 'true' }, NUMERALS[i] ?? String(i + 1)),
      h('h3', { class: 'book__title display', id: titleId }, book.title),
      h(
        'dl',
        { class: 'book__facts' },
        h('div', null, h('dt', null, 'Published'), h('dd', null, String(book.published))),
        h('div', null, h('dt', null, 'Set'), h('dd', null, span)),
        era ? h('div', null, h('dt', null, 'Era'), h('dd', null, era.name)) : null,
      ),
      h('p', { class: 'book__premise' }, PREMISE[book.id] ?? ''),
      film ? h('p', { class: 'book__film' }, filmIcon(), film) : null,
      h(
        'a',
        {
          class: 'book__link',
          href: `/universe/?year=${Math.floor(from)}`,
          'aria-label': `Explore the era of ${book.title} in the Known Universe atlas`,
        },
        'Explore this era',
        icon(ICONS.arrowRight, { size: 18 }),
      ),
    ),
  );
}

function filmIcon(): SVGSVGElement {
  return icon(['M4 6h16v12H4z', 'M8 6v12', 'M16 6v12', 'M4 10h4', 'M4 14h4', 'M16 10h4', 'M16 14h4'], { size: 16 });
}
