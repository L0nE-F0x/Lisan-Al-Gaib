/**
 * Shai-Hulud: a 2D sandworm scene.
 *
 *  - Everything is dt-based (seconds), so speed is identical at 30, 60 or 144 Hz.
 *  - Animates only while the section is on screen (shared loop + IntersectionObserver)
 *    and the tab is visible; idles back to a cheap dust-mote loop between summons.
 *  - DPR-aware with a ResizeObserver; dune layers are pre-rendered offscreen per size.
 *  - The worm comes only when the viewer presses "Plant a thumper" (never on stray taps).
 *  - Under reduced motion the scene is a static illustration, drawn once per resize.
 */
import { audio } from '../shared/audio.ts';
import { onFrameWhileVisible } from '../shared/loop.ts';
import { deviceTier, onReducedMotionChange, reducedMotion } from '../shared/prefs.ts';
import { clamp } from '../shared/dom.ts';

type Phase = 'idle' | 'calling' | 'breach' | 'settle';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface Mote {
  x: number;
  y: number;
  s: number;
  v: number;
  ph: number;
}

const CALL_TIME = 2.6; // seconds from thumper to breach
const SEGS = 46;
const SPACING = 0.016; // spine distance between segments, in arc units

export function initWorm(section: HTMLElement): void {
  const canvas = section.querySelector<HTMLCanvasElement>('#worm-canvas');
  const button = section.querySelector<HTMLButtonElement>('#worm-summon');
  const status = section.querySelector<HTMLElement>('#worm-status');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const tier = deviceTier();
  const maxDpr = tier === 'low' ? 1 : 2;
  let W = 1;
  let H = 1;
  let dpr = 1;
  let still = reducedMotion();

  // ------------------------------------------------------------------ terrain
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');

  /** Height of the middle ridge (where the worm surfaces) at x, in CSS px. */
  const ground = (x: number) => {
    const u = x / W;
    return H * 0.82 + (Math.sin(u * Math.PI * 2.3 + 2.1) * 0.6 + Math.sin(u * Math.PI * 6.2 + 5.3) * 0.4) * H * 0.022;
  };

  const ridge = (c: CanvasRenderingContext2D, base: number, amp: number, freq: number, seed: number, top: string, bottom: string) => {
    const g = c.createLinearGradient(0, H * (base - amp * 2), 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W + 6; x += 6) {
      const u = x / W;
      const n = Math.sin(u * Math.PI * freq + seed) * 0.6 + Math.sin(u * Math.PI * freq * 2.7 + seed * 2.5) * 0.4;
      c.lineTo(x, H * base + n * H * amp);
    }
    c.lineTo(W, H);
    c.closePath();
    c.fillStyle = g;
    c.fill();
  };

  const buildTerrain = () => {
    for (const layer of [back, front]) {
      layer.width = Math.max(1, Math.round(W * dpr));
      layer.height = Math.max(1, Math.round(H * dpr));
    }
    const b = back.getContext('2d')!;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, W, H);
    // Low sun on the horizon.
    const sun = b.createRadialGradient(W * 0.7, H * 0.7, 0, W * 0.7, H * 0.7, Math.max(W, H) * 0.6);
    sun.addColorStop(0, 'rgba(255,170,90,0.30)');
    sun.addColorStop(0.25, 'rgba(240,130,60,0.12)');
    sun.addColorStop(1, 'rgba(240,130,60,0)');
    b.fillStyle = sun;
    b.fillRect(0, 0, W, H);
    ridge(b, 0.72, 0.035, 1.4, 0.4, 'rgba(92,52,22,0.55)', 'rgba(52,28,12,0.9)');
    // Middle ridge, exactly matching ground().
    const g = b.createLinearGradient(0, H * 0.76, 0, H);
    g.addColorStop(0, 'rgba(70,38,16,1)');
    g.addColorStop(1, 'rgba(26,14,6,1)');
    b.beginPath();
    b.moveTo(0, H);
    for (let x = 0; x <= W + 6; x += 6) b.lineTo(x, ground(x));
    b.lineTo(W, H);
    b.closePath();
    b.fillStyle = g;
    b.fill();
    // Rim light along the crest.
    b.beginPath();
    for (let x = 0; x <= W + 6; x += 6) (x ? b.lineTo : b.moveTo).call(b, x, ground(x));
    b.strokeStyle = 'rgba(240,164,74,0.28)';
    b.lineWidth = 1.2;
    b.stroke();

    const f = front.getContext('2d')!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.clearRect(0, 0, W, H);
    ridge(f, 0.93, 0.03, 2.9, 3.3, 'rgba(22,12,5,0.96)', 'rgba(10,7,5,1)');
  };

  // ------------------------------------------------------------------ state
  let phase: Phase = 'idle';
  let t = 0; // time in phase
  let s = 0; // worm head progress along its arc
  let thumperX = 0;
  let arc = { x0: 0, span: 1, height: 1, r: 1 };
  const spray: Particle[] = [];
  const motes: Mote[] = Array.from({ length: tier === 'low' ? 18 : 42 }, () => ({
    x: Math.random(),
    y: 0.25 + Math.random() * 0.6,
    s: 0.6 + Math.random() * 1.4,
    v: 0.006 + Math.random() * 0.018,
    ph: Math.random() * Math.PI * 2,
  }));
  let clock = 0;

  const layoutArc = () => {
    const narrow = W < 640;
    thumperX = W * (narrow ? 0.16 : 0.3);
    const span = W * (narrow ? 0.9 : 0.58);
    arc = {
      x0: thumperX - span * 0.05,
      span,
      height: Math.min(H * 0.34, span * 0.5),
      r: Math.max(10, Math.min(W * 0.05, H * 0.055)),
    };
  };

  const spine = (sp: number) => {
    const x = arc.x0 + sp * arc.span;
    const k = clamp(sp, 0, 1);
    const lift = Math.pow(Math.sin(k * Math.PI), 0.8) * arc.height;
    const wig = Math.sin(sp * 19) * arc.r * 0.15;
    // Beyond the arc ends the spine continues underground.
    const under = sp < 0 ? -sp * arc.height * 1.2 : sp > 1 ? (sp - 1) * arc.height * 1.2 : 0;
    return { x, y: ground(x) + arc.r * 0.6 - lift + wig + under };
  };

  // ------------------------------------------------------------------ drawing
  const drawThumper = (alpha: number) => {
    if (alpha <= 0) return;
    const gx = thumperX;
    const gy = ground(gx);
    ctx.save();
    ctx.globalAlpha = alpha;
    // Pulses travelling outward across the sand.
    if (phase === 'calling') {
      for (let k = 0; k < 3; k++) {
        const p = ((t * 1.6 + k / 3) % 1 + 1) % 1;
        ctx.beginPath();
        ctx.ellipse(gx, gy + 2, 6 + p * arc.span * 0.35, 2 + p * 10, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,194,102,${(1 - p) * 0.45})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    const bob = phase === 'calling' ? Math.abs(Math.sin(t * Math.PI * 1.6)) * 3 : 0;
    ctx.strokeStyle = '#d9b98a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy + 2);
    ctx.lineTo(gx, gy - 22 - bob);
    ctx.stroke();
    ctx.fillStyle = '#f0a44a';
    ctx.fillRect(gx - 4, gy - 26 - bob, 8, 6);
    ctx.restore();
  };

  /** The worm sign: a travelling ridge of disturbed sand heading for the thumper. */
  const drawWormSign = () => {
    const k = clamp(t / CALL_TIME, 0, 1);
    const ease = k * k * (3 - 2 * k);
    const x = -W * 0.1 + (thumperX - arc.span * 0.04 + W * 0.1) * ease;
    const y = ground(x);
    const len = arc.span * 0.22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, len);
    g.addColorStop(0, 'rgba(120,72,32,0.85)');
    g.addColorStop(1, 'rgba(120,72,32,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x - len * 0.4, y - 2, len, 4 + ease * 6, 0, Math.PI, 0);
    ctx.fill();
    emit(x, y, 30 * ease + 6, 1.1, 0.5);
  };

  const emit = (x: number, y: number, rate: number, power: number, spread: number) => {
    if (still || spray.length > 420) return;
    const n = rate * currentDt + Math.random();
    for (let i = 0; i < Math.floor(n); i++) {
      spray.push({
        x: x + (Math.random() - 0.5) * arc.r * 3 * spread,
        y: y - Math.random() * 4,
        vx: (Math.random() - 0.5) * 140 * power,
        vy: -(60 + Math.random() * 220) * power,
        life: 1,
        size: 1 + Math.random() * 2.2,
      });
    }
  };

  const drawSpray = (dt: number) => {
    const grav = 520;
    ctx.fillStyle = '#d2ab72';
    for (let i = spray.length - 1; i >= 0; i--) {
      const p = spray[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += grav * dt;
      p.life -= dt * 1.1;
      if (p.life <= 0 || p.y > H) {
        spray[i] = spray[spray.length - 1];
        spray.pop();
        continue;
      }
      ctx.globalAlpha = p.life * 0.6;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  const drawWorm = (sHead: number) => {
    const pts = [];
    for (let i = 0; i < SEGS; i++) pts.push(spine(sHead - i * SPACING));

    // Clip to everything above the ridge so the body rises out of the sand itself.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (let x = W + 6; x >= -6; x -= 6) ctx.lineTo(x, ground(x));
    ctx.closePath();
    ctx.clip();

    const R = arc.r;
    const radius = (i: number) => R * (1 - 0.42 * Math.pow(i / SEGS, 1.4));

    // Underbody core so the rings read as one body.
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(28,16,7,0.95)';
    for (let i = SEGS - 2; i >= 0; i--) {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.lineWidth = radius(i) * 1.8;
      ctx.stroke();
    }

    // Segments, tail first.
    for (let i = SEGS - 1; i >= 0; i--) {
      const p = pts[i];
      const r = radius(i);
      const g = ctx.createRadialGradient(p.x - r * 0.25, p.y - r * 0.55, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, 'rgb(150,108,66)');
      g.addColorStop(0.5, 'rgb(86,56,30)');
      g.addColorStop(1, 'rgb(24,14,6)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.97, -Math.PI * 0.95, -Math.PI * 0.05);
        ctx.strokeStyle = 'rgba(255,194,102,0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.92, Math.PI * 0.1, Math.PI * 0.9);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Head: an open, tooth-ringed mouth facing the direction of travel.
    const h0 = pts[0];
    const h1 = pts[2];
    const ang = Math.atan2(h0.y - h1.y, h0.x - h1.x);
    const mx = h0.x + Math.cos(ang) * R * 0.55;
    const my = h0.y + Math.sin(ang) * R * 0.55;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.42, R * 1.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(46,30,16)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.06, 0, R * 0.3, R * 0.82, 0, 0, Math.PI * 2);
    const throat = ctx.createRadialGradient(R * 0.1, 0, 0, R * 0.1, 0, R * 0.8);
    throat.addColorStop(0, 'rgba(255,170,80,0.85)');
    throat.addColorStop(0.35, 'rgba(160,70,20,0.9)');
    throat.addColorStop(1, 'rgba(18,8,3,1)');
    ctx.fillStyle = throat;
    ctx.fill();
    // Crystal teeth around the rim.
    ctx.strokeStyle = 'rgba(245,230,200,0.85)';
    ctx.lineWidth = Math.max(1, R * 0.05);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const ex = Math.cos(a) * R * 0.3;
      const ey = Math.sin(a) * R * 0.82;
      ctx.beginPath();
      ctx.moveTo(ex + R * 0.06, ey);
      ctx.lineTo(ex * 0.55 + R * 0.06, ey * 0.62);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore(); // clip

    // Sand thrown up wherever the body pierces the surface.
    if (!still) {
      for (let i = 0; i < SEGS - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const ga = ground(a.x) + R * 0.2;
        const gb = ground(b.x) + R * 0.2;
        if ((a.y - ga) * (b.y - gb) < 0) emit(a.x, ga, 160, 1, 1);
      }
    }
  };

  const drawMotes = (dt: number) => {
    ctx.fillStyle = 'rgb(240,190,120)';
    for (const m of motes) {
      m.x += m.v * dt;
      if (m.x > 1.02) m.x = -0.02;
      const y = (m.y + Math.sin(clock * 0.4 + m.ph) * 0.008) * H;
      ctx.globalAlpha = 0.14 + Math.sin(clock + m.ph) * 0.1;
      ctx.fillRect(m.x * W, y, m.s, m.s);
    }
    ctx.globalAlpha = 1;
  };

  let currentDt = 0;
  const draw = (dt: number) => {
    currentDt = dt;
    clock += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(back, 0, 0, W, H);

    if (still) {
      drawWorm(0.6);
    } else {
      t += dt;
      if (phase === 'calling') {
        drawWormSign();
        drawThumper(1);
        if (t >= CALL_TIME) {
          phase = 'breach';
          t = 0;
          s = -0.08;
          audio.sfx('thump');
          quake();
          say('Shai-Hulud rises. The thumper is gone.');
        }
      } else if (phase === 'breach') {
        s += dt * 0.34 * (1 + Math.max(0, s) * 0.5);
        if (s < 0.1) drawThumper(clamp(1 - (s + 0.02) / 0.08, 0, 1));
        drawWorm(s);
        if (s - SEGS * SPACING > 1.08) {
          phase = 'settle';
          t = 0;
        }
      } else if (phase === 'settle' && t > 1.4 && spray.length === 0) {
        phase = 'idle';
        if (button) button.disabled = false;
        say('');
      }
      drawSpray(dt);
    }

    ctx.drawImage(front, 0, 0, W, H);
    if (!still) drawMotes(dt);
  };

  // ------------------------------------------------------------------ sizing
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    layoutArc();
    buildTerrain();
    draw(0);
  };
  let pending = 0;
  new ResizeObserver(() => {
    if (!pending) pending = requestAnimationFrame(() => {
      pending = 0;
      resize();
    });
  }).observe(canvas);
  resize();

  // ------------------------------------------------------------------ control
  let stopLoop: (() => void) | null = null;
  const startLoop = () => {
    if (!stopLoop && !still) stopLoop = onFrameWhileVisible(section, draw, '50px');
  };
  const stopAll = () => {
    stopLoop?.();
    stopLoop = null;
  };

  const say = (msg: string) => {
    if (status) status.textContent = msg;
  };

  const quake = () => {
    if (still) return;
    canvas.classList.remove('is-quaking');
    void canvas.offsetWidth; // restart the CSS animation
    canvas.classList.add('is-quaking');
  };

  const summon = () => {
    if (still || phase !== 'idle') return;
    phase = 'calling';
    t = 0;
    if (button) button.disabled = true;
    audio.sfx('thump');
    say('Thumper planted. Something is coming.');
  };

  const applyMotion = () => {
    if (button) button.hidden = still;
    if (still) {
      stopAll();
      phase = 'idle';
      spray.length = 0;
      say('');
      draw(0);
    } else {
      startLoop();
    }
  };

  button?.addEventListener('click', summon);
  onReducedMotionChange((r) => {
    still = r;
    applyMotion();
  });
  applyMotion();
}
