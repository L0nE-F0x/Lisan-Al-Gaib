/**
 * Canvas renderer for the Known Universe.
 *
 * Everything expensive is pre-rendered once and reused with drawImage:
 *  - starfield tiles (3 parallax layers) and a world-space nebula, rebuilt only on DPR/size change
 *  - one glow / disc sprite per star colour, one territory sprite per faction colour
 *  - one shaded sprite per planet (rotated at draw time so its lit side faces its star)
 * No shadowBlur, no per-frame gradients. Systems outside the viewport are culled.
 */
import { lore } from '../data/index.ts';
import type { Body, Faction, StarSystem } from '../data/types.ts';
import type { Camera } from './camera.ts';
import * as W from './world.ts';

export interface Layers {
  territories: boolean;
  orbits: boolean;
  labels: boolean;
  moons: boolean;
}

export interface Hit {
  kind: 'body' | 'system';
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface FrameState {
  year: number;
  time: number;
  layers: Layers;
  selected: string | null;
  hover: string | null;
  pulses: { id: string; age: number }[];
  reticle: boolean;
  eraColor: string;
  coarse: boolean;
  animate: boolean;
}

// Fonts: all >= 12px. Family names match @fontsource registrations.
const F_STAR = '500 13px Cinzel, "Times New Roman", serif';
const F_STAR_BIG = '500 15px Cinzel, "Times New Roman", serif';
const F_WORLDS = '600 14px Rajdhani, system-ui, sans-serif';
const F_BODY = '600 15px Rajdhani, system-ui, sans-serif';
const F_BODY_SEL = '700 16px Rajdhani, system-ui, sans-serif';
const F_MOON = '600 13px Rajdhani, system-ui, sans-serif';
const F_CHIP = '400 12px "JetBrains Mono", ui-monospace, monospace';

const C_BONE = '#ece0c8';
const C_SAND = '#c8a97a';
const C_SPICE = '#f0a44a';
const C_OUTLINE = 'rgba(8,6,4,0.88)';

export const FONTS_TO_LOAD = [F_STAR, F_STAR_BIG, F_WORLDS, F_BODY, F_BODY_SEL, F_MOON, F_CHIP];

// ---------------------------------------------------------------------------
// Colour + sprite helpers
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [200, 180, 150];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mix(hex: string, other: string, t: number): string {
  const a = parseHex(hex);
  const b = parseHex(other);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function rng(seed: number): () => number {
  let s = Math.floor(seed * 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

class SpriteCache<K> {
  private map = new Map<K, HTMLCanvasElement>();
  constructor(private make: (key: K) => HTMLCanvasElement) {}
  get(key: K): HTMLCanvasElement {
    let c = this.map.get(key);
    if (!c) {
      c = this.make(key);
      this.map.set(key, c);
    }
    return c;
  }
}

const glowSprites = new SpriteCache<string>((color) => {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.07, rgba(color, 0.8));
  g.addColorStop(0.22, rgba(color, 0.26));
  g.addColorStop(0.5, rgba(color, 0.07));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
});

const discSprites = new SpriteCache<string>((color) => {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(56, 56, 0, 64, 64, 62);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, mix(color, '#ffffff', 0.55));
  g.addColorStop(0.92, color);
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 63, 0, Math.PI * 2);
  ctx.fill();
  return c;
});

const territorySprites = new SpriteCache<string>((color) => {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, rgba(color, 0.62));
  g.addColorStop(0.3, rgba(color, 0.34));
  g.addColorStop(0.65, rgba(color, 0.1));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
});

const flareSprite = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => {
    if (c) return c;
    const [cv, ctx] = canvas(256, 256);
    for (const horiz of [true, false]) {
      const g = horiz ? ctx.createLinearGradient(0, 0, 256, 0) : ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,240,215,0)');
      g.addColorStop(0.5, 'rgba(255,240,215,0.9)');
      g.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.fillStyle = g;
      if (horiz) ctx.fillRect(0, 127, 256, 2);
      else ctx.fillRect(127, 0, 2, 256);
    }
    c = cv;
    return c;
  };
})();

