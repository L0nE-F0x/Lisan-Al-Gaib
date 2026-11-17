/**
 * Builders for the details sheet: body, system, character and event views.
 * All text comes from data and is inserted with h() (never innerHTML).
 */
import { lore } from '../data/index.ts';
import { ageAt, controlAt, entryAt, formatYear, isAlive, lifeStatus, whereaboutsAt } from '../data/query.ts';
import type { BookId, Body, Character, Faction, LoreEvent, RelationType, StarSystem, Year } from '../data/types.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import type { SheetContent } from '../shared/sheet.ts';
import { dl, section } from '../shared/sheet.ts';
import * as W from './world.ts';

export interface DetailActions {
  body(id: string): void;
  system(id: string): void;
  character(id: string): void;
  event(id: string): void;
  setYear(y: Year): void;
  copyLink(): void;
  follow(id: string): void;
}

const yr = (y: Year, approx?: boolean) => `${approx ? 'c. ' : ''}${formatYear(y)}`;

function linkBtn(label: string | Node, onClick: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
  const b = h('button', { class: 'link-btn', type: 'button', ...extra }, label);
  b.addEventListener('click', onClick);
  return b;
}

export function factionChip(f: Faction, approx = false): HTMLElement {
  return h(
    'span',
    { class: 'chip u-chip', style: `--c:${f.color}` },
    h('span', { class: 'chip__dot', style: `color:${f.color}`, 'aria-hidden': 'true' }),
    f.name + (approx ? ' (approx.)' : ''),
  );
}

function sources(ids: BookId[]): HTMLElement | null {
  if (!ids.length) return null;
  return section(
    'Sources',
    h('p', { class: 'u-sources' }, ids.map((id) => W.bookById.get(id)?.title ?? id).join(' · ')),
  );
}

function bodyEyebrow(b: Body, year: Year): string {
  const sys = W.systemById.get(b.system);
  if (b.kind === 'moon') {
    const p = b.parent ? W.bodyById.get(b.parent) : undefined;
    return p ? `Moon of ${W.bodyName(p, year)}` : 'Moon';
  }
  const kind = b.kind === 'station' ? 'Station' : 'World';
  const ord = b.ordinal && W.ROMAN[b.ordinal] ? ` ${W.ROMAN[b.ordinal]}` : '';
  return sys ? `${kind} · ${W.starLabel(sys)}${ord}` : kind;
}

function charLine(c: Character, year: Year, a: DetailActions, extra?: string): HTMLElement {
  const age = ageAt(c, year);
  const st = lifeStatus(c, year);
  const status = st === 'alive' ? (age !== undefined ? `age ${age}` : 'alive') : st === 'unborn' ? 'not yet born' : 'dead';
  return h(
    'li',
    { class: 'u-row' },
    linkBtn(c.name, () => a.character(c.id)),
    h('span', { class: 'muted u-row__meta' }, [extra, status].filter(Boolean).join(' · ')),
  );
}

function eventLine(e: LoreEvent, year: Year, a: DetailActions, showPlace = false): HTMLElement {
  const here = Math.abs(e.year - year) < 0.05;
  const place = showPlace && e.body ? W.bodyById.get(e.body) : undefined;
  return h(
    'li',
    { class: 'u-row u-event-row', 'data-current': String(here) },
    linkBtn(h('span', { class: 'mono u-yearpill' }, yr(e.year, e.approx)), () => a.setYear(e.year), {
      'aria-label': `Go to ${formatYear(e.year)}`,
      title: 'Set the timeline to this year',
    }),
    linkBtn(e.title, () => a.event(e.id)),
    place ? h('span', { class: 'muted u-row__meta' }, W.bodyName(place, e.year)) : null,
  );
}

function copyBtn(a: DetailActions): HTMLButtonElement {
  const b = h('button', { class: 'btn', type: 'button' }, icon(ICONS.share, { size: 16 }), 'Copy link');
  b.addEventListener('click', () => a.copyLink());
  return b;
}

function focusBtn(id: string, a: DetailActions, label = 'Centre'): HTMLButtonElement {
  const b = h('button', { class: 'btn', type: 'button' }, icon(ICONS.target, { size: 16 }), label);
  b.addEventListener('click', () => a.follow(id));
  return b;
}

// ---------------------------------------------------------------------------

