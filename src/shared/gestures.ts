/**
 * Unified pointer gestures for map canvases (mouse, pen, touch, trackpad).
 *
 *  - drag with one pointer  -> onPan(dx, dy)
 *  - pinch with two         -> onZoom(factor, cx, cy) + onPan for the midpoint
 *  - wheel / trackpad pinch -> onZoom(factor, cx, cy)
 *  - tap / click            -> onTap(x, y)            (no movement, short press)
 *  - double tap / dblclick  -> onDoubleTap(x, y)
 *  - hover (mouse only)     -> onHover(x, y) / onHover(null)
 *  - keyboard on the element: arrows pan, +/- zoom, Enter = onActivate
 *
 * Coordinates are CSS pixels relative to the element. The element should have
 * `touch-action: none` so the browser doesn't also scroll/zoom the page.
 */

export interface GestureHandlers {
  onPan?: (dx: number, dy: number) => void;
  onZoom?: (factor: number, cx: number, cy: number) => void;
  onTap?: (x: number, y: number, pointerType: string) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
  onHoverEnd?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Keyboard "select" on the focused canvas. */
  onActivate?: () => void;
}

const TAP_SLOP = 8; // px
const TAP_TIME = 400; // ms
const DOUBLE_TAP_TIME = 320; // ms

export function attachGestures(el: HTMLElement, h: GestureHandlers): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt = 0;
  let downPos = { x: 0, y: 0 };
  let moved = false;
  let lastTap = { t: 0, x: 0, y: 0 };
  let pinchDist = 0;
  let pinchMid = { x: 0, y: 0 };
  let dragging = false;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pinchState = () => {
    const [a, b] = Array.from(pointers.values());
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      downAt = performance.now();
      downPos = p;
      moved = false;
    } else if (pointers.size === 2) {
      const s = pinchState();
      pinchDist = s.dist;
      pinchMid = s.mid;
      moved = true; // a pinch is never a tap
    }
  };

  const onMove = (e: PointerEvent) => {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') h.onHover?.(p.x, p.y);
      return;
    }
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, p);

    if (pointers.size === 1) {
      if (!moved && Math.hypot(p.x - downPos.x, p.y - downPos.y) > TAP_SLOP) {
        moved = true;
        dragging = true;
        h.onDragStart?.();
      }
      if (moved) h.onPan?.(p.x - prev.x, p.y - prev.y);
    } else if (pointers.size === 2) {
      const s = pinchState();
      if (pinchDist > 0) h.onZoom?.(s.dist / pinchDist, s.mid.x, s.mid.y);
      h.onPan?.(s.mid.x - pinchMid.x, s.mid.y - pinchMid.y);
      pinchDist = s.dist;
      pinchMid = s.mid;
      if (!dragging) {
        dragging = true;
        h.onDragStart?.();
      }
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.delete(e.pointerId);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

    if (pointers.size === 1) {
      // Going from pinch back to one finger: re-anchor so the map doesn't jump.
      pinchDist = 0;
      return;
    }
    if (pointers.size > 0) return;

    if (dragging) {
      dragging = false;
      h.onDragEnd?.();
    }
    const now = performance.now();
    if (e.type === 'pointerup' && !moved && now - downAt < TAP_TIME) {
      h.onTap?.(p.x, p.y, e.pointerType);
      if (now - lastTap.t < DOUBLE_TAP_TIME && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        h.onDoubleTap?.(p.x, p.y);
        lastTap = { t: 0, x: 0, y: 0 };
      } else {
        lastTap = { t: now, x: p.x, y: p.y };
      }
    }
  };

  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && pointers.size === 0) h.onHoverEnd?.();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    // Trackpad pinch arrives as ctrlKey wheel with small deltas; mouse wheels have large ones.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const delta = e.deltaY * unit;
    const intensity = e.ctrlKey ? 0.01 : 0.0015;
    const factor = Math.exp(-delta * intensity);
    h.onZoom?.(Math.min(Math.max(factor, 0.5), 2), p.x, p.y);
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 120 : 40;
    const r = el.getBoundingClientRect();
    switch (e.key) {
      case 'ArrowLeft': h.onPan?.(step, 0); break;
      case 'ArrowRight': h.onPan?.(-step, 0); break;
      case 'ArrowUp': h.onPan?.(0, step); break;
      case 'ArrowDown': h.onPan?.(0, -step); break;
      case '+': case '=': h.onZoom?.(1.25, r.width / 2, r.height / 2); break;
      case '-': case '_': h.onZoom?.(0.8, r.width / 2, r.height / 2); break;
      case 'Enter': case ' ': h.onActivate?.(); break;
      default: return;
    }
    e.preventDefault();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('keydown', onKey);
  // Prevent Safari's native gesture zoom on the canvas.
  const stop = (e: Event) => e.preventDefault();
  el.addEventListener('gesturestart', stop);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('gesturestart', stop);
  };
}
