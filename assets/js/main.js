/* ============================================================
   DUNE IMPERIUM — Imperial Archives gateway
   Preloader, countdown, reveals, sandworm, ambience, cursor
   ============================================================ */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = window.matchMedia('(pointer: fine)').matches;
const PART_THREE_DATE = new Date(2026, 11, 18, 0, 0, 0); // Dec 18, 2026 local

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ============================================================
   DESERT AMBIENCE — procedural WebAudio (wind + drone + thump)
   ============================================================ */
const ambience = {
  ctx: null,
  master: null,
  on: false,
  built: false,

  build() {
    if (this.built) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // --- shared noise buffer ---
    const len = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // pinkish noise
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 3.2;
    }

    // --- wind: noise -> bandpass swept by LFO ---
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.9;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.16;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(windFilter.frequency);

    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 0.07;
    lfo2.connect(lfo2Gain).connect(windGain.gain);

    windSrc.connect(windFilter).connect(windGain).connect(this.master);

    // --- deep drone: detuned low oscillators (Zimmer-style) ---
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.055;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 240;

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55; // A1
    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 82.41; // E2
    const oscC = ctx.createOscillator();
    oscC.type = 'sine';
    oscC.frequency.value = 55.4; // slow beating against A

    const droneLFO = ctx.createOscillator();
    droneLFO.frequency.value = 0.05;
    const droneLFOGain = ctx.createGain();
    droneLFOGain.gain.value = 0.02;
    droneLFO.connect(droneLFOGain).connect(droneGain.gain);

    oscA.connect(droneFilter);
    oscB.connect(droneFilter);
    oscC.connect(droneFilter);
    droneFilter.connect(droneGain).connect(this.master);

    windSrc.start();
    lfo.start();
    lfo2.start();
    oscA.start();
    oscB.start();
    oscC.start();
    droneLFO.start();

    this.built = true;
  },

  start() {
    this.build();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0.85, this.ctx.currentTime, 1.2);
    this.on = true;
  },

  stop() {
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.4);
    this.on = false;
  },

  toggle() {
    this.on ? this.stop() : this.start();
    return this.on;
  },

  /* sandworm breach — sub-bass thump + grit noise */
  thump() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(46, t);
    osc.frequency.exponentialRampToValueAtTime(19, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 1.7);

    const len = ctx.sampleRate * 0.9;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 140;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(f).connect(ng).connect(this.master);
    src.start(t);
  },
};

/* ============================================================
   SOUND TOGGLE
   ============================================================ */
function initSoundToggle() {
  const btn = $('#sound-toggle');
  const label = $('#sound-label');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const on = ambience.toggle();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Sound On' : 'Sound Off';
  });
}

/* ============================================================
   PRELOADER
   ============================================================ */
function initPreloader(onEnter) {
  const pre = $('#preloader');
  const title = $('#pre-title');
  const fill = $('#pre-fill');
  const enterBtn = $('#enter-btn');

  'THE SPICE MUST FLOW'.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.style.setProperty('--i', i);
    span.innerHTML = ch === ' ' ? '&nbsp;' : ch;
    title.appendChild(span);
  });

  let texProgress = 0;
  const start = performance.now();
  const MIN_TIME = REDUCED ? 400 : 2100;
  let ready = false;

  const tick = () => {
    const timeP = Math.min((performance.now() - start) / MIN_TIME, 1);
    const p = Math.max(Math.min(timeP, texProgress || timeP * 0.7), timeP * 0.25);
    fill.style.transform = `scaleX(${Math.max(timeP * 0.4, p)})`;
    if (timeP >= 1 && !ready) {
      ready = true;
      fill.style.transform = 'scaleX(1)';
      enterBtn.classList.add('ready');
    } else if (!ready) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);

  const enter = () => {
    if (!ready) return;
    pre.classList.add('done');
    document.body.classList.remove('locked');
    document.body.classList.add('entered');
    $$('.hero-title span').forEach((s) => s.classList.add('lit'));
    $('#site-header').classList.add('show');
    ambience.start(); // click = user gesture, audio allowed
    const btn = $('#sound-toggle');
    if (btn && ambience.on) {
      btn.classList.add('on');
      btn.setAttribute('aria-pressed', 'true');
      $('#sound-label').textContent = 'Sound On';
    }
    onEnter?.();
  };
  enterBtn.addEventListener('click', enter);

  // safety: if something hangs, enable enter anyway
  setTimeout(() => {
    if (!ready) {
      ready = true;
      enterBtn.classList.add('ready');
    }
  }, 6000);

  return {
    setTextureProgress(p) { texProgress = p; },
  };
}

