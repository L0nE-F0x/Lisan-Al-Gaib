/**
 * Site-wide sound. Opt-in: nothing plays until the viewer turns sound on (header button),
 * and the choice is remembered across pages via prefs.
 *
 * Beds (one at a time, crossfaded):
 *   'desert' — procedural wind + low drone (hub, Arrakis)
 *   'cosmos' — the project's ambient track /audio/ambient.mp3 over a faint drone (Universe)
 * One-shots: audio.sfx('select' | 'hover' | 'event' | 'thump' | 'whoosh' | 'tick')
 */
import { getPrefs, onPrefs, setPrefs } from './prefs.ts';

export type Bed = 'desert' | 'cosmos' | 'none';
export type Sfx = 'select' | 'hover' | 'event' | 'thump' | 'whoosh' | 'tick';

const AMBIENT_URL = '/audio/ambient.mp3';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private beds = new Map<Exclude<Bed, 'none'>, GainNode>();
  private mp3: HTMLAudioElement | null = null;
  private wanted: Bed = 'none';
  private lastSfx = new Map<Sfx, number>();

  constructor() {
    onPrefs((p) => this.apply(p.sound, p.volume));
    // If sound was left on, resume on the first gesture (autoplay policy).
    if (getPrefs().sound) {
      const resume = () => {
        this.apply(true, getPrefs().volume);
        window.removeEventListener('pointerdown', resume, true);
        window.removeEventListener('keydown', resume, true);
      };
      window.addEventListener('pointerdown', resume, true);
      window.addEventListener('keydown', resume, true);
    }
  }

  get enabled(): boolean {
    return getPrefs().sound;
  }

  /** Must be called from a user gesture (click handler). */
  toggle(): boolean {
    setPrefs({ sound: !getPrefs().sound });
    return getPrefs().sound;
  }

  setBed(bed: Bed): void {
    this.wanted = bed;
    if (this.ctx && this.enabled) this.crossfade();
  }

  sfx(kind: Sfx): void {
    if (!this.ctx || !this.master || !this.enabled || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.lastSfx.get(kind) ?? 0) < (kind === 'hover' ? 60 : 120)) return; // de-dupe bursts
    this.lastSfx.set(kind, now);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(this.master);

    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };

    const burst = (freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass') => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);
    };

    switch (kind) {
      case 'hover': tone('sine', 1400, 1200, 0.05, 0.015); break;
      case 'tick': tone('triangle', 900, 900, 0.04, 0.03); break;
      case 'select': tone('sine', 520, 780, 0.18, 0.06); tone('sine', 1040, 1560, 0.12, 0.02); break;
      case 'event': tone('sine', 196, 147, 1.4, 0.12); tone('triangle', 294, 220, 1.2, 0.04); break;
      case 'whoosh': burst(700, 0.6, 0.7, 0.18); break;
      case 'thump':
        tone('sine', 46, 19, 1.5, 0.5);
        burst(140, 0.7, 0.9, 0.35, 'lowpass');
        break;
    }
  }

  // -------------------------------------------------------------------------

  private apply(on: boolean, volume: number): void {
    if (!on) {
      if (this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      this.mp3?.pause();
      return;
    }
    this.build();
    if (!this.ctx || !this.master) return;
    void this.ctx.resume();
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.8);
    this.crossfade();
  }

  private build(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // Gentle limiter so stacked one-shots never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);

    // Shared pink-ish noise buffer.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
      d[i] = last * 3.2;
    }

    this.beds.set('desert', this.buildDesert());
    this.beds.set('cosmos', this.buildCosmos());
  }

  private buildDesert(): GainNode {
    const ctx = this.ctx!;
    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.connect(this.master!);

    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 0.9;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 260;
    lfo.connect(lfoAmt).connect(bp.frequency);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2Amt = ctx.createGain();
    lfo2Amt.gain.value = 0.07;
    lfo2.connect(lfo2Amt).connect(windGain.gain);
    wind.connect(bp).connect(windGain).connect(bed);

    const drone = this.buildDrone(0.05);
    drone.connect(bed);

    wind.start();
    lfo.start();
    lfo2.start();
    return bed;
  }

  private buildCosmos(): GainNode {
    const ctx = this.ctx!;
    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.connect(this.master!);
    this.buildDrone(0.025).connect(bed);
    this.mp3 = new Audio(AMBIENT_URL);
    this.mp3.loop = true;
    this.mp3.preload = 'none';
    this.mp3.crossOrigin = 'anonymous';
    try {
      const src = ctx.createMediaElementSource(this.mp3);
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g).connect(bed);
    } catch {
      /* fall back to element volume */
      this.mp3.volume = 0.4;
    }
    return bed;
  }

  private buildDrone(level: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = level;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    for (const [type, f] of [['sine', 55], ['triangle', 82.41], ['sine', 55.4]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const amt = ctx.createGain();
    amt.gain.value = level * 0.4;
    lfo.connect(amt).connect(g.gain);
    lfo.start();
    lp.connect(g);
    return g;
  }

  private crossfade(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [name, gain] of this.beds) {
      gain.gain.setTargetAtTime(name === this.wanted ? 1 : 0, t, 1.2);
    }
    if (this.mp3) {
      if (this.wanted === 'cosmos') void this.mp3.play().catch(() => {});
      else this.mp3.pause();
    }
  }
}

export const audio = new AudioEngine();
