/**
 * Detail sheet content for places, regions and characters, all year-aware.
 * Owns the shared Sheet and a small back-stack (place → character → relation …).
 */
import { lore } from '../data/index.ts';
import { ageAt, controlAt, formatYear, lifeStatus, whereaboutsAt } from '../data/query.ts';
import type { ArrakisPlace, ArrakisRegion, BookId, Character, ControlEntry, LoreEvent, Year } from '../data/types.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import { Sheet, dl, section } from '../shared/sheet.ts';
import { kindIcon } from './markers.ts';
import {
  BOOK_TITLES,
  KIND_LABEL,
  arrakisEvents,
  bodyName,
  character,
  charactersAt,
  eventsAtPlace,
  faction,
  factionColor,
  factionName,
  humanize,
  place as placeById,
  placeAt,
  placeController,
  placeName,
  region as regionById,
} from './world.ts';

export type Selection = { type: 'place' | 'region' | 'character'; id: string };

export interface DetailsHooks {
  /** Fly the camera to a place (and select it). */
  showPlace(id: string, opts?: { fly?: boolean; fromSheet?: boolean }): void;
  showRegion(id: string): void;
  setYear(year: Year): void;
  copyLink(): void;
  flyToPlace(id: string): void;
  flyToRegion(id: string): void;
  /** Called whenever the sheet's subject changes (null = closed). */
  onSubject(sel: Selection | null): void;
}

const RELATION_LABEL: Record<string, string> = {
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  spouse: 'Spouse',
  concubine: 'Concubine',
  mentor: 'Mentor',
  student: 'Student',
  ally: 'Ally',
  enemy: 'Enemy',
  servant: 'Serves',
  master: 'Master',
  'ghola-of': 'Ghola of',
};

export class Details {
  readonly sheet: Sheet;
  private current: Selection | null = null;
  private stack: Selection[] = [];
  private year: Year = 0;
  private signature = '';

  constructor(private hooks: DetailsHooks) {
    this.sheet = new Sheet({ label: 'Details' });
    this.sheet.el.classList.add('atlas-sheet');
    this.sheet.onClose(() => {
      this.current = null;
      this.stack = [];
      this.signature = '';
      this.hooks.onSubject(null);
    });
  }

  get subject(): Selection | null {
    return this.current;
  }

  /** Open a subject. `push` keeps the current one on the back-stack (navigating inside the sheet). */
  open(sel: Selection, year: Year, opts: { push?: boolean; focus?: boolean } = {}): void {
    if (opts.push && this.current && (this.current.type !== sel.type || this.current.id !== sel.id)) this.stack.push(this.current);
    else if (!opts.push) this.stack = [];
    this.current = sel;
    this.year = year;
    this.render(opts.focus ?? true, true);
    this.hooks.onSubject(sel);
  }

  close(): void {
    this.sheet.close();
  }

  /** Year changed: re-render only when something visible actually differs. */
  setYear(year: Year): void {
    this.year = year;
    if (!this.current || !this.sheet.isOpen) return;
    this.render(false, false);
  }

  private back(): void {
    const prev = this.stack.pop();
    if (!prev) return;
    this.current = prev;
    this.render(true, true);
    this.hooks.onSubject(prev);
  }

  private render(focus: boolean, force: boolean): void {
    const sel = this.current;
    if (!sel) return;
    const sig = this.sig(sel);
    if (!force && sig === this.signature) return;
    this.signature = sig;
    const body = this.sheet.el.querySelector<HTMLElement>('.sheet__body');
    const scroll = force ? 0 : body?.scrollTop ?? 0;
    if (sel.type === 'place') this.renderPlace(sel.id, focus);
    else if (sel.type === 'region') this.renderRegion(sel.id, focus);
    else this.renderCharacter(sel.id, focus);
    if (body && scroll) body.scrollTop = scroll;
  }

