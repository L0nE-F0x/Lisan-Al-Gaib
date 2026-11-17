/**
 * Known Universe page: galaxy canvas + timeline + details sheet + search + layers + era guide.
 */
import '../shared/styles/index.css';
import './universe.css';

import { lore } from '../data/index.ts';
import { ageAt, eraAt, eventsCrossed, formatYear, isAlive, lifeStatus, whereaboutsAt } from '../data/query.ts';
import type { Body, LoreEvent, Year } from '../data/types.ts';
import { audio } from '../shared/audio.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import { attachGestures } from '../shared/gestures.ts';
import { onFrame } from '../shared/loop.ts';
import { Palette, type PaletteItem } from '../shared/palette.ts';
import { deviceTier, onReducedMotionChange, reducedMotion } from '../shared/prefs.ts';
import { Sheet, type SheetContent } from '../shared/sheet.ts';
import { mountShell, toast } from '../shared/shell.ts';
import { Timeline } from '../shared/timeline.ts';
import { readNumber, readString, shareUrl, writeParams } from '../shared/url-state.ts';
import { Camera } from './camera.ts';
import { bodyView, characterView, eventView, systemView, type DetailActions } from './details.ts';
import { Banner, closeAllPopovers, EraGuide, intro, Legend, ListView, Popover, layersBody } from './panels.ts';
import { FONTS_TO_LOAD, Renderer, type FrameState, type Hit, type Layers } from './renderer.ts';
import * as W from './world.ts';

W.devReportIssues();

const shell = mountShell({ page: 'universe', bed: 'cosmos' });
const main = document.getElementById('main') ?? document.body.appendChild(h('main', { id: 'main' }));
main.classList.add('u-main');

const coarse = window.matchMedia('(pointer: coarse)').matches;
let reduced = reducedMotion();
onReducedMotionChange((r) => (reduced = r));

// ---------------------------------------------------------------------------
// Initial state from the URL (validated)
// ---------------------------------------------------------------------------

const [Y0, Y1] = lore.range;
const urlYear = readNumber('year');
const startYear = urlYear !== undefined && urlYear >= Y0 && urlYear <= Y1 ? urlYear : lore.defaultYear;
const urlFocus = readString('focus');
const urlChar = readString('char');
const focusId = urlFocus && (W.bodyById.has(urlFocus) || W.systemById.has(urlFocus)) ? urlFocus : undefined;
const charId = urlChar && W.characterById.has(urlChar) ? urlChar : undefined;

let year: Year = startYear;
let prevYear: Year = startYear;
const layers: Layers = { territories: true, orbits: true, labels: true, moons: true };

type Selection = { kind: 'body' | 'system' | 'character' | 'event'; id: string } | null;
let sel: Selection = null;
let hover: string | null = null;
let reticle = false;
let dirty = true;
let lastDt = 1 / 60;
let clock = 0;
const pulses: { id: string; age: number }[] = [];
let eventFly: { until: number } | null = null;
let lastEventFly = -Infinity;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const canvas = h('canvas', {
  class: 'u-canvas',
  tabindex: '0',
  role: 'application',
  'aria-roledescription': 'star map',
  'aria-label': 'Star map of the Known Universe',
  'aria-describedby': 'u-canvas-help',
});
const help = h(
  'p',
  { id: 'u-canvas-help', class: 'sr-only' },
  'Arrow keys pan, plus and minus zoom, Enter selects the world under the centre reticle, Space plays or pauses the timeline. ' +
    'For a text version of the map use the List view in the Layers panel, or search with Control K.',
);
const live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
main.append(canvas, help, live);

const renderer = new Renderer(canvas);
const cam = new Camera(W.bounds);

const sheet = new Sheet({ label: 'Details' });
document.body.append(sheet.el);

const tl = new Timeline({
  range: lore.range,
  year: startYear,
  eras: lore.eras,
  events: W.eventsSorted.map((e) => ({ id: e.id, year: e.year, title: e.title })),
  speeds: [
    { label: '1 yr/s', yps: 1 },
    { label: '10 yr/s', yps: 10 },
    { label: '100 yr/s', yps: 100 },
    { label: '500 yr/s', yps: 500 },
  ],
  speedIndex: 0,
});
const dock = h('div', { class: 'u-dock' }, tl.el);

