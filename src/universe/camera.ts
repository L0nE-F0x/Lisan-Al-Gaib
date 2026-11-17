/**
 * 2D map camera with frame-rate independent damping.
 *
 * (x, y) is the world point shown at the focal point (fx, fy), which is the centre of the
 * unobstructed part of the screen (it moves when the details sheet opens).
 * Zoom = CSS pixels per world unit. Zoom is damped in log space.
 */
import { clamp, damp } from '../shared/dom.ts';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type FollowFn = () => { x: number; y: number } | null;

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  tx = 0;
  ty = 0;
  tz = 1;
  vw = 1;
  vh = 1;
  fx = 0.5;
  fy = 0.5;
  private tfx = 0.5;
  private tfy = 0.5;
  minZ = 0.1;
  maxZ = 90;

  private follow: FollowFn | null = null;
  /** Remaining offset from the target, damped toward zero (tracks moving targets without lag). */
  private ox = 0;
  private oy = 0;
  private flying = false;
  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private panRate = 9;
  private zoomRate = 12;

  constructor(private bounds: Bounds) {}

  get following(): boolean {
    return this.follow !== null;
  }

  resize(w: number, h: number): void {
    const first = this.vw <= 1;
    this.vw = Math.max(1, w);
    this.vh = Math.max(1, h);
    const bw = this.bounds.maxX - this.bounds.minX;
    const bh = this.bounds.maxY - this.bounds.minY;
    this.minZ = Math.min(this.vw / bw, this.vh / bh) * 0.95;
    this.tz = clamp(this.tz, this.minZ, this.maxZ);
    this.zoom = clamp(this.zoom, this.minZ, this.maxZ);
    if (first) {
      this.fx = this.tfx = this.vw / 2;
      this.fy = this.tfy = this.vh / 2;
    }
  }

  /** Set the unobstructed screen region (CSS px). */
  private insets = { top: 0, right: 0, bottom: 0, left: 0 };

  /** Zoom that fits the whole map inside the unobstructed region. */
  fitZoom(): number {
    const { top, right, bottom, left } = this.insets;
    const bw = this.bounds.maxX - this.bounds.minX;
    const bh = this.bounds.maxY - this.bounds.minY;
    const z = Math.min(Math.max(100, this.vw - left - right) / bw, Math.max(100, this.vh - top - bottom) / bh) * 1.02;
    return Math.max(this.minZ, z);
  }

  setInsets(top: number, right: number, bottom: number, left: number, instant = false): void {
    this.insets = { top, right, bottom, left };
    this.tfx = left + (this.vw - left - right) / 2;
    this.tfy = top + (this.vh - top - bottom) / 2;
    if (instant) {
      this.fx = this.tfx;
      this.fy = this.tfy;
    }
  }

  /** Smallest side of the unobstructed region, for "fit" zoom calculations. */
  get viewMin(): number {
    return Math.max(120, Math.min(this.vw, this.vh, 2 * this.tfx, 2 * this.tfy, 2 * (this.vw - this.tfx), 2 * (this.vh - this.tfy)));
  }

  toScreenX(wx: number): number {
    return (wx - this.x) * this.zoom + this.fx;
  }
  toScreenY(wy: number): number {
    return (wy - this.y) * this.zoom + this.fy;
  }
  toWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.fx) / this.zoom + this.x, y: (sy - this.fy) / this.zoom + this.y };
  }

  /** Direct manipulation (drag): moves immediately and stops following. */
  dragBy(dx: number, dy: number): void {
    this.release();
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clampXY();
    this.tx = this.x;
    this.ty = this.y;
    this.ox = this.oy = 0;
  }

  /** Smooth pan (keyboard). */
  nudge(dx: number, dy: number, instant: boolean): void {
    this.release();
    this.tx -= dx / this.zoom;
    this.ty -= dy / this.zoom;
    this.clampTarget();
    this.ox = this.x - this.tx;
    this.oy = this.y - this.ty;
    this.panRate = 10;
    if (instant) this.snap();
  }

  zoomAt(factor: number, sx: number, sy: number, instant: boolean): void {
    const nz = clamp(this.tz * factor, this.minZ, this.maxZ);
    if (nz === this.tz) return;
    this.tz = nz;
    this.zoomRate = 12;
    this.flying = false;
    if (this.follow) {
      this.anchor = null; // zoom about the followed body
    } else {
      const w = this.toWorld(sx, sy);
      this.anchor = { sx, sy, wx: w.x, wy: w.y };
    }
    if (instant) this.snap();
  }

  /** Fly to a fixed point or follow a moving target, ending at zoom `z`. */
  flyTo(target: FollowFn | { x: number; y: number }, z: number | null, opts: { instant?: boolean; slow?: boolean } = {}): void {
    this.anchor = null;
    if (typeof target === 'function') {
      this.follow = target;
      const p = target();
      if (p) {
        this.tx = p.x;
        this.ty = p.y;
      }
    } else {
      this.follow = null;
      this.tx = target.x;
      this.ty = target.y;
    }
    if (z !== null) this.tz = clamp(z, this.minZ, this.maxZ);
    this.clampTarget();
    this.ox = this.x - this.tx;
    this.oy = this.y - this.ty;
    this.flying = true;
    this.panRate = opts.slow ? 1.6 : 3.4;
    this.zoomRate = opts.slow ? 1.4 : 3;
    if (opts.instant) this.snap();
  }

  /** Change who is followed without a new flight (keeps zoom). */
  setFollow(fn: FollowFn | null): void {
    if (fn === this.follow) return;
    this.follow = fn;
    this.anchor = null;
    if (fn) {
      const p = fn();
      if (p) {
        this.tx = p.x;
        this.ty = p.y;
        this.clampTarget();
      }
      this.ox = this.x - this.tx;
      this.oy = this.y - this.ty;
      this.flying = true;
      this.panRate = 3.4;
    }
  }

  release(): void {
    this.follow = null;
    this.flying = false;
    this.anchor = null;
    this.tx = this.x;
    this.ty = this.y;
    this.ox = this.oy = 0;
  }

  snap(): void {
    if (this.follow) {
      const p = this.follow();
      if (p) {
        this.tx = p.x;
        this.ty = p.y;
      }
    }
    this.clampTarget();
    this.x = this.tx;
    this.y = this.ty;
    this.ox = this.oy = 0;
    if (this.anchor) {
      this.zoom = this.tz;
      this.x = this.anchor.wx - (this.anchor.sx - this.fx) / this.zoom;
      this.y = this.anchor.wy - (this.anchor.sy - this.fy) / this.zoom;
      this.clampXY();
      this.tx = this.x;
      this.ty = this.y;
      this.anchor = null;
    }
    this.zoom = this.tz;
    this.fx = this.tfx;
    this.fy = this.tfy;
    this.ox = this.oy = 0;
    this.flying = false;
  }

  /** Advance one frame. Returns true while anything is still moving. */
  update(dt: number): boolean {
    let moving = false;
    const kf = damp(8, dt);
    if (Math.abs(this.tfx - this.fx) > 0.2 || Math.abs(this.tfy - this.fy) > 0.2) {
      this.fx += (this.tfx - this.fx) * kf;
      this.fy += (this.tfy - this.fy) * kf;
      moving = true;
    } else {
      this.fx = this.tfx;
      this.fy = this.tfy;
    }

    if (this.follow) {
      const p = this.follow();
      if (p) {
        const ptx = this.tx;
        const pty = this.ty;
        this.tx = p.x;
        this.ty = p.y;
        this.clampTarget();
        // A discontinuous target (e.g. switching from a planet to its star) becomes a smooth glide.
        if (Math.hypot(this.tx - ptx, this.ty - pty) * this.zoom > 60) {
          this.ox += ptx - this.tx;
          this.oy += pty - this.ty;
        }
      }
    }

    // During a long flight, zoom out enough to keep both ends in view ("hop").
    let ztarget = this.tz;
    if (this.flying) {
      const dist = Math.hypot(this.ox, this.oy);
      if (dist > 1e-3) ztarget = Math.min(this.tz, Math.max(this.minZ, (this.viewMin * 0.9) / dist));
    }

    const lz = Math.log(this.zoom);
    const lt = Math.log(ztarget);
    if (Math.abs(lt - lz) > 0.0015) {
      this.zoom = Math.exp(lz + (lt - lz) * damp(this.zoomRate, dt));
      moving = true;
    } else {
      this.zoom = ztarget;
    }

    if (this.anchor) {
      this.x = this.anchor.wx - (this.anchor.sx - this.fx) / this.zoom;
      this.y = this.anchor.wy - (this.anchor.sy - this.fy) / this.zoom;
      this.clampXY();
      this.tx = this.x;
      this.ty = this.y;
      this.ox = this.oy = 0;
      if (this.zoom === this.tz) this.anchor = null;
    } else {
      const px = Math.hypot(this.ox, this.oy) * this.zoom;
      if (px > 0.25) {
        const k = 1 - damp(this.panRate, dt);
        this.ox *= k;
        this.oy *= k;
        moving = true;
      } else {
        this.ox = this.oy = 0;
        if (this.zoom === this.tz) this.flying = false;
      }
      const nx = this.tx + this.ox;
      const ny = this.ty + this.oy;
      if (nx !== this.x || ny !== this.y) moving = true;
      this.x = nx;
      this.y = ny;
    }
    if (this.flying && !moving) this.flying = false;
    return moving || this.anchor !== null;
  }

  private clampTarget(): void {
    this.tx = clamp(this.tx, this.bounds.minX, this.bounds.maxX);
    this.ty = clamp(this.ty, this.bounds.minY, this.bounds.maxY);
  }
  private clampXY(): void {
    this.x = clamp(this.x, this.bounds.minX, this.bounds.maxX);
    this.y = clamp(this.y, this.bounds.minY, this.bounds.maxY);
  }
}
