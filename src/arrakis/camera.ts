/**
 * Camera controller for the Arrakis globe: targets + frame-rate independent damping,
 * inertia, zoom-to-cursor on the flat map, cinematic fly-to, and the globe ⇄ map morph.
 *
 * All motion is expressed in time (seconds), never per frame.
 */
import type { ArrakisGlobe } from '../shared/globe/globe.ts';
import { wrapLon } from '../shared/globe/globe.ts';
import { clamp, damp } from '../shared/dom.ts';
import { reducedMotion } from '../shared/prefs.ts';

export type ViewMode = 'globe' | 'map';

const FOV = 35; // matches ArrakisGlobe's camera
const T = Math.tan((FOV / 2) * (Math.PI / 180));
const DIST_MIN = 1.25;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const LAT_MAX = 80;
const RATE_USER = 16;
const RATE_FLY = 2.6;
const MORPH_TIME = 1.2;

export class CameraController {
  private target = { lat: 22, lon: 0, dist: 3.2, zoom: 1 };
  private rate = RATE_USER;
  private vel = { lon: 0, lat: 0 };
  private lastPan = 0;
  private dragging = false;
  private morphFrom = 0;
  private morphTo = 0;
  private morphT = 1;
  private _mode: ViewMode = 'globe';
  private idle = 0;
  private interactFns = new Set<() => void>();
  /** Lens shift of the planet centre, as fractions of the canvas (see ArrakisGlobe.setFrameShift). */
  shift = { x: 0, y: 0 };

  constructor(private globe: ArrakisGlobe) {
    const v = globe.view;
    this.target = { lat: v.centerLat, lon: v.centerLon, dist: v.distance, zoom: v.flatZoom };
  }

  get mode(): ViewMode {
    return this._mode;
  }

  /** Seconds since the viewer last touched the map. */
  get idleTime(): number {
    return this.idle;
  }

  /** Roughly how zoomed-in we are, 0 (whole planet) .. 1 (close). Used to fade labels. */
  get closeness(): number {
    const v = this.globe.view;
    const home = this.homeDistance();
    const g = clamp((home - 0.3 - v.distance) / (home - 0.3 - DIST_MIN), 0, 1);
    const m = clamp((v.flatZoom - 1) / 4, 0, 1);
    return g * (1 - v.morph) + m * v.morph;
  }

  onInteract(fn: () => void): () => void {
    this.interactFns.add(fn);
    return () => this.interactFns.delete(fn);
  }

  private touched(): void {
    this.idle = 0;
    this.rate = RATE_USER;
    for (const f of this.interactFns) f();
  }

  /** Jump without animation (initial state, reduced motion). */
  snap(): void {
    const v = this.globe.view;
    v.centerLat = this.target.lat;
    v.centerLon = this.target.lon;
    v.distance = this.target.dist;
    v.flatZoom = this.target.zoom;
  }

  setInitial(o: { lat?: number; lon?: number; dist?: number; zoom?: number }): void {
    Object.assign(this.target, o);
    this.clampTarget();
  }

  setMode(mode: ViewMode, instant = reducedMotion()): void {
    if (mode === this._mode && this.morphT >= 1 && !instant) return;
    this._mode = mode;
    const to = mode === 'map' ? 1 : 0;
    if (mode === 'map') {
      // On portrait screens, open the map tall enough to read instead of a thin strip.
      const fill = this.fillHeightZoom();
      if (this.target.zoom < fill * 0.92) this.target.zoom = clamp(fill * 0.92, ZOOM_MIN, ZOOM_MAX);
      // Carry the zoom level across so the transition feels continuous.
      const home = this.homeDistance();
      const g = clamp((home - this.target.dist) / (home - DIST_MIN), 0, 1);
      this.target.zoom = clamp(Math.max(this.target.zoom, 1 + g * 3), ZOOM_MIN, ZOOM_MAX);
    } else {
      // Back to the globe at a distance that matches how far in the map was zoomed.
      const home = this.homeDistance();
      this.target.dist = clamp(home - (this.target.zoom - 1) * (home - 1.7) / 4, 1.7, home);
    }
    this.clampTarget();
    if (instant) {
      this.morphT = 1;
      this.globe.view.morph = to;
      this.snap();
    } else {
      this.morphFrom = this.globe.view.morph;
      this.morphTo = to;
      this.morphT = 0;
    }
  }