/* ============================================================
   HERO SCENE BOOT
   ============================================================ */
async function initHeroScene(preloader) {
  const canvas = $('#gl');
  try {
    const { initHero } = await import('./hero-scene.js');
    const scene = initHero(canvas, {
      onTextureProgress: (p) => preloader.setTextureProgress(p),
      onError: () => document.body.classList.add('no-webgl'),
    });
    if (!scene) {
      document.body.classList.add('no-webgl');
      return;
    }

    const hero = $('#hero');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const h = window.innerHeight;
        const p = Math.min(Math.max(window.scrollY / h, 0), 1);
        scene.setScroll(p);
        canvas.style.opacity = String(1 - p * 0.88);

        const header = $('#site-header');
        header.classList.toggle('scrolled', window.scrollY > 60);

        // hide canvas entirely once deep in the page
        const past = window.scrollY > h * 1.35;
        canvas.style.visibility = past ? 'hidden' : 'visible';
        hero.style.pointerEvents = p > 0.6 ? 'none' : 'auto';
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } catch (err) {
    console.warn('WebGL unavailable, using fallback backdrop.', err);
    document.body.classList.add('no-webgl');
  }
}

/* ============================================================
   COUNTDOWN — Dune: Part Three, Dec 18 2026
   ============================================================ */
function initCountdown() {
  const cells = {
    d: $('#cd-days'),
    h: $('#cd-hours'),
    m: $('#cd-mins'),
    s: $('#cd-secs'),
  };
  const chip = $('#hero-count');
  const pad = (n, w = 2) => String(n).padStart(w, '0');

  const update = () => {
    const diff = PART_THREE_DATE - Date.now();
    if (diff <= 0) {
      cells.d.textContent = '000';
      cells.h.textContent = '00';
      cells.m.textContent = '00';
      cells.s.textContent = '00';
      chip.textContent = 'PART THREE — IN THEATERS NOW';
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000) % 24;
    const mins = Math.floor(diff / 60000) % 60;
    const secs = Math.floor(diff / 1000) % 60;
    cells.d.textContent = pad(days, 3);
    cells.h.textContent = pad(hours);
    cells.m.textContent = pad(mins);
    cells.s.textContent = pad(secs);
    chip.textContent = `PART THREE — ${days}D ${pad(hours)}H ${pad(mins)}M`;
  };
  update();
  setInterval(update, 1000);
}

/* ============================================================
   SCROLL REVEALS
   ============================================================ */
function initReveals() {
  const els = $$('.reveal, .lit-line');
  if (REDUCED) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );
  els.forEach((el) => io.observe(el));
}

/* ============================================================
   HOUSE CARD TILT
   ============================================================ */
function initTilt() {
  if (!FINE_POINTER || REDUCED) return;
  $$('.house-card').forEach((card) => {
    let rx = 0, ry = 0, trx = 0, try_ = 0, raf = null;

    const loop = () => {
      rx += (trx - rx) * 0.12;
      ry += (try_ - ry) * 0.12;
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      if (Math.abs(trx - rx) > 0.02 || Math.abs(try_ - ry) > 0.02) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      trx = -py * 7;
      try_ = px * 9;
      kick();
    });
    card.addEventListener('mouseleave', () => {
      trx = 0;
      try_ = 0;
      kick();
    });
  });
}

/* ============================================================
   CUSTOM CURSOR
   ============================================================ */
function initCursor() {
  if (!FINE_POINTER || REDUCED) return;
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  let x = -100, y = -100, rx = -100, ry = -100;

  window.addEventListener('mousemove', (e) => {
    x = e.clientX;
    y = e.clientY;
    dot.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
  }, { passive: true });

  const loop = () => {
    rx += (x - rx) * 0.16;
    ry += (y - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  };
  loop();

  document.addEventListener('mouseover', (e) => {
    const hot = e.target.closest('a, button, .house-card, input, kbd');
    document.body.classList.toggle('cursor-hot', !!hot);
  });
}

/* ============================================================
   PORTAL TRANSITIONS
   ============================================================ */
function initTransitions() {
  const screen = $('#transition-screen');
  const text = $('#transition-text');
  $$('a[data-transition]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      text.textContent = link.dataset.transition || 'Routing Connection...';
      text.style.color = link.classList.contains('portal-universe') ? '#7dd3fc' : '#f0a44a';
      screen.classList.add('active');
      setTimeout(() => { window.location.href = link.href; }, 950);
    });
  });
}

