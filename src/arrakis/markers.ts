/**
 * DOM overlay for places and regions over the globe canvas.
 *
 * One absolutely positioned layer; each marker is a real <button> moved with transforms only.
 * Per frame: read phase (label widths, only when names change) → projection + greedy label
 * collision → write phase that touches the DOM only when a value actually changed.
 *
 * Pointer input on the globe is handled by the canvas (markers have pointer-events: none so a
 * drag that starts on a marker still turns the planet); `nearest()` resolves taps and hovers.
 * Keyboard and assistive tech use the buttons directly.
 */
import type { ArrakisPlace, ArrakisRegion, PlaceKind, Year } from '../data/types.ts';
import type { ArrakisGlobe } from '../shared/globe/globe.ts';
import { clamp, h } from '../shared/dom.ts';
import {
  KIND_LABEL,
  KIND_PRIORITY,
  factionColor,
  factionName,
  placeAt,
  placeController,
  placeName,
  region as regionOf,
} from './world.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const KIND_PATHS: Record<PlaceKind, string> = {
  city: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 2.6a6.9 6.9 0 1 1 0 13.8 6.9 6.9 0 0 1 0-13.8z',
  sietch: 'M12 3.5l9 16H3z',
  fortress: 'M4 9V4h3.5v2.5H10V4h4v2.5h2.5V4H20v5l-1.5 1.5V20h-13v-9.5z',
  landmark: 'M12 2.5l7.5 9.5-7.5 9.5L4.5 12z',
  basin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-5 10.2c1.6-1.6 3.2-1.6 5 0s3.4 1.6 5 0v2.6c-1.6 1.6-3.2 1.6-5 0s-3.4-1.6-5 0z',
  station: 'M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z',
  shrine: 'M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z',
};

export function kindIcon(kind: PlaceKind, size = 16): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', KIND_PATHS[kind] ?? KIND_PATHS.landmark);
  p.setAttribute('fill-rule', 'evenodd');
  s.appendChild(p);
  return s;
}

interface Marker {
  place: ArrakisPlace;
  el: HTMLButtonElement;
  label: HTMLElement;
  // year-derived
  exists: boolean;
  name: string;
  color: string;
  controller?: string;
  // measured
  labelW: number;
  // per-frame (last written)
  x: number;
  y: number;
  op: number;
  vis: boolean;
  showLabel: boolean;
  side: 'r' | 'l';
  // per-frame (computed)
  px: number;
  py: number;
  pop: number;
  pvis: boolean;
}

interface RegionLabel {
  region: ArrakisRegion;
  el: HTMLElement;
  glow: HTMLElement;
  x: number;
  y: number;
  op: number;
  scale: number;
}

export interface MarkerOptions {
  labels: boolean;
  regions: boolean;
}

const LABEL_H = 20;
const ICON = 18;

export class MarkerLayer {
  readonly el: HTMLElement;
  private markers: Marker[] = [];
  private regions: RegionLabel[] = [];
  private tooltip: HTMLElement;
  private tipName: HTMLElement;
  private tipSub: HTMLElement;
  private tipOwner: HTMLElement;
  private selected: string | null = null;
  private hovered: Marker | null = null;
  private focused: Marker | null = null;
  private year: Year = 0;
  private opts: MarkerOptions = { labels: true, regions: true };
  private tipShown = false;
  private tipX = -1;
  private tipY = -1;