const banner = new Banner((e) => openEvent(e.id));

// header tools
const searchBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Search the archives', title: 'Search (Ctrl+K or /)', 'aria-keyshortcuts': 'Control+K /' }, icon(ICONS.search));
shell.tools.prepend(searchBtn);

// map controls
const ctlBtn = (label: string, paths: readonly string[] | string, onClick: () => void) => {
  const b = h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label }, icon(paths));
  b.addEventListener('click', onClick);
  return b;
};
const zoomIn = ctlBtn('Zoom in', ICONS.plus, () => zoomBy(1.6));
zoomIn.classList.add('u-zoom');
const zoomOut = ctlBtn('Zoom out', ICONS.minus, () => zoomBy(1 / 1.6));
zoomOut.classList.add('u-zoom');
const fitBtn = ctlBtn('Show the whole map', ICONS.map, () => showAll());
const layersBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Layers and legend', title: 'Layers and legend' }, icon(ICONS.layers));
const controls = h('div', { class: 'u-controls', role: 'toolbar', 'aria-label': 'Map controls', 'aria-orientation': 'vertical' }, zoomIn, zoomOut, fitBtn, layersBtn);

const BOOK_ICON = ['M4 5h5a3 3 0 0 1 3 3v11a2.5 2.5 0 0 0-2.5-2.5H4z', 'M20 5h-5a3 3 0 0 0-3 3v11a2.5 2.5 0 0 1 2.5-2.5H20z'];
const erasBtn = h('button', { class: 'btn u-eras-btn', type: 'button' }, icon(BOOK_ICON, { size: 18 }), h('span', null, 'Novels & eras'));

const legendFloat = new Legend();
const legendInline = new Legend({ compact: true });
const listView = new ListView((kind, id) => (kind === 'body' ? selectBody(id) : selectSystem(id)));
const layersPop = new Popover({
  id: 'u-layers',
  label: 'Layers',
  button: layersBtn,
  className: 'u-pop--layers',
  body: layersBody(layers, () => (dirty = true), () => {
    layersPop.close(false);
    listView.open(year);
  }, legendInline),
});
const eraGuide = new EraGuide((y) => {
  setYear(y);
  audio.sfx('select');
  if (window.matchMedia('(max-width: 899.98px)').matches) erasPop.close(false);
});
const erasPop = new Popover({ id: 'u-eras', label: 'Novels & eras', button: erasBtn, className: 'u-pop--eras', body: eraGuide.el });

main.append(controls, erasBtn, legendFloat.el, banner.el);
document.body.append(dock, layersPop.el, erasPop.el);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let announceTimer: number | undefined;
function announce(text: string): void {
  if (announceTimer !== undefined) clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => (live.textContent = text), 120);
}

function viewMin(): number {
  return cam.viewMin;
}

function systemZoom(systemId: string): number {
  return (viewMin() * 0.36) / Math.max(40, W.systemRadius(systemId));
}

function bodyZoom(b: Body): number {
  if (b.kind === 'moon') return (viewMin() * 0.3) / W.orbitRadius(b);
  let z = (viewMin() * 0.32) / W.orbitRadius(b);
  const moons = W.moonsByParent.get(b.id);
  if (moons?.length) z = Math.max(z, 46 / W.orbitRadius(moons[0]));
  return z;
}

/** Angular speed of a body on screen while playing (rad / s). */
function spin(b: Body): number {
  return tl.playing ? (Math.PI * 2 * currentYps()) / W.periodYears(b) : 0;
}
let ypsEstimate = 0;
function currentYps(): number {
  return ypsEstimate;
}