/* ============================================================
   SHAI-HULUD — procedural sandworm
   ============================================================ */
function initWorm() {
  const canvas = $('#worm-canvas');
  const section = $('#shai-hulud');
  if (!canvas || !section) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ---- dune silhouettes (static, drawn to offscreen once) ---- */
  const duneLayer = document.createElement('canvas');
  const buildDunes = () => {
    duneLayer.width = W * dpr;
    duneLayer.height = H * dpr;
    const dctx = duneLayer.getContext('2d');
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, W, H);

    const ridges = [
      { base: 0.78, amp: 0.05, colTop: 'rgba(58,32,12,0.0)', colBot: 'rgba(46,25,10,0.85)', freq: 1.6 },
      { base: 0.86, amp: 0.04, colTop: 'rgba(38,20,8,0.9)', colBot: 'rgba(24,12,5,0.98)', freq: 2.3 },
      { base: 0.94, amp: 0.03, colTop: 'rgba(20,10,4,0.95)', colBot: 'rgba(10,5,2,1)', freq: 3.1 },
    ];
    ridges.forEach((r, idx) => {
      const grad = dctx.createLinearGradient(0, H * (r.base - 0.12), 0, H);
      grad.addColorStop(0, r.colTop);
      grad.addColorStop(1, r.colBot);
      dctx.beginPath();
      dctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) {
        const n = Math.sin((x / W) * Math.PI * r.freq + idx * 2.1) * 0.6
                + Math.sin((x / W) * Math.PI * r.freq * 2.7 + idx * 5.3) * 0.4;
        dctx.lineTo(x, H * r.base + n * H * r.amp);
      }
      dctx.lineTo(W, H);
      dctx.closePath();
      dctx.fillStyle = grad;
      dctx.fill();
    });

    // spice glow on the horizon
    const glow = dctx.createRadialGradient(W / 2, H * 0.8, 10, W / 2, H * 0.8, W * 0.5);
    glow.addColorStop(0, 'rgba(240,164,74,0.10)');
    glow.addColorStop(1, 'rgba(240,164,74,0)');
    dctx.fillStyle = glow;
    dctx.fillRect(0, 0, W, H);
  };
  buildDunes();
  window.addEventListener('resize', buildDunes, { passive: true });

  /* ---- ambient dust motes ---- */
  const MOTES = REDUCED ? 0 : 40;
  const motes = Array.from({ length: MOTES }, () => ({
    x: Math.random(), y: 0.3 + Math.random() * 0.65,
    s: 0.4 + Math.random() * 1.4, v: 0.00008 + Math.random() * 0.00025,
    ph: Math.random() * Math.PI * 2,
  }));

  /* ---- worm state ---- */
  const SEGS = 34;
  const worm = {
    active: false,
    s: 0,               // head progress 0..1+
    speed: 0.0016,
    maxH: 0.34,         // breach height as fraction of H
    nextAuto: performance.now() + 6000,
    cooldown: [9000, 17000],
  };

  // sand spray particles
  const spray = [];

  function breach() {
    if (worm.active || REDUCED) return;
    worm.active = true;
    worm.s = 0;
    worm.maxH = 0.26 + Math.random() * 0.16;
    ambience.thump();
    document.body.classList.add('rumble');
    setTimeout(() => document.body.classList.remove('rumble'), 520);
  }

  // worm spine point at progress s (head) minus trail offset
  function spinePoint(sHead, back) {
    const s = sHead - back;
    const x = (-0.22 + s * 1.44) * W;
    const arc = Math.pow(Math.sin(Math.min(Math.max(s, 0), 1) * Math.PI), 0.75);
    const wig = Math.sin(s * 21) * 0.012 * H;
    const y = H * 0.9 - arc * worm.maxH * H - wig;
    return { x, y, s };
  }

  function drawWorm() {
    if (!worm.active) return;
    worm.s += worm.speed * (1 + worm.s * 0.6);
    if (worm.s > 1.45) {
      worm.active = false;
      worm.nextAuto = performance.now() + worm.cooldown[0] + Math.random() * (worm.cooldown[1] - worm.cooldown[0]);
      return;
    }

    const pts = [];
    for (let i = 0; i < SEGS; i++) pts.push(spinePoint(worm.s, i * 0.011));

    // ground shadow glow beneath the arc
    const headS = Math.min(Math.max(worm.s, 0), 1);
    const gx = (-0.22 + headS * 1.44) * W;
    const glow = ctx.createRadialGradient(gx, H * 0.9, 4, gx, H * 0.9, W * 0.16);
    glow.addColorStop(0, 'rgba(240,140,50,0.16)');
    glow.addColorStop(1, 'rgba(240,140,50,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(gx - W * 0.2, H * 0.7, W * 0.4, H * 0.25);

    // unified under-body core (kills the "beads on a string" look)
    ctx.lineCap = 'round';
    for (let i = SEGS - 2; i >= 0; i--) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (p1.s < -0.05 || p1.s > 1.05) continue;
      const t = i / SEGS;
      const r = Math.sin(Math.min(t * 1.25, 1) * Math.PI) * H * 0.052 + H * 0.004;
      const sub = p1.s > 0.82 ? Math.max(0.15, 1 - (p1.s - 0.82) * 3.4) : 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = r * 1.75;
      ctx.strokeStyle = `rgba(24,12,4,${0.92 * sub})`;
      ctx.stroke();
    }

    // body — tail first
    for (let i = SEGS - 1; i >= 0; i--) {
      const p = pts[i];
      if (p.s < -0.05 || p.s > 1.05) continue;
      const t = i / SEGS;
      const r = Math.sin(Math.min(t * 1.25, 1) * Math.PI) * H * 0.052 + H * 0.004;
      const submerge = p.s > 0.82 ? Math.max(0.15, 1 - (p.s - 0.82) * 3.4) : 1;

      const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.55, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, `rgba(96,54,20,${0.95 * submerge})`);
      grad.addColorStop(0.55, `rgba(52,28,10,${0.95 * submerge})`);
      grad.addColorStop(1, `rgba(18,9,3,${0.95 * submerge})`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // amber rim light on the lower edge
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = `rgba(240,164,74,${0.22 * submerge})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // ring segments (segments of the Maker)
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.96, -Math.PI * 0.4, Math.PI * 1.4);
        ctx.strokeStyle = `rgba(0,0,0,${0.25 * submerge})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // sand spray around the leading contact points
    if (!REDUCED) {
      const h = pts[2];
      for (let k = 0; k < 3; k++) {
        spray.push({
          x: h.x + (Math.random() - 0.5) * 60,
          y: Math.min(h.y + 20, H * 0.92),
          vx: (Math.random() - 0.5) * 3.4,
          vy: -Math.random() * 4.5 - 1,
          life: 1,
          size: 1 + Math.random() * 2.4,
        });
      }
    }
  }

  function drawSpray() {
    for (let i = spray.length - 1; i >= 0; i--) {
      const p = spray[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.16;
      p.life -= 0.022;
      if (p.life <= 0 || p.y > H) { spray.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * 0.55;
      ctx.fillStyle = '#c8a05e';
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(t) {
    ctx.fillStyle = 'rgba(240,190,120,0.5)';
    motes.forEach((m) => {
      m.x += m.v;
      if (m.x > 1.02) m.x = -0.02;
      const y = (m.y + Math.sin(t * 0.0004 + m.ph) * 0.008) * H;
      ctx.globalAlpha = 0.12 + Math.sin(t * 0.001 + m.ph) * 0.1;
      ctx.fillRect(m.x * W, y, m.s, m.s);
    });
    ctx.globalAlpha = 1;
  }

  let visible = false;
  const io = new IntersectionObserver(
    (entries) => { visible = entries[0].isIntersecting; },
    { threshold: 0.05 }
  );
  io.observe(section);

  const frame = (t) => {
    requestAnimationFrame(frame);
    if (!visible) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(duneLayer, 0, 0, W, H);
    drawMotes(t);

    if (!REDUCED) {
      if (!worm.active && t > worm.nextAuto) breach();
      drawWorm();
      drawSpray();
    }
  };
  requestAnimationFrame(frame);

  // summon with S
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (visible) breach();
    }
  });

  // tap the worm section to summon
  section.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    breach();
  });
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const preloader = initPreloader();
  initHeroScene(preloader);
  initCountdown();
  initReveals();
  initTilt();
  initCursor();
  initTransitions();
  initWorm();
  initSoundToggle();
});
