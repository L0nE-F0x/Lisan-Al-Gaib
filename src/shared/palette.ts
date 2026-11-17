/**
 * Search palette (Ctrl/Cmd+K, "/" or a button). ARIA combobox + listbox pattern.
 *
 *   const palette = new Palette({ placeholder: 'Search places, people…' });
 *   palette.setItems(() => items);              // called each time it opens (year-aware)
 *   palette.onSelect((item) => ...);
 *   palette.bindShortcut();
 *   someButton.addEventListener('click', () => palette.open());
 */
import { audio } from './audio.ts';
import { h } from './dom.ts';

export interface PaletteItem {
  id: string;
  label: string;
  /** Secondary text, e.g. "Sietch · Habbanya Ridge" */
  sub?: string;
  group: string;
  color?: string;
  /** Extra words to match: aliases, old names. */
  keywords?: string[];
  /** Greyed out but still selectable (e.g. not present in this year). */
  dim?: boolean;
}

let uid = 0;

export class Palette {
  private dialog: HTMLDialogElement;
  private input: HTMLInputElement;
  private list: HTMLElement;
  private empty: HTMLElement;
  private source: () => PaletteItem[] = () => [];
  private items: PaletteItem[] = [];
  private filtered: PaletteItem[] = [];
  private active = 0;
  private selectFns = new Set<(item: PaletteItem) => void>();
  private id = `palette-${++uid}`;

  constructor(opts: { placeholder?: string; label?: string } = {}) {
    this.input = h('input', {
      class: 'input palette__input',
      type: 'search',
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': `${this.id}-list`,
      'aria-autocomplete': 'list',
      'aria-label': opts.label ?? 'Search',
      placeholder: opts.placeholder ?? 'Search…',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    this.list = h('ul', { class: 'palette__list', id: `${this.id}-list`, role: 'listbox', 'aria-label': 'Results' });
    this.empty = h('p', { class: 'palette__empty muted', hidden: true }, 'Nothing in the archives by that name.');
    const hint = h(
      'div',
      { class: 'palette__hint muted' },
      h('span', null, h('kbd', null, '↑'), ' ', h('kbd', null, '↓'), ' to move'),
      h('span', null, h('kbd', null, 'Enter'), ' to open'),
      h('span', null, h('kbd', null, 'Esc'), ' to close'),
    );
    this.dialog = h('dialog', { class: 'dialog palette', 'aria-label': opts.label ?? 'Search' }, this.input, this.list, this.empty, hint) as HTMLDialogElement;
    document.body.append(this.dialog);

    this.input.addEventListener('input', () => this.filter());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.choose(this.filtered[this.active]); }
    });
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close(); // backdrop click
    });
  }

  setItems(source: () => PaletteItem[]): void {
    this.source = source;
  }

  onSelect(fn: (item: PaletteItem) => void): () => void {
    this.selectFns.add(fn);
    return () => this.selectFns.delete(fn);
  }

  open(query = ''): void {
    this.items = this.source();
    this.input.value = query;
    this.filter();
    if (!this.dialog.open) this.dialog.showModal();
    this.input.focus();
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }

  /** Ctrl/Cmd+K anywhere, or "/" when not typing. */
  bindShortcut(): () => void {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.dialog.open ? this.close() : this.open();
      } else if (e.key === '/' && !typing && !this.dialog.open) {
        e.preventDefault();
        this.open();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  private filter(): void {
    const q = normalize(this.input.value);
    const scored: { item: PaletteItem; score: number }[] = [];
    for (const item of this.items) {
      if (!q) {
        scored.push({ item, score: 0 });
        continue;
      }
      const hay = [item.label, ...(item.keywords ?? [])].map(normalize);
      let best = Infinity;
      for (const s of hay) {
        const i = s.indexOf(q);
        if (i === 0) best = Math.min(best, 0);
        else if (i > 0) best = Math.min(best, s[i - 1] === ' ' ? 1 : 2);
      }
      if (best < Infinity) scored.push({ item, score: best + (item.dim ? 3 : 0) });
    }
    scored.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));
    this.filtered = scored.slice(0, 60).map((s) => s.item);
    this.active = 0;
    this.render();
  }

  private render(): void {
    this.list.replaceChildren();
    let group = '';
    this.filtered.forEach((item, i) => {
      if (item.group !== group) {
        group = item.group;
        this.list.append(h('li', { class: 'palette__group eyebrow', role: 'presentation' }, group));
      }
      const li = h(
        'li',
        {
          class: 'palette__item',
          role: 'option',
          id: `${this.id}-opt-${i}`,
          'aria-selected': String(i === this.active),
          'data-dim': String(!!item.dim),
        },
        h('span', { class: 'chip__dot', style: `color:${item.color ?? 'var(--spice)'}` }),
        h('span', { class: 'palette__label' }, item.label),
        item.sub ? h('span', { class: 'palette__sub muted' }, item.sub) : null,
      );
      li.addEventListener('pointerdown', (e) => e.preventDefault());
      li.addEventListener('click', () => this.choose(item));
      li.addEventListener('pointermove', () => {
        if (this.active !== i) {
          this.active = i;
          this.updateActive();
        }
      });
      this.list.append(li);
    });
    this.empty.hidden = this.filtered.length > 0;
    this.updateActive();
  }

  private updateActive(): void {
    const opts = this.list.querySelectorAll<HTMLElement>('[role="option"]');
    opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === this.active)));
    const cur = opts[this.active];
    if (cur) {
      this.input.setAttribute('aria-activedescendant', cur.id);
      cur.scrollIntoView({ block: 'nearest' });
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  private move(d: number): void {
    if (!this.filtered.length) return;
    this.active = (this.active + d + this.filtered.length) % this.filtered.length;
    this.updateActive();
  }

  private choose(item: PaletteItem | undefined): void {
    if (!item) return;
    this.close();
    audio.sfx('select');
    for (const fn of this.selectFns) fn(item);
  }
}

function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`-]/g, '')
    .toLowerCase()
    .trim();
}