export function bodyView(b: Body, year: Year, a: DetailActions): SheetContent {
  const sys = W.systemById.get(b.system);
  const exists = W.visibleAt(b, year);
  const { faction: f, entry } = W.controllerAt(b, year);
  const name = W.bodyName(b, year);

  const body = h('div', null);
  body.append(h('p', null, b.summary));

  if (!exists) {
    const span = b.exists;
    const when = span?.from !== undefined && year < span.from ? `appears from ${yr(span.from, span.approx)}` : span?.to !== undefined ? `gone after ${yr(span.to, span.approx)}` : 'not present';
    body.append(h('p', { class: 'u-note' }, `Not on the map in ${formatYear(year)}: ${when}.`));
  }

  // names over time
  const allNames = [{ from: -Infinity, name: b.name }, ...(b.names ?? [])];
  let namesNode: Node | null = null;
  if (allNames.length > 1) {
    namesNode = h(
      'span',
      null,
      allNames
        .map((n, i) => {
          const next = allNames[i + 1];
          if (i === 0) return `${n.name} (until ${formatYear(next.from)})`;
          return `${n.name} (from ${formatYear(n.from)})`;
        })
        .join(' · '),
    );
  }

  const parent = b.kind === 'moon' && b.parent ? W.bodyById.get(b.parent) : undefined;
  body.append(
    dl([
      ['System', sys ? linkBtn(sys.star, () => a.system(sys.id)) : null],
      ['Orbits', parent ? linkBtn(W.bodyName(parent, year), () => a.body(parent.id)) : null],
      ['Names', namesNode],
      [
        'Held by',
        b.control.length
          ? h('span', { class: 'u-held' }, entry ? factionChip(f, entry.approx) : h('span', { class: 'muted' }, 'Unrecorded in this year'), entry?.note ? h('span', { class: 'u-held__note muted' }, entry.note) : null)
          : null,
      ],
      ['Export', b.export ?? null],
    ]),
  );

  if (b.control.length > 1 || (b.control.length === 1 && b.control[0].note)) {
    const cur = controlAt(b.control, year);
    body.append(
      section(
        'Control history',
        h(
          'ol',
          { class: 'u-history' },
          b.control.map((c) => {
            const fc = W.faction(c.faction);
            return h(
              'li',
              { 'data-current': String(c === cur), style: `--c:${fc.color}` },
              linkBtn(h('span', { class: 'mono u-yearpill' }, yr(c.from, c.approx)), () => a.setYear(c.from + 0.001), {
                'aria-label': `Go to ${formatYear(c.from)}`,
                title: 'Set the timeline to this year',
              }),
              factionChip(fc),
              c.note ? h('span', { class: 'u-history__note muted' }, c.note) : null,
              c === cur ? h('span', { class: 'sr-only' }, '(current)') : null,
            );
          }),
        ),
      ),
    );
  }

  if (b.facts.length) body.append(section('Facts', h('ul', null, b.facts.map((t) => h('li', null, t)))));

  const present = lore.characters.filter((c) => whereaboutsAt(c, year)?.body === b.id);
  body.append(
    section(
      `Here in ${formatYear(year)}`,
      present.length
        ? h('ul', { class: 'u-list' }, present.map((c) => charLine(c, year, a)))
        : h('p', { class: 'muted' }, 'No recorded characters are here in this year.'),
    ),
  );

  const evs = W.eventsSorted.filter((e) => e.body === b.id);
  if (evs.length) body.append(section('Events here', h('ul', { class: 'u-list' }, evs.map((e) => eventLine(e, year, a)))));

  const moons = W.moonsByParent.get(b.id);
  if (moons?.length) body.append(section('Moons', h('ul', { class: 'u-list' }, moons.map((m) => h('li', { class: 'u-row' }, linkBtn(W.bodyName(m, year), () => a.body(m.id)))))));

  const s = sources(b.sources);
  if (s) body.append(s);

  const actions: Node[] = [];
  if (exists) actions.push(focusBtn(b.id, a));
  actions.push(copyBtn(a));
  if (b.id === 'arrakis') {
    actions.push(h('a', { class: 'btn', href: `/arrakis/?year=${Math.floor(year)}`, 'data-transition': 'Planetary uplink — Arrakis' }, icon(ICONS.globe, { size: 16 }), 'Open the Arrakis globe'));
  }

  return { eyebrow: bodyEyebrow(b, year), title: name, accent: entry ? f.color : undefined, body, actions };
}

