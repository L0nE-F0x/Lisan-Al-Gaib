/**
 * Layers popover (labels, regions, storms, moons, day/night) and the accessible List view of
 * every place in the current year, grouped by region. The list doubles as the no-WebGL fallback.
 */
import { lore } from '../data/index.ts';
import { formatYear } from '../data/query.ts';
import type { ArrakisPlace, Year } from '../data/types.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import { kindIcon } from './markers.ts';
import { KIND_LABEL, KIND_PRIORITY, factionColor, factionName, placeAt, placeController, placeName, planetName, region } from './world.ts';

export interface LayerState {
  labels: boolean;
  regions: boolean;
  storms: boolean;
  moons: boolean;
  /** true = sun slowly orbits (real day/night); false = fixed light for readability. */
  daynight: boolean;
}

const KEY = 'lag:arrakis:layers:v1';
const DEFAULTS: LayerState = { labels: true, regions: true, storms: true, moons: true, daynight: false };

export function loadLayers(): LayerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LayerState>) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}

function saveLayers(s: LayerState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const LABELS: { key: keyof LayerState; label: string; hint: string }[] = [
  { key: 'labels', label: 'Place labels', hint: 'Names next to markers' },
  { key: 'regions', label: 'Regions', hint: 'Large region names when zoomed out' },
  { key: 'storms', label: 'Coriolis storms', hint: 'Dust storms, by era' },
  { key: 'moons', label: 'Moons', hint: 'The two moons in orbit' },
  { key: 'daynight', label: 'Day & night', hint: 'Off keeps the planet evenly lit' },
];

let uid = 0;

export class LayersMenu {
  readonly button: HTMLButtonElement;
  readonly panel: HTMLElement;
  private state: LayerState;
  private fns = new Set<(s: LayerState) => void>();

  constructor(initial: LayerState, onList: () => void, opts: { webgl: boolean }) {
    this.state = initial;
    const id = `layers-${++uid}`;
    this.button = h(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': 'Layers and list view', title: 'Layers', 'aria-expanded': 'false', 'aria-controls': id },
      icon(ICONS.layers),
    ) as HTMLButtonElement;

    const switches = LABELS.map(({ key, label, hint }) => {
      const b = h(
        'button',
        { class: 'switch layer-switch', type: 'button', role: 'switch', 'aria-checked': String(this.state[key]), disabled: !opts.webgl },
        h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
        h('span', { class: 'layer-switch__text' }, h('span', null, label), h('span', { class: 'layer-switch__hint muted' }, hint)),
      );
      b.addEventListener('click', () => {
        this.state = { ...this.state, [key]: !this.state[key] };
        b.setAttribute('aria-checked', String(this.state[key]));
        saveLayers(this.state);
        for (const f of this.fns) f(this.state);
      });
      return b;
    });

    const listBtn = h('button', { class: 'btn layers__list', type: 'button' }, icon(ICONS.menu, { size: 16 }), 'List view');
    listBtn.addEventListener('click', () => {
      this.close();
      onList();
    });

    this.panel = h(
      'div',
      { class: 'popover panel layers', id, role: 'group', 'aria-label': 'Map layers', hidden: true },
      h('h2', { class: 'eyebrow layers__title' }, 'Layers'),
      ...switches,
      listBtn,
    );
    this.button.addEventListener('click', () => (this.panel.hidden ? this.open() : this.close()));
    document.addEventListener('pointerdown', (e) => {
      if (this.panel.hidden) return;
      const t = e.target as Node;
      if (!this.panel.contains(t) && !this.button.contains(t)) this.close();
    });
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close(true);
      }
    });
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  get value(): LayerState {
    return this.state;
  }

  onChange(fn: (s: LayerState) => void): void {
    this.fns.add(fn);
  }

  open(): void {
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.panel.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }

  close(refocus = false): void {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (refocus) this.button.focus();
  }
}

