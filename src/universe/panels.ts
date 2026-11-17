/**
 * DOM panels around the map: popovers (layers, eras), faction legend, accessible list view,
 * event banner and the intro title. Each panel only touches the DOM when its content changes.
 */
import { lore } from '../data/index.ts';
import { eraAt, formatYear } from '../data/query.ts';
import type { Era, LoreEvent, Year } from '../data/types.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import { reducedMotion } from '../shared/prefs.ts';
import type { Layers } from './renderer.ts';
import { factionChip } from './details.ts';
import * as W from './world.ts';

// ---------------------------------------------------------------------------
// Popover (non-modal, anchored to a toggle button)
// ---------------------------------------------------------------------------

const openPops = new Set<Popover>();

export class Popover {
  readonly el: HTMLElement;
  readonly button: HTMLButtonElement;
  private _open = false;
  private openFns = new Set<() => void>();

  constructor(opts: { id: string; label: string; button: HTMLButtonElement; body: Node; className?: string }) {
    this.button = opts.button;
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', opts.id);
    const close = h('button', { class: 'icon-btn u-pop__close', type: 'button', 'aria-label': `Close ${opts.label}` }, icon(ICONS.close));
    close.addEventListener('click', () => this.close(true));
    this.el = h(
      'div',
      { class: `u-pop panel ${opts.className ?? ''}`, id: opts.id, role: 'dialog', 'aria-label': opts.label, 'data-open': 'false', hidden: true },
      h('div', { class: 'u-pop__head' }, h('h2', { class: 'eyebrow' }, opts.label), close),
      opts.body,
    );
    this.button.addEventListener('click', () => (this._open ? this.close(false) : this.open()));
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close(true);
      }
    });
  }

  get isOpen(): boolean {
    return this._open;
  }

  onOpen(fn: () => void): void {
    this.openFns.add(fn);
  }

  open(): void {
    for (const p of openPops) if (p !== this) p.close(false);
    this._open = true;
    openPops.add(this);
    this.el.hidden = false;
    requestAnimationFrame(() => (this.el.dataset.open = 'true'));
    this.button.setAttribute('aria-expanded', 'true');
    for (const fn of this.openFns) fn();
    const first = this.el.querySelector<HTMLElement>('[data-autofocus]') ?? this.el.querySelector<HTMLElement>('button, a, input');
    first?.focus({ preventScroll: true });
  }

  close(returnFocus: boolean): void {
    if (!this._open) return;
    this._open = false;
    openPops.delete(this);
    this.el.dataset.open = 'false';
    this.el.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.button.focus({ preventScroll: true });
  }
}

export function closeAllPopovers(returnFocus: boolean): boolean {
  let any = false;
  for (const p of [...openPops]) {
    p.close(returnFocus);
    any = true;
  }
  return any;
}

document.addEventListener('pointerdown', (e) => {
  for (const p of [...openPops]) {
    const t = e.target as Node;
    if (!p.el.contains(t) && !p.button.contains(t)) p.close(false);
  }
});

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

export function switchRow(label: string, value: boolean, onChange: (v: boolean) => void): HTMLButtonElement {
  const b = h('button', { class: 'switch u-switch', type: 'button', role: 'switch', 'aria-checked': String(value) }, h('span', { class: 'switch__track', 'aria-hidden': 'true' }), h('span', null, label));
  b.addEventListener('click', () => {
    const v = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(v));
    onChange(v);
  });
  return b;
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

export class Legend {
  readonly el: HTMLElement;
  private list: HTMLElement;
  private title: HTMLElement;
  private key = '';