export function systemView(s: StarSystem, year: Year, a: DetailActions): SheetContent {
  const body = h('div', null);
  if (s.summary) body.append(h('p', null, s.summary));
  const planets = W.planetsBySystem.get(s.id) ?? [];
  body.append(dl([['Star', s.star], ['Worlds', String(planets.length)]]));

  const rows = planets.map((b) => {
    const vis = W.visibleAt(b, year);
    const { faction: f, entry } = W.controllerAt(b, year);
    return h(
      'li',
      { class: 'u-row', 'data-dim': String(!vis) },
      linkBtn(W.bodyName(b, year), () => a.body(b.id)),
      vis ? (entry ? factionChip(f) : h('span', { class: 'muted u-row__meta' }, 'holder unrecorded')) : h('span', { class: 'muted u-row__meta' }, 'not present this year'),
    );
  });
  body.append(section('Worlds', rows.length ? h('ul', { class: 'u-list' }, rows) : h('p', { class: 'muted' }, 'No named worlds; the novels mention this star for other reasons.')));

  const ids = new Set(planets.map((b) => b.id));
  for (const p of planets) for (const m of W.moonsByParent.get(p.id) ?? []) ids.add(m.id);
  const evs = W.eventsSorted.filter((e) => e.body && ids.has(e.body));
  if (evs.length) body.append(section('Events in this system', h('ul', { class: 'u-list' }, evs.map((e) => eventLine(e, year, a, true)))));

  return {
    eyebrow: 'Star system',
    title: W.starLabel(s),
    accent: s.color,
    body,
    actions: [focusBtn(s.id, a), copyBtn(a)],
  };
}

const REL_LABEL: Record<RelationType, string> = {
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  spouse: 'Spouse',
  concubine: 'Concubine',
  mentor: 'Mentor',
  student: 'Student',
  ally: 'Ally',
  enemy: 'Enemy',
  servant: 'Served by',
  master: 'Serves',
  'ghola-of': 'Ghola of',
};

export function characterView(c: Character, year: Year, a: DetailActions): SheetContent {
  const body = h('div', null);
  body.append(h('p', null, c.summary));
  const st = lifeStatus(c, year);
  const age = ageAt(c, year);
  const allegiance = isAlive(c, year) ? controlAt(c.allegiance, year) : undefined;
  const where = whereaboutsAt(c, year);
  const whereBody = where ? W.bodyById.get(where.body) : undefined;
  const placeName = where?.place ? lore.arrakis.places.find((p) => p.id === where.place)?.name ?? lore.arrakis.regions.find((r) => r.id === where.place)?.name : undefined;

  let status: string;
  if (st === 'unborn') status = c.born !== undefined ? `Not yet born (born ${yr(c.born, c.approxDates)})` : 'Not yet born';
  else if (st === 'dead') status = c.died !== undefined ? `Dead (died ${yr(c.died, c.approxDates)})` : 'Dead';
  else status = age !== undefined ? `Alive · age ${age}${c.approxDates ? ' (approx.)' : ''}` : 'Alive';

  let whereNode: Node | null = null;
  if (whereBody) {
    whereNode = h(
      'span',
      { class: 'u-where' },
      linkBtn(W.bodyName(whereBody, year) + (placeName ? ` · ${placeName}` : ''), () => a.body(whereBody.id), { title: 'Fly there' }),
      where?.approx ? h('span', { class: 'muted' }, ' (approx.)') : null,
    );
  }

  body.append(
    dl([
      ['Also', c.aliases?.length ? c.aliases.join(' · ') : null],
      ['Born', c.born !== undefined ? yr(c.born, c.approxDates) : 'Unrecorded'],
      ['Died', c.died !== undefined ? yr(c.died, c.approxDates) : null],
      [`In ${formatYear(year)}`, status],
      ['Allegiance', allegiance ? factionChip(W.faction(allegiance.faction), allegiance.approx) : null],
      ['Where', whereNode ?? (st === 'alive' ? h('span', { class: 'muted' }, 'Whereabouts unrecorded') : null)],
    ]),
  );

  if (where?.body === 'arrakis' && where.place) {
    body.append(
      h(
        'p',
        null,
        h('a', { class: 'btn', href: `/arrakis/?year=${Math.floor(year)}&place=${encodeURIComponent(where.place)}`, 'data-transition': 'Planetary uplink — Arrakis' }, icon(ICONS.globe, { size: 16 }), `See ${placeName ?? 'this place'} on the Arrakis globe`),
      ),
    );
  }

  if (c.ghola || c.relations.some((r) => r.type === 'ghola-of')) {
    body.append(
      h(
        'p',
        { class: 'u-note' },
        c.note && c.ghola
          ? c.note
          : 'A ghola is a person regrown by the Tleilaxu from the cells of the dead, so the same person can appear more than once across the centuries. Each incarnation is listed separately.',
      ),
    );
  } else if (c.note) {
    body.append(h('p', { class: 'u-note' }, c.note));
  }

  // whereabouts history
  if (c.whereabouts.length > 1) {
    const curW = entryAt(c.whereabouts, year);
    body.append(
      section(
        'Travels',
        h(
          'ol',
          { class: 'u-history' },
          c.whereabouts.map((w) => {
            const wb = W.bodyById.get(w.body);
            return h(
              'li',
              { 'data-current': String(w === curW && st === 'alive') },
              linkBtn(h('span', { class: 'mono u-yearpill' }, yr(w.from, w.approx)), () => a.setYear(w.from + 0.001), { 'aria-label': `Go to ${formatYear(w.from)}` }),
              wb ? linkBtn(W.bodyName(wb, w.from), () => a.body(wb.id)) : h('span', null, w.body),
            );
          }),
        ),
      ),
    );
  }

  if (c.relations.length) {
    const groups = new Map<RelationType, Character[]>();
    for (const r of c.relations) {
      const o = W.characterById.get(r.id);
      if (!o) continue;
      const list = groups.get(r.type) ?? [];
      list.push(o);
      groups.set(r.type, list);
    }
    // reverse ghola links: other incarnations of this person
    const incarnations = lore.characters.filter((o) => o.id !== c.id && o.relations.some((r) => r.type === 'ghola-of' && r.id === c.id));
    const ul = h('ul', { class: 'u-list' });
    for (const [type, list] of groups) {
      ul.append(h('li', { class: 'u-rel' }, h('span', { class: 'eyebrow u-rel__type' }, REL_LABEL[type] ?? type), h('span', { class: 'u-rel__people' }, list.map((o) => linkBtn(o.name, () => a.character(o.id))))));
    }
    if (incarnations.length) {
      ul.append(h('li', { class: 'u-rel' }, h('span', { class: 'eyebrow u-rel__type' }, 'Later gholas'), h('span', { class: 'u-rel__people' }, incarnations.map((o) => linkBtn(o.name, () => a.character(o.id))))));
    }
    body.append(section('Relations', ul));
  }

  const evs = W.eventsSorted.filter((e) => e.characters?.includes(c.id));
  if (evs.length) body.append(section('Events', h('ul', { class: 'u-list' }, evs.map((e) => eventLine(e, year, a, true)))));

  const s = sources(c.sources);
  if (s) body.append(s);

  const actions: Node[] = [];
  if (whereBody && W.visibleAt(whereBody, year)) actions.push(focusBtn(whereBody.id, a, 'Fly to'));
  actions.push(copyBtn(a));

  const accent = allegiance ? W.faction(allegiance.faction).color : undefined;
  return { eyebrow: c.ghola ? 'Character · Ghola' : 'Character', title: c.name, accent, body, actions };
}

