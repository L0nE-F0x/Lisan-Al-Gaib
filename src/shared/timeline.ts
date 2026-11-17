/**
 * Shared timeline control used by Arrakis and the Known Universe.
 *
 *   const tl = new Timeline({ range: lore.range, year: 10191, events, eras });
 *   container.append(tl.el);
 *   tl.onChange((year, source) => ...);   // source: 'scrub' | 'play' | 'step' | 'api'
 *   onFrame(dt => tl.tick(dt));           // advances while playing
 *
 * Accessible: native range input with aria-valuetext, real buttons, keyboard shortcuts
 * are left to the page (Space = play/pause is wired by `bindKeys()` if wanted).
 */
import { eraAt, formatYear, spokenYear } from '../data/query.ts';
import type { Era, Year } from '../data/types.ts';
import { audio } from './audio.ts';
import { h, icon, ICONS } from './dom.ts';

export interface TimelineEvent {
  id: string;
  year: Year;
  title: string;
}

export type ChangeSource = 'scrub' | 'play' | 'step' | 'api';

export interface TimelineOptions {
  range: [Year, Year];
  year: Year;
  eras: Era[];
  events?: TimelineEvent[];
  /** Years per second at each speed setting. */
  speeds?: { label: string; yps: number }[];
  speedIndex?: number;
}

const DEFAULT_SPEEDS = [
  { label: '1 yr/s', yps: 1 },
  { label: '10 yr/s', yps: 10 },
  { label: '50 yr/s', yps: 50 },
  { label: '200 yr/s', yps: 200 },
];

export class Timeline {
  readonly el: HTMLElement;
  private _year: Year;
  private _playing = false;
  private range: [Year, Year];
  private eras: Era[];
  private events: TimelineEvent[];
  private speeds: { label: string; yps: number }[];
  private speedIndex: number;
  private listeners = new Set<(year: Year, source: ChangeSource) => void>();
  private playListeners = new Set<(playing: boolean) => void>();

  private slider: HTMLInputElement;
  private yearEl: HTMLElement;
  private eraEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private ticks: HTMLElement;

  constructor(opts: TimelineOptions) {
    this.range = opts.range;
    this._year = clampYear(opts.year, opts.range);
    this.eras = opts.eras;
    this.events = [...(opts.events ?? [])].sort((a, b) => a.year - b.year);
    this.speeds = opts.speeds ?? DEFAULT_SPEEDS;
    this.speedIndex = opts.speedIndex ?? 1;

    this.yearEl = h('output', { class: 'tl__year', 'aria-live': 'off' });
    this.eraEl = h('div', { class: 'tl__era' });

    this.playBtn = h('button', { class: 'icon-btn tl__play', type: 'button', 'aria-label': 'Play timeline', 'aria-pressed': 'false' }, icon(ICONS.play));
    this.playBtn.addEventListener('click', () => this.setPlaying(!this._playing));

    const prev = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous event', title: 'Previous event' }, icon(ICONS.prev));
    const next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next event', title: 'Next event' }, icon(ICONS.next));
    prev.addEventListener('click', () => this.stepEvent(-1));
    next.addEventListener('click', () => this.stepEvent(1));

    this.speedBtn = h('button', { class: 'btn btn--ghost tl__speed', type: 'button', title: 'Playback speed' });
    this.speedBtn.addEventListener('click', () => {
      this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
      this.renderSpeed();
      audio.sfx('tick');
    });

    this.slider = h('input', {
      class: 'range tl__slider',
      type: 'range',
      min: String(this.range[0]),
      max: String(this.range[1]),
      step: '1',
      'aria-label': 'Year',
    });
    this.slider.addEventListener('input', () => {
      this.setPlaying(false);
      this.set(Number(this.slider.value), 'scrub');
    });

    this.ticks = h('div', { class: 'tl__ticks', 'aria-hidden': 'true' });

    const head = h('div', { class: 'tl__head' }, h('div', { class: 'tl__readout' }, this.yearEl, this.eraEl));
    const controls = h('div', { class: 'tl__controls' }, prev, this.playBtn, next, this.speedBtn);
    const track = h('div', { class: 'tl__track' }, this.ticks, this.slider);
    this.el = h('section', { class: 'tl panel', 'aria-label': 'Timeline' }, h('div', { class: 'tl__row' }, head, controls), track);

    this.renderTicks();
    this.renderSpeed();
    this.render();
  }