  constructor(opts: { compact?: boolean } = {}) {
    this.title = h('span', null);
    this.list = h('ul', { class: 'u-legend__list', id: opts.compact ? 'u-legend-inline' : 'u-legend-float' });
    let head: HTMLElement;
    if (opts.compact) {
      head = h('h2', { class: 'eyebrow u-legend__title' }, this.title);
    } else {
      // Collapsible on the map so it never hides too much of it.
      const open = window.innerHeight >= 820;
      const toggle = h('button', { class: 'u-legend__toggle eyebrow', type: 'button', 'aria-expanded': String(open), 'aria-controls': 'u-legend-float' }, this.title, h('span', { class: 'u-legend__caret', 'aria-hidden': 'true' }));
      toggle.addEventListener('click', () => {
        const v = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(v));
        this.list.hidden = !v;
      });
      this.list.hidden = !open;
      head = h('h2', { class: 'u-legend__title' }, toggle);
    }
    this.el = h('section', { class: `u-legend ${opts.compact ? 'u-legend--inline' : 'panel u-legend--float'}`, 'aria-label': 'Factions holding worlds this year' }, head, this.list);
  }

  update(year: Year): void {
    const fs = W.factionsInYear(year);
    const key = Math.floor(year) + '|' + fs.map((f) => `${f.faction.id}:${f.count}`).join(',');
    if (key === this.key) return;
    const titleKey = this.key.split('|')[0];
    this.key = key;
    if (titleKey !== String(Math.floor(year))) this.title.textContent = `Holders · ${formatYear(year)}`;
    this.list.replaceChildren(
      ...fs.map(({ faction, count }) =>
        h('li', null, factionChip(faction), h('span', { class: 'u-legend__count mono', 'aria-label': `${count} ${count === 1 ? 'world' : 'worlds'}` }, String(count))),
      ),
    );
    if (!fs.length) this.list.append(h('li', { class: 'muted' }, 'No recorded holders in this year.'));
  }
}

// ---------------------------------------------------------------------------
// Layers panel (switches + legend + list view button)
// ---------------------------------------------------------------------------

export function layersBody(layers: Layers, onChange: () => void, openList: () => void, legend: Legend): HTMLElement {
  const sw = (k: keyof Layers, label: string) =>
    switchRow(label, layers[k], (v) => {
      layers[k] = v;
      onChange();
    });
  const listBtn = h('button', { class: 'btn u-wide', type: 'button' }, icon(ICONS.menu, { size: 16 }), 'List view');
  listBtn.addEventListener('click', openList);
  const first = sw('territories', 'Faction territories');
  first.setAttribute('data-autofocus', '');
  return h(
    'div',
    { class: 'u-pop__body' },
    h('div', { class: 'u-switches' }, first, sw('orbits', 'Orbits'), sw('labels', 'Labels'), sw('moons', 'Moons')),
    listBtn,
    h('p', { class: 'muted u-small' }, 'The list view shows every system and world with its holder for the current year, and works with screen readers.'),
    legend.el,
  );
}

// ---------------------------------------------------------------------------
// List view (accessible alternative to the canvas)
// ---------------------------------------------------------------------------

export class ListView {
  readonly dialog: HTMLDialogElement;
  private body: HTMLElement;
  private heading: HTMLElement;
  private key = '';