/** Accessible list of all places that exist in the year, grouped by region. */
export class PlaceList {
  readonly el: HTMLElement;
  private heading: HTMLElement;
  private content: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private sig = '';
  private year: Year = 0;
  private returnFocus: HTMLElement | null = null;
  private _open = false;

  constructor(
    private onPick: (id: string) => void,
    private opts: { permanent: boolean; note?: string },
  ) {
    this.heading = h('h2', { class: 'plist__title display', tabindex: '-1' });
    this.content = h('div', { class: 'plist__content' });
    this.closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close list view' }, icon(ICONS.close)) as HTMLButtonElement;
    this.closeBtn.addEventListener('click', () => this.close());
    this.closeBtn.hidden = opts.permanent;
    this.el = h(
      'section',
      { class: 'plist panel', 'aria-label': 'List of places', 'data-open': String(opts.permanent), 'data-permanent': String(opts.permanent) },
      h('header', { class: 'plist__head' }, h('div', null, h('p', { class: 'eyebrow' }, 'List view'), this.heading), this.closeBtn),
      opts.note ? h('p', { class: 'plist__note', role: 'note' }, opts.note) : null,
      this.content,
    );
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.opts.permanent) {
        e.stopPropagation();
        this.close();
      }
    });
    this._open = opts.permanent;
  }

  get isOpen(): boolean {
    return this._open;
  }

  open(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this._open = true;
    this.el.dataset.open = 'true';
    this.render(true);
    this.heading.focus({ preventScroll: true });
  }

  close(): void {
    if (this.opts.permanent || !this._open) return;
    this._open = false;
    this.el.dataset.open = 'false';
    this.returnFocus?.focus({ preventScroll: true });
  }

  setYear(year: Year): void {
    this.year = year;
    if (this._open) this.render(false);
  }

  private render(force: boolean): void {
    const y = this.year;
    const places = lore.arrakis.places.filter((p) => placeAt(p, y));
    const sig = places.map((p) => `${p.id}${placeName(p, y)}${placeController(p, y)}`).join('|') + planetName(y);
    this.heading.textContent = `${planetName(y)} in ${formatYear(y)}`;
    if (!force && sig === this.sig) return;
    this.sig = sig;

    const groups = new Map<string, ArrakisPlace[]>();
    for (const p of places) {
      const key = p.region && region(p.region) ? p.region : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const order = [...lore.arrakis.regions.map((r) => r.id), ''];
    const blocks: HTMLElement[] = [];
    for (const key of order) {
      const list = groups.get(key);
      if (!list?.length) continue;
      list.sort((a, b) => (KIND_PRIORITY[b.kind] ?? 0) - (KIND_PRIORITY[a.kind] ?? 0) || placeName(a, y).localeCompare(placeName(b, y)));
      const r = region(key);
      blocks.push(
        h(
          'section',
          { class: 'plist__group' },
          h('h3', { class: 'eyebrow' }, r?.name ?? 'Elsewhere'),
          h(
            'ul',
            null,
            ...list.map((p) => {
              const ctrl = placeController(p, y);
              return h(
                'li',
                null,
                h(
                  'button',
                  { class: 'person', type: 'button', style: `--c:${factionColor(ctrl)}`, onclick: () => this.onPick(p.id) },
                  h('span', { class: 'person__icon', 'aria-hidden': 'true' }, kindIcon(p.kind, 14)),
                  h('span', { class: 'person__name' }, placeName(p, y)),
                  h('span', { class: 'person__sub muted' }, `${KIND_LABEL[p.kind] ?? p.kind}${ctrl ? ` · ${factionName(ctrl)}` : ''}`),
                ),
              );
            }),
          ),
        ),
      );
    }
    this.content.replaceChildren(
      ...(blocks.length ? blocks : [h('p', { class: 'muted' }, lore.arrakis.places.length ? 'No charted places in this year.' : 'The archive of places is still being compiled.')]),
    );
  }
}
