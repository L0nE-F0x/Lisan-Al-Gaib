/**
 * Arrakis atlas: full-viewport procedural globe ⇄ flat map, year-aware places and people,
 * cinematic timeline, search, layers, list view and shareable URLs.
 */
import '../shared/styles/index.css';
import './atlas.css';

import { lore } from '../data/index.ts';
import { ageAt, eventsCrossed, formatYear, whereaboutsAt } from '../data/query.ts';
import type { LoreEvent, Year } from '../data/types.ts';
import { audio } from '../shared/audio.ts';
import { clamp, damp, h, icon, ICONS } from '../shared/dom.ts';
import { attachGestures } from '../shared/gestures.ts';
import { ArrakisGlobe } from '../shared/globe/globe.ts';
import { onFrame } from '../shared/loop.ts';
import { Palette, type PaletteItem } from '../shared/palette.ts';
import { deviceTier, onReducedMotionChange, reducedMotion } from '../shared/prefs.ts';
import { mountShell, toast } from '../shared/shell.ts';
import { Timeline } from '../shared/timeline.ts';
import { readNumber, readString, shareUrl, writeParams } from '../shared/url-state.ts';
import { EventBanner } from './banner.ts';
import { CameraController, type ViewMode } from './camera.ts';
import { Details, type Selection } from './details.ts';
import { LayersMenu, PlaceList, loadLayers, type LayerState } from './layers.ts';
import { MarkerLayer } from './markers.ts';
import {
  KIND_LABEL,
  arrakisEvents,
  character,
  charactersOnArrakis,
  eraColor,
  factionColor,
  greeningAt,
  place as placeById,
  placeAt,
  placeController,
  placeName,
  planetName,
  region as regionById,
  sareerPoint,
  scorchedAt,
  stormsAt,
} from './world.ts';

// ---------------------------------------------------------------------------
// Initial state from the URL (validated)

const placeIds = new Set(lore.arrakis.places.map((p) => p.id));
const urlYear = readNumber('year');
let year: Year = clamp(urlYear ?? lore.defaultYear, lore.range[0], lore.range[1]);
const urlPlace = readString('place');
const initialPlace = urlPlace && placeIds.has(urlPlace) ? urlPlace : undefined;
const initialView = (readString('view', ['globe', 'map']) as ViewMode | undefined) ?? 'globe';

// ---------------------------------------------------------------------------
// Shell + skeleton

const shell = mountShell({ page: 'arrakis', bed: 'desert' });
const main = document.getElementById('main') ?? document.body.appendChild(h('main', { id: 'main' }));
main.classList.add('atlas');
main.tabIndex = -1;

const webgl = hasWebGL();
const canvas = h('canvas', {
  class: 'atlas__canvas',
  tabindex: '0',
  role: 'application',
  'aria-roledescription': 'interactive globe',
  'aria-label': 'Globe of Arrakis. Drag or use the arrow keys to turn, plus and minus to zoom, Enter to open the place nearest the centre. Places are listed as buttons after the globe; the List view in Layers is a text alternative.',
}) as HTMLCanvasElement;
const stage = h('div', { class: 'atlas__stage' }, canvas);

const hudName = h('h1', { class: 'hud__name display' }, planetName(year));
const hudEra = h('p', { class: 'hud__status mono' });
const hud = h('div', { class: 'hud' }, h('p', { class: 'eyebrow' }, 'Canopus III · Planetary atlas'), hudName, hudEra);

const introTitle = h('p', { class: 'intro__title display' }, planetName(year));
const intro = h(
  'div',
  { class: 'intro', 'aria-hidden': 'true' },
  h('p', { class: 'intro__eyebrow eyebrow' }, 'Canopus III · The Desert Planet'),
  introTitle,
  h('p', { class: 'intro__hint mono' }, matchMedia('(pointer: coarse)').matches ? 'Drag to turn · pinch to zoom · tap a place' : 'Drag to turn · scroll to zoom · click a place · / to search'),
);