  constructor(private onPick: (kind: 'body' | 'system', id: string) => void) {
    this.heading = h('h2', { class: 'display u-listview__title' }, 'Known Universe');
    this.body = h('div', { class: 'u-listview__body' });
    const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close list view' }, icon(ICONS.close));
    close.addEventListener('click', () => this.dialog.close());
    this.dialog = h('dialog', { class: 'dialog u-listview', 'aria-labelledby': 'u-listview-title' }, h('header', { class: 'u-listview__head' }, this.heading, close), this.body) as HTMLDialogElement;
    this.heading.id = 'u-listview-title';
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.dialog.close();
    });
    document.body.append(this.dialog);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  open(year: Year): void {
    this.update(year, true);
    if (!this.dialog.open) this.dialog.showModal();
  }

  update(year: Year, force = false): void {
    if (!force && !this.dialog.open) return;
    const parts: string[] = [String(Math.floor(year))];
    for (const b of lore.bodies) parts.push(`${W.visibleAt(b, year) ? 1 : 0}${W.controllerAt(b, year).faction.id}${W.bodyName(b, year)}`);
    const key = parts.join('|');
    if (key === this.key) return;
    this.key = key;
    this.heading.textContent = `Known Universe · ${formatYear(year)}`;
    const systems = [...lore.systems].sort((a, b) => W.starLabel(a).localeCompare(W.starLabel(b)));
    const ul = h('ul', { class: 'u-listview__systems' });
    for (const s of systems) {
      const sysBtn = h('button', { class: 'link-btn u-listview__sys', type: 'button' }, s.star);
      sysBtn.addEventListener('click', () => {
        this.dialog.close();
        this.onPick('system', s.id);
      });
      const bodies = (W.planetsBySystem.get(s.id) ?? []).flatMap((p) => [p, ...(W.moonsByParent.get(p.id) ?? [])]).filter((b) => W.visibleAt(b, year));
      const inner = h('ul', { class: 'u-listview__bodies' });
      for (const b of bodies) {
        const { faction: f, entry } = W.controllerAt(b, year);
        const btn = h('button', { class: 'link-btn', type: 'button' }, W.bodyName(b, year));
        btn.addEventListener('click', () => {
          this.dialog.close();
          this.onPick('body', b.id);
        });
        inner.append(
          h('li', { class: 'u-row' }, btn, b.kind === 'moon' ? h('span', { class: 'muted u-row__meta' }, 'moon') : entry ? factionChip(f) : h('span', { class: 'muted u-row__meta' }, b.control.length ? 'holder unrecorded' : 'no holder')),
        );
      }
      if (!bodies.length) inner.append(h('li', { class: 'muted' }, 'No worlds on the map this year.'));
      ul.append(h('li', null, h('h3', null, sysBtn), inner));
    }
    this.body.replaceChildren(ul);
  }
}

// ---------------------------------------------------------------------------
// Era guide
// ---------------------------------------------------------------------------

export function eraJumpYear(era: Era): Year {
  for (const id of era.books) {
    const b = W.bookById.get(id);
    if (b && b.span[0] > era.start && b.span[0] <= era.end) return b.span[0];
  }
  const ev = W.eventsSorted.find((e) => e.year > era.start && e.year <= era.end);
  if (ev) return ev.year;
  return Math.min(era.end, era.start + 1);
}

export class EraGuide {
  readonly el: HTMLElement;
  private rows = new Map<string, HTMLElement>();
  private books = new Map<string, HTMLElement>();
  private key = '';

  constructor(private onJump: (y: Year) => void) {
    const list = h('ol', { class: 'u-eras' });
    for (const era of lore.eras) {
      const jump = h('button', { class: 'u-era__jump', type: 'button', style: `--c:${era.color}` },
        h('span', { class: 'u-era__name' }, era.name),
        h('span', { class: 'u-era__years mono' }, `${formatYear(era.start)} – ${formatYear(era.end)}`),
      );
      jump.addEventListener('click', () => this.onJump(eraJumpYear(era)));
      const books = era.books.map((id) => W.bookById.get(id)?.title).filter(Boolean).join(' · ');
      const row = h('li', { class: 'u-era', style: `--c:${era.color}`, 'data-current': 'false' }, jump, books ? h('span', { class: 'u-era__books muted' }, books) : null, h('p', { class: 'u-era__summary' }, era.summary));
      this.rows.set(era.id, row);
      list.append(row);
    }
    const bookList = h('ol', { class: 'u-books' });
    for (const b of lore.books) {
      const btn = h('button', { class: 'u-book', type: 'button', 'data-current': 'false' }, h('span', { class: 'u-book__title' }, b.title), h('span', { class: 'mono u-book__meta' }, `${formatYear(b.span[0])} · pub. ${b.published}`));
      btn.addEventListener('click', () => this.onJump(b.span[0]));
      this.books.set(b.id, btn);
      bookList.append(h('li', null, btn));
    }
    const first = bookList.querySelector('button');
    first?.setAttribute('data-autofocus', '');
    this.el = h('div', { class: 'u-pop__body u-eraguide' }, h('h3', { class: 'eyebrow' }, 'The six novels'), bookList, h('h3', { class: 'eyebrow' }, 'Eras'), list);
  }