  /** A cheap fingerprint of everything year-dependent that the current view shows. */
  private sig(sel: Selection): string {
    const y = this.year;
    if (sel.type === 'place') {
      const p = placeById(sel.id);
      if (!p) return 'x';
      const here = charactersAt(p.id, y).map((c) => `${c.id}:${ageAt(c, y) ?? ''}`).join(',');
      return [placeAt(p, y), placeName(p, y), controlAt(p.control ?? [], y)?.from, here, Math.floor(y)].join('|');
    }
    if (sel.type === 'region') {
      const r = regionById(sel.id);
      return r ? lore.arrakis.places.filter((p) => p.region === r.id).map((p) => `${placeAt(p, y)}${placeName(p, y)}${placeController(p, y)}`).join(',') : 'x';
    }
    const c = character(sel.id);
    if (!c) return 'x';
    const w = whereaboutsAt(c, y);
    return [lifeStatus(c, y), ageAt(c, y), controlAt(c.allegiance ?? [], y)?.faction, w?.body, w?.place, Math.floor(y)].join('|');
  }

  // ---------------------------------------------------------------------------
  // Place

  private renderPlace(id: string, focus: boolean): void {
    const p = placeById(id);
    if (!p) return;
    const y = this.year;
    const exists = placeAt(p, y);
    const ctrl = controlAt(p.control ?? [], y);
    const reg = regionById(p.region);
    const name = placeName(p, y);

    const body = h('div', { class: 'dt' });
    if (!exists) body.append(this.absenceNote(p));
    body.append(h('p', null, p.summary));

    const names = (p.names ?? []).filter((n) => n.name !== name);
    const otherNames = [p.name !== name ? p.name : null, ...names.map((n) => `${n.name} (from ${formatYear(n.from)})`)].filter(Boolean).join(' · ');
    body.append(
      dl([
        ['Held by', exists ? (ctrl ? this.factionChip(ctrl.faction, ctrl.approx) : 'Unrecorded') : null],
        ['Region', reg ? this.linkBtn(reg.name, () => this.hooks.showRegion(reg.id)) : null],
        ['Population', p.population],
        ['Other names', otherNames || null],
        ['Exists', spanText(p.exists)],
      ]),
    );

    if ((p.control ?? []).length) body.append(section('Control history', this.controlList(p.control, y)));
    if (p.facts?.length) body.append(section('Facts', h('ul', null, ...p.facts.map((f) => h('li', null, f)))));

    const here = exists ? charactersAt(p.id, y) : [];
    body.append(
      section(
        `Here in ${formatYear(y)}`,
        here.length
          ? h('ul', { class: 'people' }, ...here.map((c) => h('li', null, this.personBtn(c))))
          : h('p', { class: 'muted' }, 'No recorded figures are here in this year.'),
      ),
    );

    const evs = eventsAtPlace(p.id);
    if (evs.length) body.append(section('Events here', this.eventList(evs)));
    body.append(this.sources(p.sources));

    this.sheet.open(
      {
        eyebrow: [KIND_LABEL[p.kind] ?? humanize(p.kind), reg?.name].filter(Boolean).join(' · '),
        title: name,
        accent: exists ? factionColor(ctrl?.faction) : 'var(--sand-dim)',
        body,
        actions: [
          ...this.backAction(),
          this.actionBtn(ICONS.target, 'Fly here', () => this.hooks.flyToPlace(p.id)),
          this.actionBtn(ICONS.share, 'Copy link', () => this.hooks.copyLink()),
        ],
      },
      { focus },
    );
  }