const srList = h('button', { class: 'sr-only sr-only--focusable', type: 'button' }, 'Open the list of places (text alternative to the globe)');

// Map controls
const globeBtn = h('button', { class: 'seg__btn', type: 'button', 'aria-pressed': 'true' }, icon(ICONS.globe, { size: 16 }), h('span', null, 'Globe'));
const mapBtn = h('button', { class: 'seg__btn', type: 'button', 'aria-pressed': 'false' }, icon(ICONS.map, { size: 16 }), h('span', null, 'Map'));
const zoomIn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom in', title: 'Zoom in (+)' }, icon(ICONS.plus));
const zoomOut = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom out', title: 'Zoom out (−)' }, icon(ICONS.minus));
const homeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Reset view', title: 'Reset view' }, icon(ICONS.target));
const ctrls = h(
  'div',
  { class: 'ctrls' },
  h('div', { class: 'seg', role: 'group', 'aria-label': 'Projection' }, globeBtn, mapBtn),
  h('div', { class: 'ctrls__zoom' }, zoomIn, zoomOut, homeBtn),
);
const ctrlsTop = h('div', { class: 'ctrls__top' });
ctrls.prepend(ctrlsTop);

const tlDock = h('div', { class: 'tl-dock' });
main.append(srList, stage, hud, intro, ctrls, tlDock);

// ---------------------------------------------------------------------------
// Globe (or graceful fallback)

let globe: ArrakisGlobe | null = null;
if (webgl) {
  try {
    globe = new ArrakisGlobe(canvas, { quality: deviceTier(), moons: false, storms: true, stars: true });
  } catch (err) {
    console.warn('[arrakis] WebGL globe unavailable, showing the list view instead', err);
    globe = null;
  }
}
const has3d = globe !== null;
if (!has3d) {
  stage.remove();
  ctrls.remove();
  intro.remove();
  srList.remove();
  main.dataset.fallback = 'true';
}

const camera = globe ? new CameraController(globe) : null;
const markers = globe ? new MarkerLayer(globe, lore.arrakis.places, lore.arrakis.regions, (id) => showPlace(id, { fly: true })) : null;
if (markers) stage.append(markers.el);

// ---------------------------------------------------------------------------
// Panels

const details = new Details({
  showPlace: (id, o) => showPlace(id, { fly: o?.fly ?? true, fromSheet: o?.fromSheet }),
  showRegion: (id) => showRegion(id, true),
  setYear: (y) => {
    tl.setPlaying(false);
    tl.set(y, 'api');
  },
  copyLink,
  flyToPlace: (id) => flyToPlace(id),
  flyToRegion: (id) => flyToRegion(id),
  onSubject: onSubject,
});
document.body.append(details.sheet.el);

const list = new PlaceList((id) => {
  if (has3d) list.close();
  showPlace(id, { fly: true });
}, {
  permanent: !has3d,
  note: has3d ? undefined : 'Your browser could not start the 3D globe (WebGL is unavailable), so the atlas is shown as a list. Everything else, including the timeline and search, still works.',
});
main.append(list.el);
srList.addEventListener('click', () => list.open());

let layers: LayerState = loadLayers();
const layersMenu = new LayersMenu(layers, () => list.open(), { webgl: has3d });
document.body.append(layersMenu.panel);
layersMenu.panel.dataset.anchor = has3d ? 'ctrls' : 'header';
if (has3d) ctrlsTop.append(layersMenu.button);
else shell.tools.prepend(layersMenu.button);

const banner = new EventBanner({
  onShow: (evs) => onEventsShown(evs),
  onOpenPlace: (id) => showPlace(id, { fly: true }),
  placeLabel: (id) => {
    const p = placeById(id);
    return p ? `Show ${placeName(p, year)}` : undefined;
  },
});
main.append(banner.el);