  update(year: Year): void {
    const era = eraAt(lore.eras, year);
    const book = lore.books.find((b) => year >= b.span[0] && year <= b.span[1] + 0.999);
    const key = era.id + '|' + (book?.id ?? '');
    if (key === this.key) return;
    this.key = key;
    for (const [id, row] of this.rows) {
      row.dataset.current = String(id === era.id);
      const btn = row.querySelector('button');
      if (id === era.id) btn?.setAttribute('aria-current', 'true');
      else btn?.removeAttribute('aria-current');
    }
    for (const [id, btn] of this.books) {
      btn.dataset.current = String(id === book?.id);
      if (id === book?.id) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    }
  }
}

// ---------------------------------------------------------------------------
// Event banner
// ---------------------------------------------------------------------------

export class Banner {
  readonly el: HTMLElement;
  private eyebrow: HTMLElement;
  private title: HTMLElement;
  private summary: HTMLElement;
  private more: HTMLElement;
  private details: HTMLButtonElement;
  private timer: number | undefined;
  private current: LoreEvent | null = null;

  constructor(onDetails: (e: LoreEvent) => void) {
    this.eyebrow = h('div', { class: 'eyebrow u-banner__eyebrow' });
    this.title = h('div', { class: 'display u-banner__title' });
    this.summary = h('p', { class: 'u-banner__summary' });
    this.more = h('p', { class: 'u-banner__more muted' });
    this.details = h('button', { class: 'btn u-banner__btn', type: 'button' }, 'Details', icon(ICONS.arrowRight, { size: 16 }));
    this.details.addEventListener('click', () => {
      if (this.current) onDetails(this.current);
      this.hide();
    });
    const close = h('button', { class: 'icon-btn u-banner__close', type: 'button', 'aria-label': 'Dismiss' }, icon(ICONS.close));
    close.addEventListener('click', () => this.hide());
    this.el = h(
      'div',
      { class: 'u-banner panel', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-open': 'false' },
      h('div', { class: 'u-banner__text' }, this.eyebrow, this.title, this.summary, this.more),
      h('div', { class: 'u-banner__actions' }, this.details, close),
    );
    this.el.addEventListener('pointerenter', () => this.timer !== undefined && clearTimeout(this.timer));
    this.el.addEventListener('pointerleave', () => this.schedule(2500));
  }

  show(events: LoreEvent[], fast: boolean): void {
    if (!events.length) return;
    const main = events[events.length - 1];
    this.current = main;
    const era = eraAt(lore.eras, main.year);
    const where = main.body ? W.bodyById.get(main.body) : undefined;
    this.el.style.setProperty('--accent', era.color);
    this.eyebrow.textContent = [formatYear(main.year), where ? W.bodyName(where, main.year) : null, main.book ? W.bookById.get(main.book)?.title : null].filter(Boolean).join(' · ');
    this.title.textContent = main.title;
    this.summary.textContent = main.summary;
    const others = events.slice(0, -1);
    this.more.textContent = others.length ? `Also: ${others.map((e) => e.title).join(' · ')}` : '';
    this.more.hidden = !others.length;
    this.el.dataset.open = 'true';
    this.el.dataset.anim = String(!reducedMotion());
    this.schedule(fast ? 3800 : 6500);
  }

  hide(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.el.dataset.open = 'false';
  }

  private schedule(ms: number): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    if (this.el.dataset.open !== 'true') return;
    this.timer = window.setTimeout(() => this.hide(), ms);
  }
}

// ---------------------------------------------------------------------------
// Intro title (non-blocking)
// ---------------------------------------------------------------------------

export function intro(subtitle: string): HTMLElement {
  const el = h(
    'div',
    { class: 'u-intro', 'aria-hidden': 'true' },
    h('div', { class: 'eyebrow u-intro__eyebrow' }, 'Imperial cartography'),
    h('div', { class: 'display u-intro__title' }, 'The Known Universe'),
    h('div', { class: 'mono u-intro__sub' }, subtitle),
  );
  const ms = reducedMotion() ? 1600 : 3600;
  window.setTimeout(() => el.classList.add('is-out'), ms);
  window.setTimeout(() => el.remove(), ms + 1400);
  return el;
}