const followFns = new Map<string, () => { x: number; y: number } | null>();
function followFn(id: string): () => { x: number; y: number } | null {
  let fn = followFns.get(id);
  if (!fn) {
    fn = () => {
      const sys = W.systemById.get(id);
      if (sys) return { x: sys.x, y: sys.y };
      const b = W.bodyById.get(id);
      if (!b) return null;
      const s = W.systemById.get(b.system);
      // Worlds that spin too fast at high playback speed: follow their star instead.
      if (!W.visibleAt(b, year) || spin(b.kind === 'moon' && b.parent ? W.bodyById.get(b.parent) ?? b : b) > 0.7) return s ? { x: s.x, y: s.y } : null;
      return W.positionAt(b, year);
    };
    followFns.set(id, fn);
  }
  return fn;
}

function flyToBody(b: Body, opts: { slow?: boolean; instant?: boolean } = {}): void {
  cam.flyTo(followFn(b.id), bodyZoom(b), { instant: opts.instant ?? reduced, slow: opts.slow });
}
function flyToSystem(id: string, opts: { slow?: boolean; instant?: boolean } = {}): void {
  cam.flyTo(followFn(id), systemZoom(id), { instant: opts.instant ?? reduced, slow: opts.slow });
}

function zoomBy(f: number): void {
  cam.zoomAt(f, cam.fx, cam.fy, reduced);
  dirty = true;
}

function showAll(): void {
  eventFly = null;
  cam.release();
  cam.flyTo({ x: (W.bounds.minX + W.bounds.maxX) / 2, y: (W.bounds.minY + W.bounds.maxY) / 2 }, cam.fitZoom(), { instant: reduced });
  dirty = true;
}

function setYear(y: Year): void {
  tl.setPlaying(false);
  tl.set(y, 'api');
}

function selectedMapId(): string | null {
  if (!sel) return null;
  if (sel.kind === 'body' || sel.kind === 'system') return sel.id;
  if (sel.kind === 'character') {
    const c = W.characterById.get(sel.id);
    const w = c ? whereaboutsAt(c, year) : undefined;
    return w?.body ?? null;
  }
  const e = W.eventById.get(sel.id);
  return e?.body ?? null;
}

// ---------------------------------------------------------------------------
// Selection + details sheet
// ---------------------------------------------------------------------------

const actions: DetailActions = {
  body: (id) => selectBody(id),
  system: (id) => selectSystem(id),
  character: (id) => selectCharacter(id),
  event: (id) => openEvent(id),
  setYear: (y) => setYear(y),
  copyLink: () => copyLink(),
  follow: (id) => {
    eventFly = null;
    const b = W.bodyById.get(id);
    if (b) flyToBody(b);
    else if (W.systemById.has(id)) flyToSystem(id);
    dirty = true;
  },
};

function sheetContent(): SheetContent | null {
  if (!sel) return null;
  switch (sel.kind) {
    case 'body': {
      const b = W.bodyById.get(sel.id);
      return b ? bodyView(b, year, actions) : null;
    }
    case 'system': {
      const s = W.systemById.get(sel.id);
      return s ? systemView(s, year, actions) : null;
    }
    case 'character': {
      const c = W.characterById.get(sel.id);
      return c ? characterView(c, year, actions) : null;
    }
    case 'event': {
      const e = W.eventById.get(sel.id);
      return e ? eventView(e, year, actions) : null;
    }
  }
}

let sheetKey = '';
function sheetKeyNow(): string {
  return sel ? `${sel.kind}:${sel.id}:${Math.floor(year * 10)}` : '';
}

function renderSheet(focus: boolean): void {
  const c = sheetContent();
  if (!c) return;
  sheetKey = sheetKeyNow();
  const bodyEl = sheet.el.querySelector<HTMLElement>('.sheet__body');
  const scroll = bodyEl?.scrollTop ?? 0;
  // keep keyboard focus position across refreshes
  const focusables = () => Array.from(sheet.el.querySelectorAll<HTMLElement>('button, a[href]'));
  const active = document.activeElement as HTMLElement | null;
  const idx = !focus && active && sheet.el.contains(active) ? focusables().indexOf(active) : -1;
  sheet.open(c, { focus });
  if (!focus && bodyEl) bodyEl.scrollTop = scroll;
  if (idx >= 0) focusables()[idx]?.focus({ preventScroll: true });
  document.body.dataset.sheet = 'open';
  requestAnimationFrame(updateInsets);
}

