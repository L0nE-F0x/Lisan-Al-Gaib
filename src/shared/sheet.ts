/**
 * Responsive detail panel: a side panel on wide screens, a bottom sheet on narrow ones.
 *
 *   const sheet = new Sheet({ label: 'Details' });
 *   document.body.append(sheet.el);
 *   sheet.open({ eyebrow: 'Sietch', title: 'Sietch Tabr', accent: '#f0a44a', body: node });
 *   sheet.onClose(() => ...);
 *
 * Not modal (the map stays usable). Escape closes it and focus returns to the opener.
 * On mobile the sheet has a "peek" and an "expanded" state; drag the handle or tap it.
 */
import { h, icon, ICONS } from './dom.ts';

export interface SheetContent {
  eyebrow?: string;
  title: string;
  accent?: string;
  body: Node;
  /** Optional row of buttons/links under the title. */
  actions?: Node[];
}

export class Sheet {
  readonly el: HTMLElement;
  private titleEl: HTMLElement;
  private eyebrowEl: HTMLElement;
  private bodyEl: HTMLElement;
  private actionsEl: HTMLElement;
  private returnFocus: HTMLElement | null = null;
  private closeListeners = new Set<() => void>();
  private _open = false;

  constructor(opts: { label?: string } = {}) {
    this.eyebrowEl = h('div', { class: 'eyebrow sheet__eyebrow' });
    this.titleEl = h('h2', { class: 'sheet__title display', tabindex: '-1' });
    this.actionsEl = h('div', { class: 'sheet__actions' });
    this.bodyEl = h('div', { class: 'sheet__body' });

    const closeBtn = h('button', { class: 'icon-btn sheet__close', type: 'button', 'aria-label': 'Close details' }, icon(ICONS.close));
    closeBtn.addEventListener('click', () => this.close());

    const handle = h('button', { class: 'sheet__handle', type: 'button', 'aria-label': 'Expand or collapse details' });
    handle.addEventListener('click', () => {
      this.el.dataset.expanded = String(this.el.dataset.expanded !== 'true');
    });
    this.bindDrag(handle);

    this.el = h(
      'aside',
      { class: 'sheet panel', 'aria-label': opts.label ?? 'Details', 'data-open': 'false', 'data-expanded': 'false' },
      handle,
      h('header', { class: 'sheet__head' }, h('div', { class: 'sheet__titles' }, this.eyebrowEl, this.titleEl), closeBtn),
      this.actionsEl,
      this.bodyEl,
    );
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return this._open;
  }

  open(c: SheetContent, opts: { focus?: boolean } = {}): void {
    if (!this._open) this.returnFocus = document.activeElement as HTMLElement | null;
    this.eyebrowEl.textContent = c.eyebrow ?? '';
    this.eyebrowEl.hidden = !c.eyebrow;
    this.titleEl.textContent = c.title;
    this.el.style.setProperty('--accent', c.accent ?? 'var(--spice)');
    this.actionsEl.replaceChildren(...(c.actions ?? []));
    this.actionsEl.hidden = !c.actions?.length;
    this.bodyEl.replaceChildren(c.body);
    this.bodyEl.scrollTop = 0;
    this.el.dataset.open = 'true';
    this._open = true;
    if (opts.focus !== false) this.titleEl.focus({ preventScroll: true });
  }

  close(): void {
    if (!this._open) return;
    this._open = false;
    this.el.dataset.open = 'false';
    this.el.dataset.expanded = 'false';
    for (const l of this.closeListeners) l();
    if (this.returnFocus && document.contains(this.returnFocus)) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  onClose(fn: () => void): () => void {
    this.closeListeners.add(fn);
    return () => this.closeListeners.delete(fn);
  }

  private bindDrag(handle: HTMLElement): void {
    let startY = 0;
    let dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      dragging = true;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = e.clientY - startY;
      if (dy < -40) this.el.dataset.expanded = 'true';
      else if (dy > 60) {
        if (this.el.dataset.expanded === 'true') this.el.dataset.expanded = 'false';
        else this.close();
      }
    });
  }
}

/** Helpers for consistent sheet bodies. */
export function dl(rows: [string, Node | string | undefined | null][]): HTMLElement {
  const list = h('dl', { class: 'facts' });
  for (const [k, v] of rows) {
    if (v === undefined || v === null || v === '') continue;
    list.append(h('dt', null, k), h('dd', null, v));
  }
  return list;
}

export function section(title: string, ...children: (Node | string)[]): HTMLElement {
  return h('section', { class: 'sheet__section' }, h('h3', { class: 'eyebrow' }, title), ...children);
}