// Header tools: search + layers, before the sound button.
const searchBtn = h(
  'button',
  { class: 'icon-btn', type: 'button', 'aria-label': 'Search places and people', title: 'Search (Ctrl+K or /)', 'aria-keyshortcuts': 'Control+K /' },
  icon(ICONS.search),
);
shell.tools.prepend(searchBtn);

// ---------------------------------------------------------------------------
// Timeline

const tl = new Timeline({
  range: lore.range,
  year,
  eras: lore.eras,
  events: arrakisEvents.map((e) => ({ id: e.id, year: e.year, title: e.title })),
});
tlDock.append(tl.el);
tl.bindKeys();

let lastYear = year;
let dirtyPanels = false;
let lastPanelUpdate = 0;
let accent = '';

tl.onChange((y, source) => {
  year = y;
  applyYear(y);
  if (source === 'play') {
    banner.push(eventsCrossed(arrakisEvents, lastYear, y));
    dirtyPanels = true; // flushed at most a few times a second in the frame loop
  } else {
    if (source === 'step') banner.push(arrakisEvents.filter((e) => Math.abs(e.year - y) < 1e-6));
    updatePanels();
  }
  lastYear = y;
  writeParams({ year: Math.round(y) });
});
tl.onPlayChange((playing) => {
  if (!playing) updatePanels();
  main.dataset.playing = String(playing);
});

function applyYear(y: Year): void {
  const name = planetName(y);
  if (hudName.textContent !== name) {
    hudName.textContent = name;
    introTitle.textContent = name;
    document.title = `${name} · Lisan al-Gaib`;
  }
  const g = greeningAt(y);
  const scorched = scorchedAt(y);
  const status = scorched ? 'Sterilised · glass and ash' : g > 0.02 ? `Greening ${Math.round(g * 100)}%` : 'Deep desert';
  if (hudEra.textContent !== status) {
    hudEra.textContent = status;
    hudEra.dataset.tone = scorched ? 'dead' : g > 0.02 ? 'green' : 'sand';
  }
  const a = eraColor(y);
  if (a !== accent) {
    accent = a;
    document.documentElement.style.setProperty('--accent', a);
  }
  main.dataset.scorched = String(scorched);
  if (globe) {
    globe.setGreening(g);
    globe.setStorms(layers.storms ? stormsAt(y) : 0);
  }
  markers?.setYear(y);
}

function updatePanels(): void {
  dirtyPanels = false;
  lastPanelUpdate = performance.now();
  details.setYear(year);
  list.setYear(year);
}

function onEventsShown(evs: LoreEvent[]): void {
  audio.sfx('event');
  // Fly to a single located event, unless the viewer is busy reading something.
  const e = evs.length === 1 ? evs[0] : undefined;
  const p = e?.place ? placeById(e.place) : undefined;
  if (p && placeAt(p, year) && !details.sheet.isOpen && camera && camera.idleTime > 1.5) flyToPlace(p.id);
}

// ---------------------------------------------------------------------------
// Selection

function showPlace(id: string, opts: { fly?: boolean; fromSheet?: boolean; focus?: boolean } = {}): void {
  const p = placeById(id);
  if (!p) return;
  details.open({ type: 'place', id }, year, { push: opts.fromSheet, focus: opts.focus });
  audio.sfx('select');
  if (opts.fly) flyToPlace(id);
}

function showRegion(id: string, fromSheet = false): void {
  if (!regionById(id)) return;
  details.open({ type: 'region', id }, year, { push: fromSheet });
  flyToRegion(id);
}

function showCharacter(id: string): void {
  const c = character(id);
  if (!c) return;
  details.open({ type: 'character', id }, year);
  const w = whereaboutsAt(c, year);
  if (w?.body === 'arrakis' && w.place && placeById(w.place)) flyToPlace(w.place);
}

function onSubject(sel: Selection | null): void {
  markers?.setSelected(sel?.type === 'place' ? sel.id : null);
  writeParams({ place: sel?.type === 'place' ? sel.id : null });
  main.dataset.sheet = String(!!sel);
  document.documentElement.classList.toggle('atlas-sheet-open', !!sel);
  layoutFrame();
}