  private absenceNote(p: ArrakisPlace): HTMLElement {
    const s = p.exists;
    const y = this.year;
    let text = `Not present in ${formatYear(y)}.`;
    let jump: Year | undefined;
    if (s?.from !== undefined && y < s.from) {
      text = `Not yet founded in ${formatYear(y)}. First recorded ${s.approx ? 'around ' : ''}${formatYear(s.from)}.`;
      jump = s.from;
    } else if (s?.to !== undefined && y > s.to) {
      text = `Gone by ${formatYear(y)}. Last recorded ${s.approx ? 'around ' : ''}${formatYear(s.to)}.`;
      jump = s.to;
    }
    return h(
      'div',
      { class: 'dt__note', role: 'note' },
      h('span', null, text),
      jump !== undefined ? this.linkBtn(`Go to ${formatYear(jump)}`, () => this.hooks.setYear(jump)) : null,
    );
  }

  private controlList(entries: ControlEntry[], y: Year): HTMLElement {
    const cur = controlAt(entries, y);
    return h(
      'ol',
      { class: 'ctl' },
      ...entries.map((e) =>
        h(
          'li',
          { 'data-current': String(e === cur), style: `--c:${factionColor(e.faction)}` },
          this.linkBtn(`${e.approx ? 'c. ' : ''}${formatYear(e.from)}`, () => this.hooks.setYear(e.from), 'ctl__year mono'),
          h('span', { class: 'ctl__who' }, h('i', { class: 'chip__dot' }), factionName(e.faction)),
          e.note ? h('span', { class: 'ctl__note muted' }, e.note) : null,
        ),
      ),
    );
  }