let lastSheetRefresh = 0;
function maybeRefreshSheet(force = false): void {
  if (!sheet.isOpen || !sel) return;
  const key = sheetKeyNow();
  if (key === sheetKey) return;
  const now = performance.now();
  if (!force && tl.playing && now - lastSheetRefresh < 350) return;
  lastSheetRefresh = now;
  renderSheet(false);
}

sheet.onClose(() => {
  sel = null;
  sheetKey = '';
  eventFly = null;
  cam.setFollow(null);
  document.body.dataset.sheet = 'closed';
  writeParams({ focus: null, char: null });
  dirty = true;
  requestAnimationFrame(updateInsets);
});

function selectBody(id: string, opts: { slow?: boolean; fly?: boolean } = {}): void {
  const b = W.bodyById.get(id);
  if (!b) return;
  sel = { kind: 'body', id };
  eventFly = null;
  renderSheet(true);
  if (opts.fly !== false && W.visibleAt(b, year)) flyToBody(b, { slow: opts.slow });
  writeParams({ focus: id, char: null });
  const { faction: f, entry } = W.controllerAt(b, year);
  announce(`${W.bodyName(b, year)} selected. ${entry ? `Held by ${f.name}` : 'Holder unrecorded'} in ${formatYear(year)}.`);
  audio.sfx('select');
  dirty = true;
}

function selectSystem(id: string, opts: { slow?: boolean } = {}): void {
  const s = W.systemById.get(id);
  if (!s) return;
  sel = { kind: 'system', id };
  eventFly = null;
  renderSheet(true);
  flyToSystem(id, { slow: opts.slow });
  writeParams({ focus: id, char: null });
  announce(`${s.star} system selected.`);
  audio.sfx('select');
  dirty = true;
}

function selectCharacter(id: string, opts: { slow?: boolean } = {}): void {
  const c = W.characterById.get(id);
  if (!c) return;
  sel = { kind: 'character', id };
  eventFly = null;
  renderSheet(true);
  const w = whereaboutsAt(c, year);
  const b = w ? W.bodyById.get(w.body) : undefined;
  if (b && W.visibleAt(b, year)) flyToBody(b, { slow: opts.slow });
  writeParams({ char: id, focus: b?.id ?? null });
  announce(`${c.name}. ${lifeStatus(c, year) === 'alive' ? (b ? `On ${W.bodyName(b, year)}` : 'Whereabouts unrecorded') : lifeStatus(c, year) === 'dead' ? 'Dead by this year' : 'Not yet born'}.`);
  audio.sfx('select');
  dirty = true;
}

function openEvent(id: string, opts: { setYear?: boolean } = {}): void {
  const e = W.eventById.get(id);
  if (!e) return;
  if (opts.setYear) setYear(e.year);
  sel = { kind: 'event', id };
  eventFly = null;
  renderSheet(true);
  const b = e.body ? W.bodyById.get(e.body) : undefined;
  if (b && W.visibleAt(b, year)) flyToBody(b);
  writeParams({ focus: b?.id ?? null, char: null });
  dirty = true;
}

async function copyLink(): Promise<void> {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied to the clipboard.');
  } catch {
    toast(h('span', null, 'Copy this link: ', h('span', { class: 'mono u-break' }, url)), 9000);
  }
}

// ---------------------------------------------------------------------------
// Timeline + events
// ---------------------------------------------------------------------------

let eraId = '';
function applyEra(): void {
  const era = eraAt(lore.eras, year);
  if (era.id === eraId) return;
  eraId = era.id;
  document.documentElement.style.setProperty('--era', era.color);
}

let pending: LoreEvent[] = [];
let flushTimer: number | undefined;
let pendingFast = false;

function queueEvents(evs: LoreEvent[], fast: boolean): void {
  pending.push(...evs);
  pendingFast = pendingFast || fast;
  if (flushTimer === undefined) flushTimer = window.setTimeout(flushEvents, fast ? 400 : 60);
}