  /** Fly to a point. `close` picks a comfortable zoom for reading a single place. */
  flyTo(lat: number, lon: number, opts: { dist?: number; zoom?: number; instant?: boolean } = {}): void {
    this.vel.lon = this.vel.lat = 0;
    this.target.lat = lat;
    this.target.lon = lon;
    if (opts.dist !== undefined) this.target.dist = opts.dist;
    if (opts.zoom !== undefined) this.target.zoom = opts.zoom;
    this.clampTarget();
    this.idle = 0;
    if (opts.instant ?? reducedMotion()) {
      this.snap();
      this.rate = RATE_USER;
    } else {
      this.rate = RATE_FLY;
    }
  }

  /** Current zoom targets, for callers that want "at least this close". */
  get targetDist(): number {
    return this.target.dist;
  }
  get targetZoom(): number {
    return this.target.zoom;
  }

  pan(dx: number, dy: number): void {
    this.touched();
    const k = this.degPerPx();
    const dLon = -dx * k;
    const dLat = dy * k;
    this.target.lon = wrapLon(this.target.lon + dLon);
    this.target.lat += dLat;
    this.clampTarget();
    if (this.dragging) {
      const now = performance.now();
      const dt = Math.max(0.008, (now - this.lastPan) / 1000);
      this.lastPan = now;
      // Smoothed velocity estimate for inertia.
      const a = 0.35;
      this.vel.lon = this.vel.lon * (1 - a) + (dLon / dt) * a;
      this.vel.lat = this.vel.lat * (1 - a) + (dLat / dt) * a;
    }
  }

  dragStart(): void {
    this.touched();
    this.dragging = true;
    this.lastPan = performance.now();
    this.vel.lon = this.vel.lat = 0;
  }

  dragEnd(): void {
    this.dragging = false;
    // A pause before release means no fling.
    if (performance.now() - this.lastPan > 90 || reducedMotion()) this.vel.lon = this.vel.lat = 0;
    const max = 240;
    this.vel.lon = clamp(this.vel.lon, -max, max);
    this.vel.lat = clamp(this.vel.lat, -max, max);
  }