  private eventList(evs: LoreEvent[]): HTMLElement {
    const y = this.year;
    return h(
      'ul',
      { class: 'evl' },
      ...evs.map((e) =>
        h(
          'li',
          { 'data-past': String(e.year <= y) },
          h(
            'button',
            { class: 'evl__btn', type: 'button', onclick: () => this.hooks.setYear(e.year) },
            h('span', { class: 'evl__year mono' }, `${e.approx ? 'c. ' : ''}${formatYear(e.year)}`),
            h('span', { class: 'evl__title' }, e.title),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Region

  private renderRegion(id: string, focus: boolean): void {
    const r = regionById(id);
    if (!r) return;
    const y = this.year;
    const places = lore.arrakis.places
      .filter((p) => p.region === r.id)
      .sort((a, b) => Number(placeAt(b, y)) - Number(placeAt(a, y)) || placeName(a, y).localeCompare(placeName(b, y)));
    const body = h(
      'div',
      { class: 'dt' },
      h('p', null, r.summary),
      dl([['Danger', dangerMeter(r)]]),
      section(
        'Places',
        places.length
          ? h('ul', { class: 'plist' }, ...places.map((p) => h('li', null, this.placeBtn(p))))
          : h('p', { class: 'muted' }, 'No charted places in this region.'),
      ),
    );
    this.sheet.open(
      {
        eyebrow: 'Region',
        title: r.name,
        accent: 'var(--sand)',
        body,
        actions: [...this.backAction(), this.actionBtn(ICONS.target, 'Fly here', () => this.hooks.flyToRegion(r.id))],
      },
      { focus },
    );
  }

  // ---------------------------------------------------------------------------
  // Character

  private renderCharacter(id: string, focus: boolean): void {
    const c = character(id);
    if (!c) return;
    const y = this.year;
    const alleg = controlAt(c.allegiance ?? [], y) ?? (c.allegiance?.length ? c.allegiance[0] : undefined);
    const w = whereaboutsAt(c, y);
    const actions: Node[] = [...this.backAction()];
    let where: Node | string | null = null;
    if (w) {
      const wp = w.body === 'arrakis' ? placeById(w.place) : undefined;
      if (w.body === 'arrakis') {
        where = wp
          ? this.linkBtn(`${placeName(wp, y)}, ${bodyName('arrakis', y)}`, () => this.hooks.showPlace(wp.id, { fly: true, fromSheet: true }))
          : `${bodyName('arrakis', y)}${w.approx ? ' (approx.)' : ''}`;
        if (wp) actions.push(this.actionBtn(ICONS.target, 'Fly there', () => this.hooks.showPlace(wp.id, { fly: true, fromSheet: true })));
      } else {
        const href = `/universe/?focus=${encodeURIComponent(w.body)}&year=${Math.round(y)}`;
        const label = bodyName(w.body, y);
        where = h('a', { href, class: 'link-btn', 'data-transition': 'Fold-space routing — Known Universe' }, `${label} (Known Universe)`);
        actions.push(
          h('a', { class: 'btn', href, 'data-transition': 'Fold-space routing — Known Universe' }, icon(ICONS.arrowRight, { size: 16 }), `Go to ${label}`),
        );
      }
    }

    const body = h('div', { class: 'dt' });
    body.append(h('p', null, c.summary));
    body.append(
      dl([
        ['Also known as', c.aliases?.length ? c.aliases.join(' · ') : null],
        [`In ${formatYear(y)}`, statusText(c, y)],
        ['Lived', lifespan(c)],
        ['Allegiance', alleg ? this.factionChip(alleg.faction, alleg.approx) : null],
        ['Location', where ?? (lifeStatus(c, y) === 'alive' ? 'Unrecorded' : null)],
      ]),
    );
    if (c.ghola) body.append(h('p', { class: 'dt__note', role: 'note' }, 'Returns as a ghola: lifespans may overlap across eras.'));
    if (c.note) body.append(h('p', { class: 'muted' }, c.note));

    const rels = (c.relations ?? []).filter((r) => character(r.id));
    if (rels.length) {
      body.append(
        section(
          'Relations',
          h(
            'ul',
            { class: 'people' },
            ...rels.map((r) => h('li', null, this.personBtn(character(r.id)!, RELATION_LABEL[r.type] ?? humanize(r.type)))),
          ),
        ),
      );
    }
    const evs = arrakisEvents.filter((e) => e.characters?.includes(c.id));
    if (evs.length) body.append(section('On Arrakis', this.eventList(evs)));
    body.append(this.sources(c.sources));

    this.sheet.open(
      {
        eyebrow: c.ghola ? 'Character · Ghola' : 'Character',
        title: c.name,
        accent: factionColor(alleg?.faction),
        body,
        actions,
      },
      { focus },
    );
  }

  // ---------------------------------------------------------------------------
  // Bits

  private backAction(): Node[] {
    const prev = this.stack[this.stack.length - 1];
    if (!prev) return [];
    const label =
      prev.type === 'place'
        ? placeName(placeById(prev.id)!, this.year)
        : prev.type === 'region'
          ? regionById(prev.id)?.name
          : character(prev.id)?.name;
    return [this.actionBtn(ICONS.arrowLeft, `Back${label ? ` to ${label}` : ''}`, () => this.back())];
  }

  private actionBtn(paths: readonly string[], label: string, fn: () => void): HTMLButtonElement {
    return h('button', { class: 'btn', type: 'button', onclick: fn }, icon(paths, { size: 16 }), label) as HTMLButtonElement;
  }

  private linkBtn(label: string, fn: () => void, cls = ''): HTMLButtonElement {
    return h('button', { class: `link-btn ${cls}`.trim(), type: 'button', onclick: fn }, label) as HTMLButtonElement;
  }

  private factionChip(id: string, approx?: boolean): HTMLElement {
    const f = faction(id);
    return h(
      'span',
      { class: 'chip', style: `color:${factionColor(id)}`, title: f?.summary ?? '' },
      h('span', { class: 'chip__dot' }),
      h('span', { style: 'color:var(--bone)' }, `${factionName(id)}${approx ? ' (approx.)' : ''}`),
    );
  }

  private personBtn(c: Character, relation?: string): HTMLButtonElement {
    const y = this.year;
    const alleg = controlAt(c.allegiance ?? [], y) ?? c.allegiance?.[0];
    return h(
      'button',
      {
        class: 'person',
        type: 'button',
        style: `--c:${factionColor(alleg?.faction)}`,
        onclick: () => this.open({ type: 'character', id: c.id }, y, { push: true }),
      },
      h('span', { class: 'person__dot', 'aria-hidden': 'true' }),
      h('span', { class: 'person__name' }, c.name),
      h('span', { class: 'person__sub muted' }, [relation, statusShort(c, y)].filter(Boolean).join(' · ')),
    ) as HTMLButtonElement;
  }

  private placeBtn(p: ArrakisPlace): HTMLButtonElement {
    const y = this.year;
    const exists = placeAt(p, y);
    return h(
      'button',
      {
        class: 'person',
        type: 'button',
        'data-dim': String(!exists),
        style: `--c:${exists ? factionColor(placeController(p, y)) : 'var(--sand-faint)'}`,
        onclick: () => {
          this.stack.push(this.current!);
          this.hooks.showPlace(p.id, { fly: true, fromSheet: true });
        },
      },
      h('span', { class: 'person__icon', 'aria-hidden': 'true' }, kindIcon(p.kind, 14)),
      h('span', { class: 'person__name' }, placeName(p, y)),
      h('span', { class: 'person__sub muted' }, exists ? KIND_LABEL[p.kind] : `${KIND_LABEL[p.kind]} · not present`),
    ) as HTMLButtonElement;
  }

  private sources(ids: BookId[] | undefined): HTMLElement {
    const list = (ids ?? []).map((b) => BOOK_TITLES[b] ?? humanize(b));
    return section('Sources', list.length ? h('p', { class: 'dt__sources' }, list.join(' · ')) : h('p', { class: 'muted' }, 'Unspecified'));
  }
}

function spanText(s: ArrakisPlace['exists']): string | null {
  if (!s || (s.from === undefined && s.to === undefined)) return null;
  const c = s.approx ? 'c. ' : '';
  if (s.from !== undefined && s.to !== undefined) return `${c}${formatYear(s.from)} – ${c}${formatYear(s.to)}`;
  if (s.from !== undefined) return `From ${c}${formatYear(s.from)}`;
  return `Until ${c}${formatYear(s.to!)}`;
}

function lifespan(c: Character): string | null {
  if (c.born === undefined && c.died === undefined) return null;
  const a = c.approxDates ? 'c. ' : '';
  const b = c.born !== undefined ? `${a}${formatYear(c.born)}` : '?';
  const d = c.died !== undefined ? `${a}${formatYear(c.died)}` : '';
  return d ? `${b} – ${d}` : `Born ${b}`;
}

function statusText(c: Character, y: Year): string {
  const s = lifeStatus(c, y);
  const a = c.approxDates ? 'c. ' : '';
  if (s === 'unborn') return c.born !== undefined ? `Not yet born (born ${a}${formatYear(c.born)})` : 'Not yet born';
  if (s === 'dead') return c.died !== undefined ? `Dead (died ${a}${formatYear(c.died)})` : 'Dead';
  const age = ageAt(c, y);
  return age !== undefined ? `Alive, age ${c.approxDates ? '~' : ''}${age}` : 'Alive';
}

function statusShort(c: Character, y: Year): string {
  const s = lifeStatus(c, y);
  if (s === 'unborn') return 'not yet born';
  if (s === 'dead') return 'dead';
  const age = ageAt(c, y);
  return age !== undefined ? `age ${c.approxDates ? '~' : ''}${age}` : 'alive';
}

function dangerMeter(r: ArrakisRegion): HTMLElement {
  const d = r.danger ?? 3;
  const words = ['', 'Habitable', 'Harsh', 'Dangerous', 'Deadly', 'Lethal'];
  return h(
    'span',
    { class: 'danger', 'aria-label': `${d} of 5, ${words[d] ?? ''}` },
    h('span', { class: 'danger__bar', 'aria-hidden': 'true' }, ...[1, 2, 3, 4, 5].map((i) => h('i', { 'data-on': String(i <= d) }))),
    h('span', null, words[d] ?? ''),
  );
}