  constructor(
    private globe: ArrakisGlobe,
    places: ArrakisPlace[],
    regions: ArrakisRegion[],
    private onSelect: (placeId: string) => void,
  ) {
    const regionLayer = h('div', { class: 'rg-layer', 'aria-hidden': 'true' });
    const markerLayer = h('div', { class: 'mk-layer', role: 'group', 'aria-label': 'Places on the map' });
    this.tipName = h('strong', { class: 'tip__name' });
    this.tipSub = h('span', { class: 'tip__sub' });
    this.tipOwner = h('span', { class: 'tip__owner' });
    this.tooltip = h('div', { class: 'tip panel', 'aria-hidden': 'true', 'data-show': 'false' }, this.tipName, this.tipSub, this.tipOwner);
    this.el = h('div', { class: 'overlay' }, regionLayer, markerLayer, this.tooltip);

    for (const r of [...regions].sort((a, b) => (b.radius || 0) - (a.radius || 0))) {
      const glow = h('div', { class: 'rg-glow', 'data-danger': String(r.danger ?? 3) });
      const el = h('div', { class: 'rg-label' }, r.name);
      regionLayer.append(glow, el);
      this.regions.push({ region: r, el, glow, x: NaN, y: NaN, op: -1, scale: -1 });
    }

    for (const p of places) {
      const label = h('span', { class: 'mk__label' });
      const el = h(
        'button',
        { class: 'mk', type: 'button', 'data-kind': p.kind, hidden: true },
        h('span', { class: 'mk__icon' }, kindIcon(p.kind)),
        label,
      ) as HTMLButtonElement;
      const m: Marker = {
        place: p,
        el,
        label,
        exists: false,
        name: '',
        color: '',
        labelW: 0,
        x: NaN,
        y: NaN,
        op: -1,
        vis: false,
        showLabel: false,
        side: 'r',
        px: 0,
        py: 0,
        pop: 0,
        pvis: false,
      };
      el.style.visibility = 'hidden';
      el.addEventListener('click', () => this.onSelect(p.id));
      el.addEventListener('focus', () => {
        this.focused = m;
        this.showTip(m);
      });
      el.addEventListener('blur', () => {
        if (this.focused === m) this.focused = null;
        if (!this.hovered) this.hideTip();
      });
      markerLayer.append(el);
      this.markers.push(m);
    }
  }

  setOptions(o: Partial<MarkerOptions>): void {
    this.opts = { ...this.opts, ...o };
    this.el.dataset.regions = String(this.opts.regions);
  }

  setYear(year: Year): void {
    this.year = year;
    for (const m of this.markers) {
      const p = m.place;
      const exists = placeAt(p, year);
      if (exists !== m.exists) {
        m.exists = exists;
        m.el.hidden = !exists;
        if (!exists) {
          m.vis = false;
          m.el.style.visibility = 'hidden';
          m.x = m.y = NaN;
        }
      }
      if (!exists) continue;
      const name = placeName(p, year);
      const controller = placeController(p, year);
      const color = factionColor(controller);
      if (name !== m.name) {
        m.name = name;
        m.label.textContent = name;
        m.labelW = -1; // re-measure
      }
      if (color !== m.color) {
        m.color = color;
        m.el.style.setProperty('--c', color);
      }
      if (controller !== m.controller || m.el.getAttribute('aria-label') === null || name !== m.el.dataset.name) {
        m.controller = controller;
        m.el.dataset.name = name;
        const reg = regionOf(p.region)?.name;
        m.el.setAttribute(
          'aria-label',
          `${name}, ${KIND_LABEL[p.kind] ?? p.kind}${reg ? `, ${reg}` : ''}${controller ? `, held by ${factionName(controller)}` : ''}`,
        );
      }
    }
    if (this.hovered && !this.hovered.exists) this.hoverEnd();
    else if (this.tipShown && (this.hovered || this.focused)) this.fillTip((this.hovered ?? this.focused)!);
  }

  setSelected(id: string | null): void {
    if (this.selected === id) return;
    for (const m of this.markers) {
      if (m.place.id === this.selected) m.el.removeAttribute('data-selected');
      if (m.place.id === id) m.el.setAttribute('data-selected', 'true');
    }
    this.selected = id;
  }