function flyToPlace(id: string): void {
  const p = placeById(id);
  if (!p || !camera) return;
  if (camera.mode === 'map') camera.flyTo(p.lat, p.lon, { zoom: Math.max(camera.targetZoom, 3.2) });
  else camera.flyTo(p.lat, p.lon, { dist: Math.min(camera.targetDist, Math.max(2.05, camera.homeDistance() * 0.5)) });
}

function flyToRegion(id: string): void {
  const r = regionById(id);
  if (!r || !camera) return;
  const rad = r.radius || 8;
  if (camera.mode === 'map') camera.flyTo(r.lat, r.lon, { zoom: clamp(55 / rad, 1, 5) });
  else camera.flyTo(r.lat, r.lon, { dist: clamp(1.7 + rad / 18, 1.9, 3.6) * Math.max(1, camera.homeDistance() / 4) });
}

async function copyLink(): Promise<void> {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied to the clipboard.');
    return;
  } catch {
    /* fall through */
  }
  const ta = h('textarea', { class: 'sr-only', readonly: true }) as HTMLTextAreaElement;
  ta.value = url;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  if (ok) toast('Link copied to the clipboard.');
  else toast(h('span', null, 'Copy this link: ', h('code', { class: 'mono', style: 'user-select:all;overflow-wrap:anywhere' }, url)), 12000);
}

// ---------------------------------------------------------------------------
// Search

const palette = new Palette({ placeholder: 'Search places, regions, people…', label: 'Search the atlas' });
palette.setItems(() => {
  const y = year;
  const items: PaletteItem[] = [];
  for (const p of lore.arrakis.places) {
    const exists = placeAt(p, y);
    const reg = regionById(p.region)?.name;
    items.push({
      id: `place:${p.id}`,
      label: placeName(p, y),
      sub: [KIND_LABEL[p.kind], reg, exists ? null : `not in ${formatYear(y)}`].filter(Boolean).join(' · '),
      group: 'Places',
      color: exists ? factionColor(placeController(p, y)) : 'var(--sand-faint)',
      keywords: [p.name, ...(p.names ?? []).map((n) => n.name), reg ?? '', p.kind],
      dim: !exists,
    });
  }
  for (const r of lore.arrakis.regions) items.push({ id: `region:${r.id}`, label: r.name, sub: 'Region', group: 'Regions', color: 'var(--sand)' });
  for (const c of charactersOnArrakis(y)) {
    const w = whereaboutsAt(c, y);
    const p = placeById(w?.place);
    const age = ageAt(c, y);
    items.push({
      id: `char:${c.id}`,
      label: c.name,
      sub: [p ? placeName(p, y) : planetName(y), age !== undefined ? `age ${age}` : null].filter(Boolean).join(' · '),
      group: `People on ${planetName(y)} in ${formatYear(y)}`,
      color: factionColor(c.allegiance?.[0]?.faction),
      keywords: c.aliases ?? [],
    });
  }
  return items;
});
palette.onSelect((item) => {
  const [kind, id] = item.id.split(':');
  if (kind === 'place') showPlace(id, { fly: true });
  else if (kind === 'region') showRegion(id);
  else if (kind === 'char') showCharacter(id);
});
palette.bindShortcut();
searchBtn.addEventListener('click', () => palette.open());

// ---------------------------------------------------------------------------
// Layers

function applyLayers(s: LayerState): void {
  layers = s;
  markers?.setOptions({ labels: s.labels, regions: s.regions });
  if (globe) {
    globe.setStorms(s.storms ? stormsAt(year) : 0);
    globe.setMoons(s.moons ? moonDefs() : []);
    if (!s.daynight) globe.setSunFromView(-0.5, 0.42, 0.76);
    else sunLon = globe.view.centerLon - 35;
  }
}
layersMenu.onChange(applyLayers);