function flushEvents(): void {
  flushTimer = undefined;
  const evs = pending.slice(-5);
  const fast = pendingFast;
  pending = [];
  pendingFast = false;
  if (!evs.length) return;
  banner.show(evs, fast);
  audio.sfx('event');
  for (const e of evs) if (e.body && W.bodyById.has(e.body)) pulses.push({ id: e.body, age: 0 });
  const target = [...evs].reverse().find((e) => e.body && W.bodyById.has(e.body) && W.visibleAt(W.bodyById.get(e.body)!, year));
  const gap = fast ? 4.5 : 1.6;
  if (target && !reduced && clock - lastEventFly > gap) {
    lastEventFly = clock;
    const b = W.bodyById.get(target.body!)!;
    const sysZ = systemZoom(b.system);
    cam.flyTo(followFn(b.id), Math.max(Math.min(cam.tz, sysZ * 1.6), sysZ * 0.8));
    eventFly = { until: clock + (fast ? 3 : 3.6) };
  }
  dirty = true;
}

function endEventFly(): void {
  eventFly = null;
  const id = selectedMapId();
  const b = id ? W.bodyById.get(id) : undefined;
  if (b && W.visibleAt(b, year)) cam.setFollow(followFn(b.id));
  else if (id && W.systemById.has(id)) cam.setFollow(followFn(id));
}

tl.onChange((y, source) => {
  const dy = y - year;
  year = y;
  if (source === 'play') {
    ypsEstimate = Math.abs(dy) / Math.max(lastDt, 1 / 240);
    const crossed = eventsCrossed(W.eventsSorted, prevYear, y);
    if (crossed.length) queueEvents(crossed, ypsEstimate > 40);
  } else if (source === 'step') {
    const here = W.eventsSorted.filter((e) => Math.abs(e.year - y) < 1e-6);
    if (here.length) queueEvents(here, false);
  }
  prevYear = y;
  applyEra();
  legendFloat.update(y);
  legendInline.update(y);
  eraGuide.update(y);
  listRefreshDue = true;
  maybeRefreshSheet();
  writeParams({ year: Math.round(y * 10) / 10 });
  dirty = true;
});
tl.onPlayChange((p) => {
  prevYear = year;
  if (!p) {
    ypsEstimate = 0;
    maybeRefreshSheet(true);
  }
});

let listRefreshDue = false;
let lastListRefresh = 0;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const palette = new Palette({ placeholder: 'Search worlds, stars, people, events…', label: 'Search the archives' });
palette.setItems(() => {
  const items: PaletteItem[] = [];
  for (const b of lore.bodies) {
    const { faction: f, entry } = W.controllerAt(b, year);
    const sys = W.systemById.get(b.system);
    items.push({
      id: `body:${b.id}`,
      label: W.bodyName(b, year),
      sub: [b.kind === 'moon' ? 'Moon' : sys ? W.starLabel(sys) : '', W.visibleAt(b, year) ? (entry ? f.name : '') : 'not present'].filter(Boolean).join(' · '),
      group: 'Worlds',
      color: entry ? f.color : undefined,
      keywords: [b.name, ...(b.names ?? []).map((n) => n.name), sys?.star ?? '', b.export ?? ''].filter(Boolean),
      dim: !W.visibleAt(b, year),
    });
  }
  for (const s of lore.systems) {
    items.push({
      id: `system:${s.id}`,
      label: W.starLabel(s),
      sub: (W.planetsBySystem.get(s.id) ?? []).map((b) => W.bodyName(b, year)).join(' · ') || 'Star system',
      group: 'Star systems',
      color: s.color,
      keywords: [s.star],
    });
  }
  for (const c of lore.characters) {
    const alive = isAlive(c, year);
    const age = ageAt(c, year);
    const st = lifeStatus(c, year);
    items.push({
      id: `char:${c.id}`,
      label: c.name,
      sub: st === 'alive' ? (age !== undefined ? `age ${age}` : 'alive') : st === 'dead' ? 'dead by this year' : 'not yet born',
      group: 'People',
      color: alive ? '#ece0c8' : '#6e5c45',
      keywords: c.aliases ?? [],
      dim: !alive,
    });
  }
  for (const e of W.eventsSorted) {
    items.push({ id: `event:${e.id}`, label: e.title, sub: formatYear(e.year), group: 'Events', color: eraAt(lore.eras, e.year).color, keywords: [e.kind] });
  }
  return items;
});
palette.onSelect((item) => {
  const [kind, id] = [item.id.slice(0, item.id.indexOf(':')), item.id.slice(item.id.indexOf(':') + 1)];
  if (kind === 'body') selectBody(id);
  else if (kind === 'system') selectSystem(id);
  else if (kind === 'char') selectCharacter(id);
  else if (kind === 'event') openEvent(id, { setYear: true });
});
palette.bindShortcut();
searchBtn.addEventListener('click', () => palette.open());

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function pick(x: number, y: number): Hit | null {
  let best: Hit | null = null;
  let bestScore = Infinity;
  for (const hit of renderer.lastHits) {
    const d = Math.hypot(hit.x - x, hit.y - y);
    if (d > hit.r) continue;
    const score = d / hit.r + (hit.kind === 'system' ? 0.35 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = hit;
    }
  }
  return best;
}

