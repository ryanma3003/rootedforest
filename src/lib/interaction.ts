/**
 * Global, framework-free interaction state shared by every canvas.
 * Written by DOM listeners + one rAF loop, read inside useFrame callbacks —
 * no React re-renders on pointer or scroll.
 */
import { BURST, PARALLAX } from '../tunables';
import { clamp, damp, randIn } from './math';

export interface Burst {
  id: number;
  /** Viewport (client) coordinates. */
  x: number;
  y: number;
  t: number;
  strength: number;
  particles: number;
}

/** A leaf handed to the 2D layer, in viewport coordinates + px/s. */
export interface LeafSpawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  color: string;
}

export const now = () => performance.now() / 1000;

export const env = {
  width: typeof window === 'undefined' ? 1280 : window.innerWidth,
  height: typeof window === 'undefined' ? 800 : window.innerHeight,
  coarse: false,
  reduced: false,
};

export const pointer = {
  x: -1e5,
  y: -1e5,
  vx: 0,
  vy: 0,
  /** Normalised -1..1, DOM orientation (y down). */
  nx: 0,
  ny: 0,
  active: false,
  lastMoveT: 0,
};

export const scroll = { y: 0, progress: 0, velocity: 0, lastT: 0 };

/** Heavy-camera layer offset in scene px (y up). */
export const parallax = { x: 0, y: 0 };

/** Convert viewport coords to the centred, y-up pixel space of the 2D layer. */
export function toScene(x: number, y: number) {
  return { x: x - env.width / 2, y: env.height / 2 - y };
}

// ─── Bursts ────────────────────────────────────────────────────────────────
let burstId = 0;
export const recentBursts: Burst[] = [];
const burstListeners = new Set<(b: Burst) => void>();

export function emitBurst(x: number, y: number, opts: { strength?: number; particles?: number } = {}) {
  const b: Burst = {
    id: ++burstId,
    x,
    y,
    t: now(),
    strength: opts.strength ?? 1,
    particles: opts.particles ?? Math.round(randIn(BURST.particles)),
  };
  recentBursts.push(b);
  if (recentBursts.length > 16) recentBursts.shift();
  burstListeners.forEach((fn) => fn(b));
}

export function onBurst(fn: (b: Burst) => void) {
  burstListeners.add(fn);
  return () => {
    burstListeners.delete(fn);
  };
}

// ─── Leaf hand-off (hero tree → global layer) ────────────────────────────────
const leafSpawns: LeafSpawn[] = [];
export function spawnLeaf(leaf: LeafSpawn) {
  leafSpawns.push(leaf);
}
export function drainLeafSpawns(consume: (leaf: LeafSpawn) => void) {
  while (leafSpawns.length) consume(leafSpawns.shift()!);
}

// ─── Listeners ───────────────────────────────────────────────────────────────
function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scroll.progress = max > 0 ? clamp(window.scrollY / max) : 0;
}

export function initInteraction() {
  const coarseQuery = window.matchMedia('(pointer: coarse)');
  env.coarse = coarseQuery.matches;
  const onCoarse = (e: MediaQueryListEvent) => (env.coarse = e.matches);
  coarseQuery.addEventListener('change', onCoarse);

  const setPointer = (e: PointerEvent) => {
    const t = now();
    const dt = Math.max(t - pointer.lastMoveT, 1 / 240);
    if (pointer.active && dt < 0.2) {
      pointer.vx = pointer.vx * 0.55 + ((e.clientX - pointer.x) / dt) * 0.45;
      pointer.vy = pointer.vy * 0.55 + ((e.clientY - pointer.y) / dt) * 0.45;
    } else {
      pointer.vx = 0;
      pointer.vy = 0;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.nx = (e.clientX / env.width) * 2 - 1;
    pointer.ny = (e.clientY / env.height) * 2 - 1;
    pointer.active = true;
    pointer.lastMoveT = t;
  };

  const onMove = (e: PointerEvent) => setPointer(e);
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setPointer(e);
    emitBurst(e.clientX, e.clientY);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer.active = false;
  };
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) pointer.active = false;
  };
  const onScroll = () => {
    const t = now();
    const dt = Math.max(t - scroll.lastT, 1 / 240);
    const y = window.scrollY;
    if (dt < 0.25) scroll.velocity = scroll.velocity * 0.6 + ((y - scroll.y) / dt) * 0.4;
    scroll.y = y;
    scroll.lastT = t;
    updateProgress();
  };
  const onResize = () => {
    env.width = window.innerWidth;
    env.height = window.innerHeight;
    updateProgress();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  window.addEventListener('pointerout', onOut, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(updateProgress);
  ro.observe(document.body);
  onResize();
  scroll.y = window.scrollY;

  // One shared loop: velocity decay + heavy damped parallax.
  let raf = 0;
  let last = now();
  const loop = () => {
    const t = now();
    const dt = Math.min(t - last, 0.1);
    last = t;
    if (t - pointer.lastMoveT > 0.05) {
      const k = Math.exp(-dt * 9);
      pointer.vx *= k;
      pointer.vy *= k;
    }
    if (t - scroll.lastT > 0.08) scroll.velocity *= Math.exp(-dt * 6);

    let tx = 0;
    let ty = 0;
    if (!env.reduced) {
      if (env.coarse) {
        ty = clamp(scroll.velocity * PARALLAX.scrollVelocityGain, -1, 1) * PARALLAX.maxOffsetPx;
      } else if (pointer.active) {
        tx = -pointer.nx * PARALLAX.maxOffsetPx;
        ty = pointer.ny * PARALLAX.maxOffsetPx;
      }
    }
    parallax.x = damp(parallax.x, tx, PARALLAX.damping, dt);
    parallax.y = damp(parallax.y, ty, PARALLAX.damping, dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    coarseQuery.removeEventListener('change', onCoarse);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('pointerout', onOut);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
  };
}