function moonDefs() {
  const src = lore.arrakis.moons.length
    ? lore.arrakis.moons
    : [
        { orbit: 3.2, size: 0.24, period: 28, color: '#e4ddd2' },
        { orbit: 4.6, size: 0.16, period: 19, color: '#cfc6ba' },
      ];
  // Visual scale: keep moons small and outside the default camera distance's sweep.
  return src.map((m) => ({ orbit: m.orbit * 0.85, size: Math.min(m.size, 0.35) * 0.42, period: Math.max(8, m.period) * 4, color: m.color }));
}

let sunLon = 0;

// ---------------------------------------------------------------------------
// View mode

function setView(mode: ViewMode, instant?: boolean): void {
  if (!camera) return;
  camera.setMode(mode, instant);
  globeBtn.setAttribute('aria-pressed', String(mode === 'globe'));
  mapBtn.setAttribute('aria-pressed', String(mode === 'map'));
  main.dataset.view = mode;
  writeParams({ view: mode === 'map' ? 'map' : null });
}
globeBtn.addEventListener('click', () => {
  setView('globe');
  audio.sfx('whoosh');
});
mapBtn.addEventListener('click', () => {
  setView('map');
  audio.sfx('whoosh');
});
zoomIn.addEventListener('click', () => camera?.zoomBy(1.4));
zoomOut.addEventListener('click', () => camera?.zoomBy(1 / 1.4));
homeBtn.addEventListener('click', () => {
  if (!camera) return;
  if (camera.mode === 'map') camera.flyTo(30, 10, { zoom: 1.6 });
  else camera.flyTo(HOME.lat, HOME.lon, { dist: camera.homeDistance() });
});

// ---------------------------------------------------------------------------
// Gestures + keys

const HOME = { lat: 50, lon: 8 };
let hoverCursor = '';
if (globe && camera && markers) {
  const g = globe;
  const cam = camera;
  const mk = markers;
  attachGestures(canvas, {
    onPan: (dx, dy) => cam.pan(dx, dy),
    onZoom: (f, x, y) => cam.zoomBy(f, x, y),
    onTap: (x, y, type) => {
      const p = mk.nearest(x, y, type === 'mouse' ? 16 : 30);
      if (p) showPlace(p.id, { fly: true });
    },
    onDoubleTap: (x, y) => {
      if (mk.nearest(x, y, 24)) return; // double tap on a marker: the tap already selected it
      cam.zoomBy(2, x, y);
    },
    onHover: (x, y) => {
      const over = mk.hover(x, y);
      const c = over ? 'pointer' : '';
      if (c !== hoverCursor) {
        hoverCursor = c;
        canvas.style.cursor = c;
      }
    },
    onHoverEnd: () => mk.hoverEnd(),
    onDragStart: () => {
      cam.dragStart();
      main.dataset.dragging = 'true';
      dismissIntro();
    },
    onDragEnd: () => {
      cam.dragEnd();
      main.dataset.dragging = 'false';
    },
    onActivate: () => {
      const p = mk.centreMost(shiftX, shiftY);
      if (p) showPlace(p.id, { fly: true });
    },
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    toast('The graphics context was lost. Reload the page to restore the globe; the list view still works.', 9000);
    list.open();
  });
  void g;
}

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, [contenteditable], dialog')) return;
  if (e.key === 'Escape') {
    if (layersMenu.isOpen) layersMenu.close(true);
    else if (list.isOpen && has3d) list.close();
    else if (details.sheet.isOpen) details.close();
    else banner.hide();
  } else if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey && camera) {
    setView(camera.mode === 'map' ? 'globe' : 'map');
  }
});

// ---------------------------------------------------------------------------
// Layout: keep the planet centred in the part of the screen the panels leave free.

const wide = matchMedia('(min-width: 900px)');
let shiftX = 0;
let shiftY = 0;
let wantShiftX = 0;
let wantShiftY = 0;