const PLANET_S = 256;
const PLANET_PAD = 1.18;
const planetSprites = new SpriteCache<Body>((b) => {
  const size = Math.round(PLANET_S * PLANET_PAD);
  const [c, ctx] = canvas(size, size);
  const cx = size / 2;
  const r = PLANET_S / 2;
  const rand = rng(W.hash01(b.id) || 0.37);
  // atmosphere halo
  const halo = ctx.createRadialGradient(cx, cx, r * 0.96, cx, cx, size / 2);
  halo.addColorStop(0, rgba(mix(b.color, '#ffffff', 0.4), 0.45));
  halo.addColorStop(1, rgba(b.color, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = b.color;
  ctx.fillRect(0, 0, size, size);
  // bands and patches, seeded per body
  for (let i = 0; i < 9; i++) {
    const y = cx - r + rand() * r * 2;
    const hgt = r * (0.05 + rand() * 0.22);
    ctx.fillStyle = rand() > 0.5 ? rgba('#ffffff', 0.05 + rand() * 0.09) : rgba('#000000', 0.06 + rand() * 0.12);
    ctx.beginPath();
    ctx.ellipse(cx + (rand() - 0.5) * r * 0.6, y, r * (0.9 + rand() * 0.8), hgt, (rand() - 0.5) * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = rgba(rand() > 0.6 ? '#ffffff' : '#000000', 0.05 + rand() * 0.08);
    ctx.beginPath();
    ctx.arc(cx + (rand() - 0.5) * r * 1.8, cx + (rand() - 0.5) * r * 1.8, r * (0.04 + rand() * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
  // terminator: lit from +x
  const shade = ctx.createRadialGradient(cx + r * 0.45, cx - r * 0.12, r * 0.08, cx, cx, r * 1.06);
  shade.addColorStop(0, 'rgba(255,248,230,0.22)');
  shade.addColorStop(0.42, 'rgba(0,0,0,0)');
  shade.addColorStop(0.78, 'rgba(0,0,0,0.6)');
  shade.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  // thin lit rim
  ctx.strokeStyle = rgba(mix(b.color, '#ffffff', 0.5), 0.55);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cx, r - 1.5, -Math.PI * 0.42, Math.PI * 0.42);
  ctx.stroke();
  return c;
});

function makeStarTile(cssSize: number, dpr: number, count: number, rMin: number, rMax: number, aMin: number, aMax: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(cssSize * dpr, cssSize * dpr);
  ctx.scale(dpr, dpr);
  const rand = rng(seed);
  const tints = ['#ffffff', '#fff1d6', '#ffe2b8', '#d8e8ff', '#ffd2a8'];
  for (let i = 0; i < count; i++) {
    const x = rand() * cssSize;
    const y = rand() * cssSize;
    const r = rMin + Math.pow(rand(), 2.4) * (rMax - rMin);
    ctx.globalAlpha = aMin + rand() * (aMax - aMin);
    ctx.fillStyle = tints[Math.floor(rand() * tints.length)];
    if (r < 0.65) ctx.fillRect(x, y, 1 / dpr + r, 1 / dpr + r);
    else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (r > rMax * 0.7) {
        ctx.globalAlpha *= 0.35;
        ctx.fillRect(x - r * 3, y - 0.3, r * 6, 0.6);
        ctx.fillRect(x - 0.3, y - r * 3, 0.6, r * 6);
      }
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

const NEB_RES = 640;
function makeNebula(): HTMLCanvasElement {
  const [c, ctx] = canvas(NEB_RES, NEB_RES);
  const rand = rng(0.4242);
  const palette = ['#b45f1d', '#6b3d86', '#1d5a7a', '#8a3a24', '#3b2a5a', '#7a5524'];
  // Some colour anchored near notable systems so the cloud "belongs" to the map.
  const anchors: [number, number][] = lore.systems.slice(0, 10).map((s) => [s.x, s.y]);
  const toN = (wx: number, wy: number) => [
    ((wx - W.bounds.minX) / (W.bounds.maxX - W.bounds.minX)) * NEB_RES,
    ((wy - W.bounds.minY) / (W.bounds.maxY - W.bounds.minY)) * NEB_RES,
  ];
  for (let i = 0; i < 34; i++) {
    let x: number, y: number;
    if (i < anchors.length && rand() > 0.35) {
      [x, y] = toN(anchors[i][0] + (rand() - 0.5) * 500, anchors[i][1] + (rand() - 0.5) * 500);
    } else {
      x = rand() * NEB_RES;
      y = rand() * NEB_RES;
    }
    const r = NEB_RES * (0.08 + rand() * 0.24);
    const col = palette[Math.floor(rand() * palette.length)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rand() * 0.11;
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.55, rgba(col, a * 0.45));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.45 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // fade the edges so the cloud never shows a rectangular border
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createRadialGradient(NEB_RES / 2, NEB_RES / 2, NEB_RES * 0.3, NEB_RES / 2, NEB_RES / 2, NEB_RES * 0.5);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, NEB_RES, NEB_RES);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// Sigils: tiny glyphs drawn in a 16x16 box, filled with the faction colour.
const SIGILS: Record<string, string> = {
  hawk: 'M1 9 L8 3 L15 9 L11.5 8.5 L8 11 L4.5 8.5 Z M7 11 L8 15 L9 11 Z',
  griffin: 'M3 14 L5 6 L2 3 L7 4 L9 1 L10 5 L14 6 L11 9 L13 14 L8 11 Z',
  lion: 'M2 13 L3 5 L6 8.5 L8 3 L10 8.5 L13 5 L14 13 Z',
  crysknife: 'M3 14 Q6 3 14 2 Q9 6 5 15 Z',
  worm: 'M8 1.5 A6.5 6.5 0 1 1 7.99 1.5 Z M8 5 A3 3 0 1 0 8.01 5 Z',
};
const sigilPaths = new Map<string, Path2D>();
function sigilPath(name: string | undefined): Path2D | null {
  if (!name || !SIGILS[name]) return null;
  let p = sigilPaths.get(name);
  if (!p) {
    p = new Path2D(SIGILS[name]);
    sigilPaths.set(name, p);
  }
  return p;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

interface LabelLine {
  text: string;
  font: string;
  color: string;
  h: number;
  chip?: Faction;
  spacing?: boolean;
}
interface LabelReq {
  x: number;
  y: number;
  /** 'below' centres under the anchor; 'right' starts to the right of it. */
  align: 'below' | 'right';
  lines: LabelLine[];
  pri: number;
  alpha: number;
  /** Minimum number of lines to keep when space is tight. */
  minLines: number;
  /** For 'right' labels: anchor x to flip to (label ends here) when it would leave the screen. */
  flipX?: number;
}

// ---------------------------------------------------------------------------

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private tiles: { img: HTMLCanvasElement; p: number; size: number; depth: number }[] = [];
  private nebula: HTMLCanvasElement | null = null;
  private hits: Hit[] = [];
  private measure = new Map<string, number>();
  private letterSpacing: boolean;
  private labels: LabelReq[] = [];
  private placed: number[] = [];

  constructor(cv: HTMLCanvasElement) {
    this.canvas = cv;
    const ctx = cv.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.letterSpacing = 'letterSpacing' in ctx;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const changedDpr = dpr !== this.dpr || this.tiles.length === 0;
    this.w = Math.max(1, cssW);
    this.h = Math.max(1, cssH);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    if (changedDpr) {
      const T = 512;
      this.tiles = [
        { img: makeStarTile(T, dpr, 560, 0.3, 0.85, 0.25, 0.75, 0.11), p: 0.015, size: T, depth: 0 },
        { img: makeStarTile(T, dpr, 150, 0.45, 1.2, 0.35, 0.9, 0.53), p: 0.05, size: T, depth: 0.06 },
        { img: makeStarTile(T, dpr, 42, 0.8, 1.7, 0.5, 1, 0.97), p: 0.13, size: T, depth: 0.16 },
      ];
    }
    if (!this.nebula) this.nebula = makeNebula();
    this.measure.clear();
  }

  /** Invalidate text measurements (after web fonts load). */
  fontsChanged(): void {
    this.measure.clear();
  }

  get lastHits(): readonly Hit[] {
    return this.hits;
  }

  private textW(font: string, text: string, spacing = false): number {
    const key = font + '|' + (spacing ? 's|' : '') + text;
    let v = this.measure.get(key);
    if (v === undefined) {
      this.ctx.font = font;
      if (this.letterSpacing) (this.ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing ? '1.5px' : '0px';
      v = this.ctx.measureText(text).width;
      this.measure.set(key, v);
    }
    return v;
  }

  draw(cam: Camera, st: FrameState): void {
    const ctx = this.ctx;
    const { w, h } = this;
    const z = cam.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#07050a';
    ctx.fillRect(0, 0, w, h);

    this.hits.length = 0;
    this.labels.length = 0;

    this.drawBackdrop(cam, st);

    const zl = Math.log(z / cam.minZ); // 0 when fully zoomed out

    // ---- lanes (decorative) ----
    const laneA = 0.16 * (1 - smooth(2, 6, z));
    if (laneA > 0.01) {
      ctx.strokeStyle = `rgba(125,211,252,${laneA})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      for (const [a, b] of W.lanes) {
        ctx.moveTo(cam.toScreenX(a.x), cam.toScreenY(a.y));
        ctx.lineTo(cam.toScreenX(b.x), cam.toScreenY(b.y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- territories ----
    if (st.layers.territories) {
      ctx.globalCompositeOperation = 'screen';
      const terrA = 0.78 - 0.5 * smooth(1, 10, z);
      const rpx = Math.max(64, W.TERRITORY_R * z * (1 - 0.35 * smooth(1, 8, z)));
      for (const s of lore.systems) {
        const sx = cam.toScreenX(s.x);
        const sy = cam.toScreenY(s.y);
        if (sx + rpx < 0 || sx - rpx > w || sy + rpx < 0 || sy - rpx > h) continue;
        const planets = (W.planetsBySystem.get(s.id) ?? []).filter((b) => W.visibleAt(b, st.year));
        if (!planets.length) continue;
        const share = terrA / Math.sqrt(planets.length);
        for (const b of planets) {
          const blend = W.controlBlend(b, st.year);
          if (blend.cur.id === W.UNKNOWN_FACTION.id && !blend.next) continue;
          const draw = (f: Faction, a: number) => {
            if (a <= 0.004 || !W.hasTerritory(f)) return;
            ctx.globalAlpha = a;
            ctx.drawImage(territorySprites.get(f.color), sx - rpx, sy - rpx, rpx * 2, rpx * 2);
          };
          draw(blend.cur, share * (1 - blend.mix));
          if (blend.next) draw(blend.next, share * blend.mix);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---- systems ----
    const minHit = st.coarse ? 22 : 13;
    const selSys = st.selected && W.systemById.has(st.selected) ? st.selected : null;
    let selPos: { x: number; y: number; r: number } | null = null;
    let hoverPos: { x: number; y: number; r: number } | null = null;

    for (const s of lore.systems) {
      const sx = cam.toScreenX(s.x);
      const sy = cam.toScreenY(s.y);
      const reach = W.systemRadius(s.id) * z + 160;
      if (sx + reach < 0 || sx - reach > w || sy + reach < 0 || sy - reach > h) continue;
      const planets = (W.planetsBySystem.get(s.id) ?? []).filter((b) => W.visibleAt(b, st.year));
      const imp = W.systemImportance.get(s.id) ?? 0;

      // star
      const core = Math.max(1.8 + Math.min(1.2, imp / 60), W.STAR_R * z * 0.85);
      const glow = Math.max(34 + Math.min(16, imp / 4), core * 7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glowSprites.get(s.color), sx - glow / 2, sy - glow / 2, glow, glow);
      if (core > 5) {
        const fl = core * 16;
        ctx.globalAlpha = 0.28 * smooth(5, 20, core);
        ctx.drawImage(flareSprite(), sx - fl / 2, sy - fl / 2, fl, fl);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(discSprites.get(s.color), sx - core, sy - core, core * 2, core * 2);
      const sysHitR = Math.max(minHit, core + 8);
      this.hits.push({ kind: 'system', id: s.id, x: sx, y: sy, r: sysHitR });
      if (selSys === s.id) selPos = { x: sx, y: sy, r: core + 7 };
      if (st.hover === s.id) hoverPos = { x: sx, y: sy, r: core + 7 };

      // planets
      let anyPlanetShown = false;
      for (const b of planets) {
        const R = W.orbitRadius(b);
        const a = smooth(14, 34, R * z);
        if (a <= 0.01) continue;
        const separated = R * z > 44; // planet clearly apart from its star: label it on its own
        anyPlanetShown = anyPlanetShown || separated;
        const p = W.positionAt(b, st.year);
        const px = cam.toScreenX(p.x);
        const py = cam.toScreenY(p.y);
        const isSel = st.selected === b.id;
        if (st.layers.orbits) {
          ctx.strokeStyle = isSel ? rgba(C_SPICE, 0.5 * a) : `rgba(236,224,200,${0.13 * a})`;
          ctx.lineWidth = isSel ? 1.4 : 1;
          ctx.beginPath();
          ctx.arc(sx, sy, R * z, 0, Math.PI * 2);
          ctx.stroke();
        }
        const pr = Math.max(2.6 + b.size * 1.6, W.bodyRadius(b) * z);
        this.drawBody(b, px, py, pr, Math.atan2(sy - py, sx - px), a);
        if (a > 0.5) this.hits.push({ kind: 'body', id: b.id, x: px, y: py, r: Math.max(minHit, pr + 6) });
        if (isSel) selPos = { x: px, y: py, r: pr + 6 };
        if (st.hover === b.id) hoverPos = { x: px, y: py, r: pr + 6 };

        // moons
        const moons = W.moonsByParent.get(b.id);
        let moonsShown = false;
        if (moons && st.layers.moons) {
          for (const m of moons) {
            if (!W.visibleAt(m, st.year)) continue;
            const mr = W.orbitRadius(m);
            const ma = smooth(16, 34, mr * z) * a;
            if (ma <= 0.01) continue;
            const mp = W.positionAt(m, st.year);
            const mx = cam.toScreenX(mp.x);
            const my = cam.toScreenY(mp.y);
            if (st.layers.orbits) {
              ctx.strokeStyle = st.selected === m.id ? rgba(C_SPICE, 0.5 * ma) : `rgba(236,224,200,${0.1 * ma})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(px, py, mr * z, 0, Math.PI * 2);
              ctx.stroke();
            }
            const mrad = Math.max(2.8 + m.size * 2, W.bodyRadius(m) * z);
            this.drawBody(m, mx, my, mrad, Math.atan2(sy - my, sx - mx), ma);
            if (ma > 0.5) {
              moonsShown = true;
              this.hits.push({ kind: 'body', id: m.id, x: mx, y: my, r: Math.max(minHit * 0.8, mrad + 6) });
              if (st.layers.labels || st.selected === m.id) {
                this.labels.push({
                  x: mx + mrad + 5,
                  flipX: mx - mrad - 5,
                  y: my,
                  align: 'right',
                  lines: [{ text: W.bodyName(m, st.year), font: F_MOON, color: st.selected === m.id ? C_SPICE : C_SAND, h: 15 }],
                  pri: st.selected === m.id ? 1000 : 20 + imp / 10,
                  alpha: ma,
                  minLines: 1,
                });
              }
            }
            if (st.selected === m.id) selPos = { x: mx, y: my, r: mrad + 6 };
            if (st.hover === m.id) hoverPos = { x: mx, y: my, r: mrad + 6 };
          }
        }

        // body label
        if ((st.layers.labels && separated) || isSel) {
          const { faction: f, entry } = W.controllerAt(b, st.year);
          const lines: LabelLine[] = [
            { text: W.bodyName(b, st.year), font: isSel ? F_BODY_SEL : F_BODY, color: isSel ? C_SPICE : C_BONE, h: 18 },
          ];
          const close = R * z > 150 || pr > 9;
          if (close || isSel) {
            lines.push({ text: entry ? f.name : 'Holder unrecorded', font: F_CHIP, color: C_BONE, h: 20, chip: f });
            if (b.export) lines.push({ text: `Export · ${b.export}`, font: F_CHIP, color: C_SAND, h: 16 });
          }
          this.labels.push({
            x: px + pr + 7,
            flipX: px - pr - 7,
            y: py,
            align: 'right',
            lines,
            pri: isSel ? 1000 : st.hover === b.id ? 900 : 200 + imp,
            alpha: Math.max(a, isSel ? 1 : 0),
            minLines: 1,
          });
        }
        void moonsShown;
      }

      // system label
      if (st.layers.labels || selSys === s.id) {
        const isSel = selSys === s.id;
        const lines: LabelLine[] = [
          { text: W.starLabel(s).toUpperCase(), font: imp > 60 ? F_STAR_BIG : F_STAR, color: isSel ? C_SPICE : anyPlanetShown ? C_SAND : C_BONE, h: 18, spacing: true },
        ];
        const worlds = planets.map((b) => W.bodyName(b, st.year)).join(' · ');
        if (!anyPlanetShown && planets.length && worlds.toUpperCase() !== lines[0].text) {
          lines.push({ text: worlds, font: F_WORLDS, color: C_SAND, h: 17 });
        }
        this.labels.push({
          x: sx,
          y: sy + Math.max(core, 4) + 9,
          align: 'below',
          lines,
          pri: isSel ? 1100 : st.hover === s.id ? 950 : (anyPlanetShown ? 100 : 300) + imp,
          alpha: 1,
          minLines: 1,
        });
      }
    }
    void zl;

    // ---- pulses (events) ----
    for (const pulse of st.pulses) {
      const b = W.bodyById.get(pulse.id);
      if (!b) continue;
      const p = W.positionAt(b, st.year);
      const px = cam.toScreenX(p.x);
      const py = cam.toScreenY(p.y);
      for (let k = 0; k < 2; k++) {
        const t = pulse.age - k * 0.45;
        if (t < 0 || t > 2.4) continue;
        ctx.strokeStyle = rgba(st.eraColor, 0.85 * (1 - t / 2.4));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 10 + t * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---- hover & selection ----
    if (hoverPos && (!selPos || hoverPos.x !== selPos.x || hoverPos.y !== selPos.y)) {
      ctx.strokeStyle = 'rgba(236,224,200,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hoverPos.x, hoverPos.y, hoverPos.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (selPos) this.drawSelection(selPos.x, selPos.y, selPos.r, st);

    // ---- labels ----
    this.drawLabels();

    if (st.reticle) this.drawReticle(cam.fx, cam.fy);
  }

  private drawBackdrop(cam: Camera, st: FrameState): void {
    const ctx = this.ctx;
    const { w, h } = this;
    const z = cam.zoom;
    const zf = z / cam.minZ;

    // nebula: world-anchored, slower than the map (parallax), soft upscaling is fine
    if (this.nebula) {
      const sN = cam.minZ * 1.08 * Math.pow(zf, 0.22);
      const bw = (W.bounds.maxX - W.bounds.minX) * sN * 1.25;
      const bh = (W.bounds.maxY - W.bounds.minY) * sN * 1.25;
      const cx = (W.bounds.minX + W.bounds.maxX) / 2;
      const cy = (W.bounds.minY + W.bounds.maxY) / 2;
      const nx = cam.fx + (cx - cam.x) * sN - bw / 2;
      const ny = cam.fy + (cy - cam.y) * sN - bh / 2;
      ctx.globalAlpha = 1;
      ctx.drawImage(this.nebula, nx, ny, bw, bh);
    }

    // era tint
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.11;
    const R = Math.max(w, h) * 1.1;
    ctx.drawImage(territorySprites.get(st.eraColor), w / 2 - R, h * 0.62 - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'lighter';

    // star tiles (screen-space parallax)
    const pz = Math.pow(z, 0.3);
    for (const t of this.tiles) {
      const scale = 1 + t.depth * Math.log(Math.max(1, zf));
      const size = t.size * scale;
      const offX = -((cam.x * pz * t.p * 3 * scale) % size) - size;
      const offY = -((cam.y * pz * t.p * 3 * scale) % size) - size;
      ctx.globalAlpha = 1;
      for (let x = offX; x < w; x += size) {
        if (x + size < 0) continue;
        for (let y = offY; y < h; y += size) {
          if (y + size < 0) continue;
          ctx.drawImage(t.img, x, y, size, size);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBody(b: Body, x: number, y: number, r: number, toStar: number, alpha: number): void {
    if (x + r * 2 < -20 || x - r * 2 > this.w + 20 || y + r * 2 < -20 || y - r * 2 > this.h + 20) return;
    const ctx = this.ctx;
    const img = planetSprites.get(b);
    const s = r * 2 * PLANET_PAD;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(toStar);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawSelection(x: number, y: number, r: number, st: FrameState): void {
    const ctx = this.ctx;
    const rot = st.animate ? st.time * 0.6 : 0;
    const pulse = st.animate ? 1 + Math.sin(st.time * 2.4) * 0.06 : 1;
    const rr = (r + 4) * pulse;
    ctx.strokeStyle = rgba(C_SPICE, 0.9);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -rot * 10;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // brackets
    const b = rr + 7;
    const l = 7;
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(C_SPICE, 0.95);
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      ctx.moveTo(x + sx * b, y + sy * (b - l));
      ctx.lineTo(x + sx * b, y + sy * b);
      ctx.lineTo(x + sx * (b - l), y + sy * b);
    }
    ctx.stroke();
  }

  private drawReticle(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(125,211,252,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.moveTo(x - 26, y);
    ctx.lineTo(x - 19, y);
    ctx.moveTo(x + 19, y);
    ctx.lineTo(x + 26, y);
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x, y - 19);
    ctx.moveTo(x, y + 19);
    ctx.lineTo(x, y + 26);
    ctx.stroke();
  }

  private drawLabels(): void {
    const ctx = this.ctx;
    const reqs = this.labels.sort((a, b) => b.pri - a.pri);
    const placed = this.placed;
    placed.length = 0;
    const overlaps = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i < placed.length; i += 4) {
        if (x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1]) return true;
      }
      return false;
    };
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const L of reqs) {
      let n = L.lines.length;
      let box: [number, number, number, number] | null = null;
      let flipped = false;
      while (n >= L.minLines) {
        const lines = L.lines.slice(0, n);
        const width = Math.max(...lines.map((ln) => this.textW(ln.font, ln.text, ln.spacing) + (ln.chip ? 30 : 0)));
        const height = lines.reduce((s, ln) => s + ln.h, 0);
        flipped = L.align === 'right' && L.flipX !== undefined && L.x + width > this.w - 6 && L.flipX - width > 6;
        const x0 = L.align === 'below' ? L.x - width / 2 : flipped ? L.flipX! - width : L.x;
        const y0 = L.align === 'below' ? L.y : L.y - lines[0].h / 2;
        const bx: [number, number, number, number] = [x0 - 3, y0 - 2, x0 + width + 3, y0 + height + 2];
        if (L.pri >= 1000 || !overlaps(...bx)) {
          box = bx;
          break;
        }
        n--;
      }
      if (!box) continue;
      placed.push(...box);
      let y = L.align === 'below' ? L.y : L.y - L.lines[0].h / 2;
      ctx.globalAlpha = L.alpha;
      for (let i = 0; i < n; i++) {
        const ln = L.lines[i];
        const tw = this.textW(ln.font, ln.text, ln.spacing) + (ln.chip ? 30 : 0);
        const x0 = L.align === 'below' ? L.x - tw / 2 : flipped ? box[2] - 3 - tw : L.x;
        const cy = y + ln.h / 2;
        ctx.font = ln.font;
        if (this.letterSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = ln.spacing ? '1.5px' : '0px';
        let tx = x0;
        if (ln.chip) {
          // chip: rounded pill with sigil (or dot) and the faction name
          const cw = tw;
          ctx.fillStyle = 'rgba(10,7,5,0.82)';
          ctx.strokeStyle = rgba(ln.chip.color, 0.7);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x0, cy - 9, cw, 18, 9);
          ctx.fill();
          ctx.stroke();
          const path = sigilPath(ln.chip.sigil);
          ctx.fillStyle = ln.chip.color;
          if (path) {
            ctx.save();
            ctx.translate(x0 + 7, cy - 6);
            ctx.scale(0.75, 0.75);
            ctx.fill(path, 'evenodd');
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(x0 + 13, cy, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          tx = x0 + 23;
          ctx.textAlign = 'left';
          ctx.fillStyle = ln.color;
          ctx.fillText(ln.text, tx, cy + 0.5);
        } else {
          ctx.textAlign = 'left';
          ctx.strokeStyle = C_OUTLINE;
          ctx.lineWidth = 3.5;
          ctx.strokeText(ln.text, tx, cy);
          ctx.fillStyle = ln.color;
          ctx.fillText(ln.text, tx, cy);
        }
        y += ln.h;
      }
    }
    ctx.globalAlpha = 1;
    if (this.letterSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }
}

export type { StarSystem };