function activate(hit: Hit): void {
  if (hit.kind === 'system') selectSystem(hit.id);
  else selectBody(hit.id);
}

// Keys handled before the shared gesture handler: smooth arrow panning and Space = play.
canvas.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 160 : 60;
  const pan: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (pan[e.key]) {
    e.preventDefault();
    e.stopImmediatePropagation();
    eventFly = null;
    cam.nudge(pan[e.key][0], pan[e.key][1], reduced);
    dirty = true;
  } else if (e.key === ' ') {
    e.preventDefault();
    e.stopImmediatePropagation();
    tl.setPlaying(!tl.playing);
  }
});

attachGestures(canvas, {
  onPan: (dx, dy) => {
    cam.dragBy(dx, dy);
    dirty = true;
  },
  onZoom: (f, x, y) => {
    cam.zoomAt(f, x, y, reduced);
    dirty = true;
  },
  onTap: (x, y) => {
    const hit = pick(x, y);
    if (hit) activate(hit);
    else if (sheet.isOpen) sheet.close();
  },
  onDoubleTap: (x, y) => {
    cam.zoomAt(2.2, x, y, reduced);
    dirty = true;
  },
  onHover: (x, y) => {
    const hit = pick(x, y);
    const id = hit?.id ?? null;
    if (id !== hover) {
      hover = id;
      canvas.style.cursor = id ? 'pointer' : '';
      dirty = true;
    }
  },
  onHoverEnd: () => {
    if (hover) {
      hover = null;
      canvas.style.cursor = '';
      dirty = true;
    }
  },
  onDragStart: () => {
    eventFly = null;
    canvas.dataset.dragging = 'true';
  },
  onDragEnd: () => {
    canvas.dataset.dragging = 'false';
  },
  onActivate: () => {
    let best: Hit | null = null;
    let bd = 48;
    for (const hit of renderer.lastHits) {
      const d = Math.hypot(hit.x - cam.fx, hit.y - cam.fy) - (hit.kind === 'body' ? 8 : 0);
      if (d < bd) {
        bd = d;
        best = hit;
      }
    }
    if (best) activate(best);
    else announce('Nothing under the reticle. Pan with the arrow keys, or use search.');
  },
});

canvas.addEventListener('focus', () => {
  reticle = canvas.matches(':focus-visible');
  dirty = true;
});
canvas.addEventListener('blur', () => {
  reticle = false;
  dirty = true;
});

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  const typing = !!t.closest('input, textarea, select, [contenteditable]');
  if (e.key === 'Escape') {
    if (closeAllPopovers(true)) return;
    if (sheet.isOpen && !sheet.el.contains(t) && !t.closest('dialog')) sheet.close();
    return;
  }
  if (typing || t.closest('dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && !t.closest('button, a, [role="switch"]') && t !== canvas) {
    e.preventDefault();
    tl.setPlaying(!tl.playing);
  } else if (e.key === ']') tl.stepEvent(1);
  else if (e.key === '[') tl.stepEvent(-1);
});

// ---------------------------------------------------------------------------
// Layout: size, DPR, insets
// ---------------------------------------------------------------------------