function layoutFrame(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tlH = tlDock.offsetHeight;
  document.documentElement.style.setProperty('--tl-h', `${tlH}px`);
  const headerH = shell.header.offsetHeight;
  let top = headerH;
  let bottom = vh - tlH - 16;
  let right = vw;
  let left = 0;
  if (details.sheet.isOpen) {
    if (wide.matches) right = vw - details.sheet.el.offsetWidth - 12;
    else bottom = vh - details.sheet.el.offsetHeight;
  }
  if (list.isOpen && has3d && wide.matches) left = list.el.offsetWidth + 12;
  wantShiftX = ((left + right) / 2 - vw / 2) / vw;
  wantShiftY = ((top + bottom) / 2 - vh / 2) / vh;
  if (reducedMotion()) {
    shiftX = wantShiftX;
    shiftY = wantShiftY;
  }
}
new ResizeObserver(() => layoutFrame()).observe(tlDock);
new ResizeObserver(() => layoutFrame()).observe(details.sheet.el);
new MutationObserver(() => layoutFrame()).observe(list.el, { attributes: true, attributeFilter: ['data-open'] });
window.addEventListener('resize', layoutFrame);

// ---------------------------------------------------------------------------
// Intro

let introGone = false;
function dismissIntro(): void {
  if (introGone) return;
  introGone = true;
  intro.dataset.state = 'out';
  window.setTimeout(() => intro.remove(), 1200);
}

// ---------------------------------------------------------------------------
// Boot

applyYear(year);
updatePanels();
applyLayers(layers);
layoutFrame();

if (globe && camera) {
  const sareer = sareerPoint();
  if (sareer) globe.setSareer(sareer.lat, sareer.lon);
  const p = initialPlace ? placeById(initialPlace) : undefined;
  const start = p ? { lat: p.lat, lon: p.lon } : HOME;
  const rm = reducedMotion();
  // Begin far out and settle in: a short, non-blocking establishing shot.
  camera.setInitial({ lat: start.lat - (rm ? 0 : 18), lon: start.lon - (rm ? 0 : 70), dist: camera.homeDistance() * (rm ? 1 : 1.6) });
  camera.snap();
  if (initialView === 'map') setView('map', true);
  if (p) flyToPlace(p.id);
  else camera.flyTo(HOME.lat, HOME.lon, { dist: camera.homeDistance(), zoom: camera.targetZoom });
  intro.dataset.state = 'in';
  window.setTimeout(dismissIntro, rm ? 2200 : 3800);
}
if (initialPlace) showPlace(initialPlace, { focus: false });

onReducedMotionChange(() => layoutFrame());

onFrame((dt) => {
  tl.tick(dt);
  if (dirtyPanels && performance.now() - lastPanelUpdate > 280) updatePanels();
  if (!globe || !camera || !markers) return;

  // Gentle idle spin on the globe, never under reduced motion or while reading.
  if (!reducedMotion() && camera.mode === 'globe' && !details.sheet.isOpen && camera.idleTime > 12) {
    camera.autoRotate(dt, 2.2 * clamp((camera.idleTime - 12) / 4, 0, 1));
  }
  if (layers.daynight) {
    sunLon += dt * (reducedMotion() ? 2 : 7);
    globe.setSun(8, sunLon);
  }
  if (shiftX !== wantShiftX || shiftY !== wantShiftY) {
    const k = damp(7, dt);
    shiftX += (wantShiftX - shiftX) * k;
    shiftY += (wantShiftY - shiftY) * k;
    if (Math.abs(wantShiftX - shiftX) < 1e-4) shiftX = wantShiftX;
    if (Math.abs(wantShiftY - shiftY) < 1e-4) shiftY = wantShiftY;
    globe.setFrameShift(shiftX, shiftY);
    camera.shift.x = shiftX;
    camera.shift.y = shiftY;
  }
  camera.update(dt);
  globe.render(dt);
  markers.update(camera.closeness);
});

camera?.onInteract(() => {
  if (camera!.idleTime === 0) dismissIntro();
});

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