  /** Nearest visible marker within `radius` CSS px of (x, y) in canvas coordinates. */
  nearest(x: number, y: number, radius: number): ArrakisPlace | null {
    let best: Marker | null = null;
    let bd = radius * radius;
    for (const m of this.markers) {
      if (!m.vis || m.op < 0.3) continue;
      const d = (m.x - x) ** 2 + (m.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best?.place ?? null;
  }

  /** Mouse hover from the canvas. Returns true when over a marker (for the cursor). */
  hover(x: number, y: number): boolean {
    const p = this.nearest(x, y, 16);
    const m = p ? this.markers.find((k) => k.place === p) ?? null : null;
    if (m === this.hovered) return !!m;
    if (this.hovered) this.hovered.el.removeAttribute('data-hover');
    this.hovered = m;
    if (m) {
      m.el.setAttribute('data-hover', 'true');
      this.showTip(m);
    } else if (this.focused) this.showTip(this.focused);
    else this.hideTip();
    return !!m;
  }

  hoverEnd(): void {
    if (this.hovered) this.hovered.el.removeAttribute('data-hover');
    this.hovered = null;
    if (this.focused) this.showTip(this.focused);
    else this.hideTip();
  }

  /** Place nearest the centre of the view (keyboard Enter on the canvas). */
  centreMost(shiftX = 0, shiftY = 0): ArrakisPlace | null {
    const { width, height } = this.globe.size;
    return this.nearest(width * (0.5 + shiftX), height * (0.5 + shiftY), Math.min(width, height) * 0.25);
  }

  update(closeness: number): void {
    const { width, height } = this.globe.size;

    // ---- read phase: measure labels whose text changed
    for (const m of this.markers) {
      if (m.labelW < 0 && m.exists) m.labelW = m.label.offsetWidth || m.name.length * 7.5;
    }

    // ---- compute
    const visible: Marker[] = [];
    for (const m of this.markers) {
      if (!m.exists) {
        m.pvis = false;
        continue;
      }
      const p = this.globe.project(m.place.lat, m.place.lon);
      m.px = p.x;
      m.py = p.y;
      m.pvis = p.visible;
      m.pop = p.visible ? clamp((p.facing - 0.05) / 0.25, 0, 1) : 0;
      if (m.pvis && m.pop > 0.35) visible.push(m);
    }

    // Greedy label placement by priority.
    const prio = (m: Marker) =>
      (m.place.id === this.selected ? 100 : 0) + (m === this.hovered || m === this.focused ? 50 : 0) + (KIND_PRIORITY[m.place.kind] ?? 1) + m.pop * 0.5;
    visible.sort((a, b) => prio(b) - prio(a));
    const taken: [number, number, number, number][] = [];
    const icons: [number, number, number, number][] = visible.map((m) => [m.px - ICON / 2, m.py - ICON / 2, m.px + ICON / 2, m.py + ICON / 2]);
    const hit = (r: [number, number, number, number], self: number) => {
      for (const t of taken) if (r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]) return true;
      for (let i = 0; i < icons.length; i++) {
        if (i === self) continue;
        const t = icons[i];
        if (r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]) return true;
      }
      return false;
    };
    // When zoomed far out, only the most important kinds get labels.
    const minPrio = closeness < 0.15 ? 4 : closeness < 0.4 ? 2 : 0;
    const labelFor = new Map<Marker, 'r' | 'l' | null>();
    visible.forEach((m, i) => {
      const forced = m.place.id === this.selected || m === this.hovered || m === this.focused;
      if (!forced && (!this.opts.labels || (KIND_PRIORITY[m.place.kind] ?? 1) < minPrio)) {
        labelFor.set(m, null);
        return;
      }
      const w = m.labelW + 8;
      const right: [number, number, number, number] = [m.px + 11, m.py - LABEL_H / 2, m.px + 11 + w, m.py + LABEL_H / 2];
      const left: [number, number, number, number] = [m.px - 11 - w, m.py - LABEL_H / 2, m.px - 11, m.py + LABEL_H / 2];
      const rightFits = right[2] < width - 4;
      if (forced || (rightFits && !hit(right, i))) {
        const r = forced && !rightFits ? left : right;
        taken.push(r);
        labelFor.set(m, r === right ? 'r' : 'l');
      } else if (left[0] > 4 && !hit(left, i)) {
        taken.push(left);
        labelFor.set(m, 'l');
      } else labelFor.set(m, null);
    });

    // ---- write phase
    for (const m of this.markers) {
      if (!m.exists) continue;
      const vis = m.pvis && m.pop > 0.02;
      if (vis !== m.vis) {
        m.vis = vis;
        m.el.style.visibility = vis ? 'visible' : 'hidden';
        if (!vis && document.activeElement === m.el) (document.activeElement as HTMLElement).blur();
      }
      if (!vis) continue;
      if (!(Math.abs(m.px - m.x) <= 0.05 && Math.abs(m.py - m.y) <= 0.05)) {
        m.x = m.px;
        m.y = m.py;
        m.el.style.transform = `translate3d(${m.px.toFixed(1)}px, ${m.py.toFixed(1)}px, 0)`;
      }
      const op = Math.round(m.pop * 50) / 50;
      if (op !== m.op) {
        m.op = op;
        m.el.style.opacity = String(op);
      }
      const side = labelFor.get(m) ?? null;
      const show = side !== null;
      if (show !== m.showLabel) {
        m.showLabel = show;
        m.el.dataset.label = String(show);
      }
      if (side && side !== m.side) {
        m.side = side;
        m.el.dataset.side = side;
      }
    }

    // Regions: big soft names when zoomed out.
    const regionAlpha = this.opts.regions ? clamp(1 - closeness * 1.6, 0, 1) : 0;
    // Places win: region names avoid place labels and icons.
    const regionRects: [number, number, number, number][] = [...taken, ...icons];
    for (const r of this.regions) {
      const p = this.globe.project(r.region.lat, r.region.lon);
      let op = 0;
      let scale = r.scale;
      // Big regions first (array is sorted by radius); skip names that would collide.
      const hw = r.region.name.length * 6.5 + 10;
      const rect: [number, number, number, number] = [p.x - hw, p.y - 12, p.x + hw, p.y + 12];
      const clash = regionRects.some((t) => rect[0] < t[2] && rect[2] > t[0] && rect[1] < t[3] && rect[3] > t[1]);
      if (p.visible && regionAlpha > 0 && !clash) regionRects.push(rect);
      if (p.visible && regionAlpha > 0 && !clash) {
        op = Math.round(clamp((p.facing - 0.2) / 0.4, 0, 1) * regionAlpha * 50) / 50;
        const edge = this.globe.project(clamp(r.region.lat + (r.region.radius || 8), -89, 89), r.region.lon);
        scale = Math.round((Math.hypot(edge.x - p.x, edge.y - p.y) / 50) * 100) / 100;
      }
      if (op !== r.op) {
        r.op = op;
        r.el.style.opacity = String(op);
        r.glow.style.opacity = String(op);
      }
      if (op > 0 && (!(Math.abs(p.x - r.x) <= 0.1 && Math.abs(p.y - r.y) <= 0.1) || scale !== r.scale)) {
        r.x = p.x;
        r.y = p.y;
        r.scale = scale;
        r.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        r.glow.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
    }

    // Tooltip follows its marker.
    const tipFor = this.hovered ?? this.focused;
    if (this.tipShown && tipFor) {
      if (!tipFor.vis) this.hideTip();
      else if (Math.abs(tipFor.x - this.tipX) > 0.3 || Math.abs(tipFor.y - this.tipY) > 0.3) {
        this.tipX = tipFor.x;
        this.tipY = tipFor.y;
        const below = tipFor.y < 110;
        this.tooltip.dataset.below = String(below);
        const x = clamp(tipFor.x, 110, width - 110);
        this.tooltip.style.transform = `translate3d(${x.toFixed(1)}px, ${(tipFor.y + (below ? 18 : -18)).toFixed(1)}px, 0) translate(-50%, ${below ? '0' : '-100%'})`;
      }
    }
    void height;
  }

  private showTip(m: Marker): void {
    this.fillTip(m);
    this.tipShown = true;
    this.tipX = this.tipY = -1;
    this.tooltip.dataset.show = 'true';
  }

  private fillTip(m: Marker): void {
    const reg = regionOf(m.place.region)?.name;
    this.tipName.textContent = m.name;
    this.tipSub.textContent = `${KIND_LABEL[m.place.kind] ?? m.place.kind}${reg ? ` · ${reg}` : ''}`;
    this.tipOwner.textContent = m.controller ? factionName(m.controller) : 'Control unrecorded';
    this.tipOwner.style.setProperty('--c', m.color);
  }

  private hideTip(): void {
    if (!this.tipShown) return;
    this.tipShown = false;
    this.tooltip.dataset.show = 'false';
  }

  get yearShown(): Year {
    return this.year;
  }
}
