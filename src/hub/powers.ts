/**
 * Powers of the Imperium: faction cards from the lore with original sigils.
 * Tilt only on fine pointers with hover, and never under reduced motion.
 */
import { lore } from '../data/index.ts';
import type { Faction, FactionKind } from '../data/types.ts';
import { clamp, h, icon, ICONS } from '../shared/dom.ts';
import { reducedMotion } from '../shared/prefs.ts';
import { FACTION_SIGIL, sigil } from './sigils.ts';

/** Which factions to show, in order. Missing ids are skipped gracefully. */
const ORDER = ['corrino', 'atreides', 'harkonnen', 'fremen', 'bene-gesserit', 'spacing-guild', 'bene-tleilax', 'ixians'];

/** Seat world (Body id) and a readable fallback when the body is not in the data. */
const SEAT: Record<string, { body?: string; label: string }> = {
  corrino: { body: 'kaitain', label: 'Kaitain' },
  atreides: { body: 'caladan', label: 'Caladan' },
  harkonnen: { body: 'giedi-prime', label: 'Giedi Prime' },
  fremen: { body: 'arrakis', label: 'Arrakis, the deep desert' },
  'bene-gesserit': { body: 'wallach-ix', label: 'Wallach IX' },
  'spacing-guild': { body: 'junction', label: 'Junction' },
  'bene-tleilax': { body: 'tleilax', label: 'Tleilax' },
  ixians: { body: 'ix', label: 'Ix' },
};

const KIND: Record<FactionKind, string> = {
  imperial: 'Imperial House',
  'great-house': 'Great House',
  'minor-house': 'Minor House',
  order: 'Order',
  guild: 'Monopoly',
  people: 'People',
  religion: 'Priesthood',
  commerce: 'Commerce',
};

export function initPowers(mount: HTMLElement): void {
  const byId = new Map(lore.factions.map((f) => [f.id, f]));
  const chosen = ORDER.map((id) => byId.get(id)).filter((f): f is Faction => !!f && f.id !== 'unaligned');
  if (!chosen.length) return;

  const list = h('ul', { class: 'powers__grid', role: 'list' });
  chosen.forEach((f, i) => list.appendChild(card(f, i)));
  mount.replaceChildren(list);

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (fine.matches) list.querySelectorAll<HTMLElement>('.power').forEach(tilt);
}

function card(f: Faction, i: number): HTMLElement {
  const seat = SEAT[f.id];
  const body = seat?.body ? lore.bodies.find((b) => b.id === seat.body) : undefined;
  const seatName = body?.name ?? seat?.label;
  const mark = sigil(FACTION_SIGIL[f.id] ?? f.sigil ?? '', { size: 72 });
  const titleId = `power-${f.id}`;
  const href = seat?.body && body ? `/universe/?year=10191&focus=${encodeURIComponent(seat.body)}` : `/universe/?year=10191`;

  return h(
    'li',
    { class: 'power reveal', style: `--accent:${f.color};--i:${i}` },
    h(
      'article',
      { class: 'power__inner', 'aria-labelledby': titleId },
      h('div', { class: 'power__sigil' }, mark ?? h('span', { class: 'power__initial display', 'aria-hidden': 'true' }, f.name.replace(/^(House|The)\s+/, '').charAt(0))),
      h('p', { class: 'power__kind eyebrow' }, KIND[f.kind] ?? f.kind),
      h('h3', { class: 'power__name display', id: titleId }, f.name),
      seatName ? h('p', { class: 'power__seat' }, h('span', { class: 'power__seat-label' }, 'Seat'), ' ', seatName) : null,
      h('p', { class: 'power__summary' }, f.summary),
      h(
        'a',
        { class: 'power__link', href, 'aria-label': `Find ${f.name}${seatName ? ` on ${seatName}` : ''} in the Known Universe atlas` },
        'On the map',
        icon(ICONS.arrowRight, { size: 16 }),
      ),
    ),
  );
}

/** Subtle pointer tilt, rAF-batched (one layout read per frame); resets on leave. */
function tilt(el: HTMLElement): void {
  const inner = el.querySelector<HTMLElement>('.power__inner')!;
  let px = 0;
  let py = 0;
  let raf = 0;
  const apply = () => {
    raf = 0;
    if (reducedMotion()) return;
    const rect = el.getBoundingClientRect(); // the <li> is never transformed
    const x = clamp((px - rect.left) / rect.width, 0, 1) - 0.5;
    const y = clamp((py - rect.top) / rect.height, 0, 1) - 0.5;
    inner.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg)`;
    inner.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    inner.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    px = e.clientX;
    py = e.clientY;
    el.dataset.hover = 'true';
    if (!raf) raf = requestAnimationFrame(apply);
  });
  el.addEventListener('pointerleave', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    el.dataset.hover = 'false';
    inner.style.transform = '';
  });
}
