/**
 * Cinematic event banner shown when the timeline crosses events. Batches bursts (fast playback,
 * several events in one year) into a single card and rate-limits how often a card appears.
 */
import { formatYear } from '../data/query.ts';
import type { LoreEvent } from '../data/types.ts';
import { h, icon, ICONS } from '../shared/dom.ts';
import { reducedMotion } from '../shared/prefs.ts';

const GATHER_MS = 380;
const MIN_GAP_MS = 2600;

export class EventBanner {
  readonly el: HTMLElement;
  private eyebrow: HTMLElement;
  private title: HTMLElement;
  private text: HTMLElement;
  private list: HTMLElement;
  private actions: HTMLElement;
  private pending: LoreEvent[] = [];
  private timer: number | undefined;
  private hideTimer: number | undefined;
  private lastShown = 0;

  constructor(
    private hooks: {
      onShow(events: LoreEvent[]): void;
      onOpenPlace(placeId: string): void;
      placeLabel(placeId: string): string | undefined;
    },
  ) {
    this.eyebrow = h('p', { class: 'eyebrow banner__eyebrow' });
    this.title = h('h2', { class: 'banner__title display' });
    this.text = h('p', { class: 'banner__text' });
    this.list = h('ul', { class: 'banner__list' });
    this.actions = h('div', { class: 'banner__actions' });
    const close = h('button', { class: 'icon-btn banner__close', type: 'button', 'aria-label': 'Dismiss event' }, icon(ICONS.close));
    close.addEventListener('click', () => this.hide());
    this.el = h(
      'section',
      { class: 'banner panel', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-show': 'false' },
      h('div', { class: 'banner__body' }, this.eyebrow, this.title, this.text, this.list, this.actions),
      close,
    );
    this.el.addEventListener('pointerenter', () => window.clearTimeout(this.hideTimer));
    this.el.addEventListener('pointerleave', () => this.scheduleHide(2500));
  }

  push(events: LoreEvent[]): void {
    if (!events.length) return;
    this.pending.push(...events);
    if (this.timer !== undefined) return;
    const wait = Math.max(GATHER_MS, this.lastShown + MIN_GAP_MS - performance.now());
    this.timer = window.setTimeout(() => this.flush(), wait);
  }

  hide(): void {
    window.clearTimeout(this.hideTimer);
    this.el.dataset.show = 'false';
    document.documentElement.dataset.cine = 'false';
  }

  private flush(): void {
    this.timer = undefined;
    const evs = this.pending.sort((a, b) => a.year - b.year);
    this.pending = [];
    if (!evs.length) return;
    this.lastShown = performance.now();

    const y0 = Math.floor(evs[0].year);
    const y1 = Math.floor(evs[evs.length - 1].year);
    const when = y0 === y1 ? formatYear(y0) : `${formatYear(y0, { short: true })}–${formatYear(y1)}`;
    this.actions.replaceChildren();
    if (evs.length === 1) {
      const e = evs[0];
      this.eyebrow.textContent = `${e.approx ? 'c. ' : ''}${when}${e.kind ? ` · ${e.kind}` : ''}`;
      this.title.textContent = e.title;
      this.text.textContent = e.summary;
      this.text.hidden = false;
      this.list.hidden = true;
      if (e.place) {
        const label = this.hooks.placeLabel(e.place);
        if (label) {
          const b = h('button', { class: 'btn', type: 'button' }, icon(ICONS.target, { size: 16 }), label);
          b.addEventListener('click', () => this.hooks.onOpenPlace(e.place!));
          this.actions.append(b);
        }
      }
    } else {
      this.eyebrow.textContent = when;
      this.title.textContent = `${evs.length} events in ${when}`;
      this.text.hidden = true;
      this.list.hidden = false;
      const shown = evs.slice(0, 4);
      this.list.replaceChildren(
        ...shown.map((e) => h('li', null, e.title)),
        ...(evs.length > shown.length ? [h('li', { class: 'muted' }, `and ${evs.length - shown.length} more`)] : []),
      );
    }
    this.actions.hidden = !this.actions.childElementCount;
    // Restart the entrance animation.
    this.el.dataset.show = 'false';
    void this.el.offsetWidth;
    this.el.dataset.show = 'true';
    if (!reducedMotion() && evs.length === 1) document.documentElement.dataset.cine = 'true';
    this.hooks.onShow(evs);
    this.scheduleHide(evs.length === 1 ? 7000 : 5000);
  }

  private scheduleHide(ms: number): void {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), ms);
  }
}