const KIND_LABEL: Record<string, string> = {
  war: 'War',
  political: 'Politics',
  religious: 'Religion',
  ecological: 'Ecology',
  death: 'Death',
  birth: 'Birth',
  discovery: 'Discovery',
  founding: 'Founding',
};

export function eventView(e: LoreEvent, _year: Year, a: DetailActions): SheetContent {
  const body = h('div', null);
  body.append(h('p', null, e.summary));
  const where = e.body ? W.bodyById.get(e.body) : undefined;
  const place = e.place ? lore.arrakis.places.find((p) => p.id === e.place) ?? lore.arrakis.regions.find((r) => r.id === e.place) : undefined;
  body.append(
    dl([
      ['Year', linkBtn(yr(e.year, e.approx), () => a.setYear(e.year), { title: 'Set the timeline to this year' })],
      ['Where', where ? linkBtn(W.bodyName(where, e.year) + (place ? ` · ${place.name}` : ''), () => a.body(where.id), { title: 'Fly there' }) : null],
      ['Kind', KIND_LABEL[e.kind] ?? e.kind],
      ['Book', e.book ? W.bookById.get(e.book)?.title ?? e.book : null],
    ]),
  );
  if (where?.id === 'arrakis') {
    const href = `/arrakis/?year=${Math.floor(e.year)}${e.place ? `&place=${encodeURIComponent(e.place)}` : ''}`;
    body.append(h('p', null, h('a', { class: 'btn', href, 'data-transition': 'Planetary uplink — Arrakis' }, icon(ICONS.globe, { size: 16 }), 'See it on the Arrakis globe')));
  }
  const chars = (e.characters ?? []).map((id) => W.characterById.get(id)).filter((c): c is Character => !!c);
  if (chars.length) body.append(section('People', h('ul', { class: 'u-list' }, chars.map((c) => charLine(c, e.year, a)))));
  if (e.approx) body.append(h('p', { class: 'u-note' }, 'The novels do not date this exactly; the year shown is approximate.'));

  const actions: Node[] = [];
  if (where) actions.push(focusBtn(where.id, a, 'Fly to'));
  actions.push(copyBtn(a));
  return { eyebrow: `Event · ${KIND_LABEL[e.kind] ?? e.kind}`, title: e.title, body, actions };
}