  get year(): Year {
    return this._year;
  }

  get playing(): boolean {
    return this._playing;
  }

  onChange(fn: (year: Year, source: ChangeSource) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onPlayChange(fn: (playing: boolean) => void): () => void {
    this.playListeners.add(fn);
    return () => this.playListeners.delete(fn);
  }

  set(year: Year, source: ChangeSource = 'api'): void {
    const y = clampYear(year, this.range);
    if (y === this._year) return;
    this._year = y;
    this.render();
    for (const l of this.listeners) l(y, source);
  }

  setPlaying(on: boolean): void {
    if (on && this._year >= this.range[1]) this.set(this.range[0], 'api');
    if (on === this._playing) return;
    this._playing = on;
    this.playBtn.replaceChildren(icon(on ? ICONS.pause : ICONS.play));
    this.playBtn.setAttribute('aria-pressed', String(on));
    this.playBtn.setAttribute('aria-label', on ? 'Pause timeline' : 'Play timeline');
    for (const l of this.playListeners) l(on);
  }

  setEvents(events: TimelineEvent[]): void {
    this.events = [...events].sort((a, b) => a.year - b.year);
    this.renderTicks();
  }

  /** Advance while playing. Call every frame with dt in seconds. */
  tick(dt: number): void {
    if (!this._playing) return;
    const next = this._year + this.speeds[this.speedIndex].yps * dt;
    if (next >= this.range[1]) {
      this.set(this.range[1], 'play');
      this.setPlaying(false);
      return;
    }
    this.set(next, 'play');
  }

  stepEvent(dir: 1 | -1): void {
    this.setPlaying(false);
    const y = this._year;
    const target =
      dir > 0 ? this.events.find((e) => e.year > y + 0.001) : [...this.events].reverse().find((e) => e.year < y - 0.001);
    if (target) {
      this.set(target.year, 'step');
      audio.sfx('tick');
    }
  }

  /** Space toggles play, [ and ] step between events. Ignores typing in inputs. */
  bindKeys(target: Document | HTMLElement = document): () => void {
    const onKey = (e: Event) => {
      const ke = e as KeyboardEvent;
      const t = ke.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], dialog')) return;
      if (ke.key === ' ' && !t.closest('button, a')) {
        ke.preventDefault();
        this.setPlaying(!this._playing);
      } else if (ke.key === ']') this.stepEvent(1);
      else if (ke.key === '[') this.stepEvent(-1);
    };
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  // ---------------------------------------------------------------------------

  private render(): void {
    const y = this._year;
    const era = eraAt(this.eras, y);
    this.slider.value = String(Math.round(y));
    this.slider.setAttribute('aria-valuetext', `${spokenYear(y)}, ${era.name}`);
    const pct = ((y - this.range[0]) / (this.range[1] - this.range[0])) * 100;
    this.el.style.setProperty('--fill', `${pct}%`);
    this.el.style.setProperty('--accent', era.color);
    this.yearEl.textContent = formatYear(y);
    if (this.eraEl.textContent !== era.name) this.eraEl.textContent = era.name;
  }

  private renderTicks(): void {
    const [a, b] = this.range;
    this.ticks.replaceChildren(
      ...this.eras.map((e) => {
        const left = ((Math.max(e.start, a) - a) / (b - a)) * 100;
        const width = ((Math.min(e.end, b) - Math.max(e.start, a)) / (b - a)) * 100;
        return h('i', { class: 'tl__era-band', style: `left:${left}%;width:${width}%;background:${e.color}`, title: e.name });
      }),
      ...this.events.map((e) =>
        h('i', { class: 'tl__tick', style: `left:${((e.year - a) / (b - a)) * 100}%`, title: `${formatYear(e.year)} — ${e.title}` }),
      ),
    );
  }

  private renderSpeed(): void {
    this.speedBtn.textContent = this.speeds[this.speedIndex].label;
    this.speedBtn.setAttribute('aria-label', `Playback speed ${this.speeds[this.speedIndex].label}. Activate to change.`);
  }
}

function clampYear(y: Year, [a, b]: [Year, Year]): Year {
  return Math.min(b, Math.max(a, y));
}