const dprCap = deviceTier() === 'low' ? 1.25 : 2;
function resize(): void {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(dprCap, Math.max(1, window.devicePixelRatio || 1));
  renderer.resize(r.width, r.height, dpr);
  cam.resize(r.width, r.height);
  updateInsets();
  dirty = true;
}

let dprQuery: MediaQueryList | null = null;
function watchDpr(): void {
  dprQuery?.removeEventListener('change', onDprChange);
  dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  dprQuery.addEventListener('change', onDprChange);
}
function onDprChange(): void {
  resize();
  watchDpr();
}

function updateInsets(): void {
  const header = shell.header.offsetHeight || 60;
  const dockH = dock.offsetHeight + 12;
  document.documentElement.style.setProperty('--sheet-bottom', `${dockH}px`);
  let right = 0;
  let bottom = dockH;
  if (sheet.isOpen) {
    if (window.innerWidth >= 900) right = sheet.el.offsetWidth + 12;
    else bottom = dockH + sheet.el.offsetHeight;
  }
  cam.setInsets(header, right, bottom, 0, false);
  dirty = true;
}

new ResizeObserver(() => resize()).observe(canvas);
const insetObserver = new ResizeObserver(() => updateInsets());
insetObserver.observe(dock);
insetObserver.observe(sheet.el);
watchDpr();

if (document.fonts) {
  Promise.all(FONTS_TO_LOAD.map((f) => document.fonts.load(f).catch(() => [])))
    .then(() => {
      renderer.fontsChanged();
      dirty = true;
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

const frame: FrameState = {
  year,
  time: 0,
  layers,
  selected: null,
  hover: null,
  pulses,
  reticle: false,
  eraColor: eraAt(lore.eras, year).color,
  coarse,
  animate: true,
};

onFrame((dt) => {
  lastDt = dt;
  clock += dt;
  tl.tick(dt);
  const moving = cam.update(dt);

  for (let i = pulses.length - 1; i >= 0; i--) {
    pulses[i].age += dt;
    if (pulses[i].age > 2.6) pulses.splice(i, 1);
  }
  if (eventFly && clock > eventFly.until) endEventFly();

  if (listRefreshDue && performance.now() - lastListRefresh > 400) {
    listRefreshDue = false;
    lastListRefresh = performance.now();
    listView.update(year);
  }

  frame.selected = selectedMapId();
  const animSel = frame.selected !== null && !reduced;
  if (!(dirty || moving || pulses.length || animSel || tl.playing)) return;
  dirty = false;
  frame.year = year;
  frame.time = clock;
  frame.hover = hover;
  frame.reticle = reticle;
  frame.eraColor = eraAt(lore.eras, year).color;
  frame.animate = !reduced;
  renderer.draw(cam, frame);
});

// ---------------------------------------------------------------------------
// Boot: intro + deep links
// ---------------------------------------------------------------------------

applyEra();
legendFloat.update(year);
legendInline.update(year);
eraGuide.update(year);
document.body.dataset.sheet = 'closed';
resize();

const canopus = W.systemById.get('canopus') ?? lore.systems[0];
const era0 = eraAt(lore.eras, year);
main.append(intro(`${formatYear(year)} · ${era0.name}`));

// Start wide, then ease in (instant with reduced motion).
cam.flyTo({ x: canopus?.x ?? 0, y: canopus?.y ?? 0 }, cam.minZ, { instant: true });

const deepChar = charId ? W.characterById.get(charId) : undefined;
if (deepChar) {
  selectCharacter(deepChar.id, { slow: true });
} else if (focusId && W.bodyById.has(focusId)) {
  selectBody(focusId, { slow: true });
} else if (focusId && W.systemById.has(focusId)) {
  selectSystem(focusId, { slow: true });
} else {
  cam.flyTo({ x: canopus?.x ?? 0, y: canopus?.y ?? 0 }, viewMin() / 620, { slow: true, instant: reduced });
}
if (sel) {
  // Deep links open the sheet without stealing focus from the page start.
  (document.activeElement as HTMLElement | null)?.blur?.();
}

if (import.meta.env.DEV) (window as unknown as { __universe: unknown }).__universe = { renderer, cam, frame, tl };