  /** factor > 1 zooms in. (cx, cy) in CSS px of the canvas, or undefined for the centre. */
  zoomBy(factor: number, cx?: number, cy?: number): void {
    this.touched();
    const { width, height } = this.globe.size;
    if (this._mode === 'map') {
      const k0 = this.flatDegPerPx(this.target.zoom);
      this.target.zoom = clamp(this.target.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      const k1 = this.flatDegPerPx(this.target.zoom);
      if (cx !== undefined && cy !== undefined) {
        const ox = cx - width * (0.5 + this.shift.x);
        const oy = cy - height * (0.5 + this.shift.y);
        this.target.lon = wrapLon(this.target.lon + ox * (k0 - k1));
        this.target.lat = this.target.lat - oy * (k0 - k1);
      }
    } else {
      const before = this.target.dist;
      this.target.dist = clamp(1 + (this.target.dist - 1) / factor, DIST_MIN, this.distMax());
      // Drift gently toward the cursor when zooming in, like leaning in to look.
      if (factor > 1 && cx !== undefined && cy !== undefined && before !== this.target.dist) {
        const hit = this.globe.pick(cx, cy);
        if (hit) {
          const f = (1 - 1 / factor) * 0.55;
          this.target.lon = wrapLon(this.target.lon + wrapLon(hit.lon - this.target.lon) * f);
          this.target.lat += (hit.lat - this.target.lat) * f;
        }
      }
    }
    this.clampTarget();
  }

  update(dt: number): void {
    const v = this.globe.view;
    this.idle += dt;

    // Inertia.
    if (!this.dragging && (this.vel.lon !== 0 || this.vel.lat !== 0)) {
      this.target.lon = wrapLon(this.target.lon + this.vel.lon * dt);
      this.target.lat += this.vel.lat * dt;
      this.clampTarget();
      const decay = Math.exp(-3.2 * dt);
      this.vel.lon *= decay;
      this.vel.lat *= decay;
      if (Math.abs(this.vel.lon) < 0.3 && Math.abs(this.vel.lat) < 0.3) this.vel.lon = this.vel.lat = 0;
    }

    // Morph tween (eased, time based).
    if (this.morphT < 1) {
      this.morphT = Math.min(1, this.morphT + dt / MORPH_TIME);
      const t = this.morphT;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      v.morph = this.morphFrom + (this.morphTo - this.morphFrom) * e;
      if (this.morphT >= 1) this.clampTarget();
    }

    const k = damp(this.rate, dt);
    v.centerLon = wrapLon(v.centerLon + wrapLon(this.target.lon - v.centerLon) * k);
    v.centerLat += (this.target.lat - v.centerLat) * k;
    // Zoom damps in log space so it feels even at every scale.
    v.distance = 1 + (v.distance - 1) * Math.pow((this.target.dist - 1) / (v.distance - 1), k);
    v.flatZoom = v.flatZoom * Math.pow(this.target.zoom / v.flatZoom, k);

    if (this.rate !== RATE_USER) {
      const rest =
        Math.abs(wrapLon(this.target.lon - v.centerLon)) + Math.abs(this.target.lat - v.centerLat) + Math.abs(this.target.dist - v.distance) * 20;
      if (rest < 0.05) this.rate = RATE_USER;
    }
  }

  /** Slow idle spin (never under reduced motion; caller decides when). */
  autoRotate(dt: number, degPerSec: number): void {
    this.target.lon = wrapLon(this.target.lon + degPerSec * dt);
  }

  // ---------------------------------------------------------------------------

  /** Camera distance at which the globe's radius is `frac` of the smaller viewport side. */
  fitDistance(frac: number): number {
    const { width, height } = this.globe.size;
    const r = frac * Math.min(width, height);
    const tanA = (r / (height / 2)) * T;
    return Math.sqrt(1 + 1 / (tanA * tanA));
  }

  /** A comfortable whole-planet distance for this screen. */
  homeDistance(): number {
    return Math.max(3.4, this.fitDistance(0.4));
  }

  private distMax(): number {
    return Math.max(6, this.fitDistance(0.26));
  }

  private degPerPx(): number {
    const v = this.globe.view;
    if (this._mode === 'map') return this.flatDegPerPx(v.flatZoom);
    const { height } = this.globe.size;
    const d = Math.max(v.distance, 1.01);
    const tanA = 1 / Math.sqrt(d * d - 1);
    const rPx = (tanA / T) * (height / 2);
    return 180 / Math.PI / Math.max(rPx, 1);
  }

  private flatDistance(): number {
    const { width, height } = this.globe.size;
    const aspect = width / height;
    const fitW = 2 / (T * aspect);
    const fitH = 1 / T;
    return Math.min(fitW, fitH * 1.02);
  }

  private flatDegPerPx(zoom: number): number {
    const { height } = this.globe.size;
    const dist = this.flatDistance() / zoom;
    return (dist * T * 180) / Math.max(height, 1);
  }

  /** Zoom at which the map's height fills the viewport. */
  private fillHeightZoom(): number {
    const halfHdeg = this.flatDistance() * T * 90;
    return Math.max(1, halfHdeg / 90);
  }

  private clampTarget(): void {
    const t = this.target;
    t.dist = clamp(t.dist, DIST_MIN, this.distMax());
    t.zoom = clamp(t.zoom, ZOOM_MIN, ZOOM_MAX);
    if (this._mode === 'map') {
      const halfHdeg = (this.flatDistance() / t.zoom) * T * 90;
      const lim = Math.max(0, 90 - halfHdeg);
      t.lat = clamp(t.lat, -lim, lim);
    } else {
      t.lat = clamp(t.lat, -LAT_MAX, LAT_MAX);
    }
  }
}
