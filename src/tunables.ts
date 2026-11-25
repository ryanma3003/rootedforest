/**
 * Every animation, color and campaign constant for the page lives here.
 * Units: px for the 2D living-forest layer, world units for the hero scene,
 * seconds for time unless the name says otherwise.
 */

// ─── Color system: "Canopy to Night" ────────────────────────────────────────
export const COLORS = {
  canopy: '#2E7D4F',
  forest: '#1B5E3B',
  deep: '#0E3B24',
  night: '#05130C',
  mint: '#7CF0A8',
  mist: '#C7E8D2',
  ink: '#04150D',
} as const;

/** One continuous page gradient: [color, % of total page height]. */
export const PAGE_GRADIENT: ReadonlyArray<readonly [string, number]> = [
  [COLORS.canopy, 0],
  ['#277249', 8],
  [COLORS.forest, 19],
  ['#154e31', 31],
  [COLORS.deep, 44],
  ['#0b301d', 56],
  ['#082316', 68],
  ['#061a10', 79],
  [COLORS.night, 88],
  [COLORS.night, 100],
];

export const EASE = {
  /** cubic-bezier(0.22, 1, 0.36, 1) — used by Framer Motion and CSS. */
  cinematic: [0.22, 1, 0.36, 1] as [number, number, number, number],
  css: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const RENDER = {
  maxDpr: 2,
} as const;

// ─── Global living-forest layer ─────────────────────────────────────────────
export const PARALLAX = {
  /** Max layer offset opposite the cursor. */
  maxOffsetPx: 14,
  /** Exponential damping rate (1/s). Low = heavy camera. */
  damping: 1.6,
  /** Touch devices: scroll velocity (px/s) → offset px. */
  scrollVelocityGain: 0.01,
} as const;

export const LEAVES = {
  count: 64,
  /** Extra pooled slots for leaves handed off from the hero tree. */
  poolFromTree: 40,
  sizeMin: 12,
  sizeMax: 40,
  alphaMin: 0.15,
  alphaMax: 0.6,
  /** Documentary slow-mo fall speed (px/s), far → near. */
  fallSpeed: [11, 30] as const,
  swayAmp1: [12, 38] as const,
  swayFreq1: [0.05, 0.11] as const, // Hz
  swayAmp2: [3, 10] as const,
  swayFreq2: [0.17, 0.3] as const,
  spin: [0.05, 0.28] as const, // rad/s
  tumble: [0.15, 0.55] as const, // rad/s
  rockAmount: 0.45, // rad of pendulum rock that follows the sway
  cursorRadius: 150,
  cursorForce: 950,
  cursorVelocityTransfer: 0.42,
  pushDamping: 2.1,
  burstRadius: 180,
  burstImpulse: 280,
  /** Scroll progress range across which leaves shift from canopy greens to dusk tones. */
  darkenRange: [0.12, 0.6] as const,
  brightPalette: ['#5fae6e', '#79c27a', '#94cf6c', '#4a9a5c', '#a9c75f', '#6dbb8a'],
  darkPalette: ['#2b4a36', '#35553d', '#2f4231', '#3d4f33', '#24392b', '#40573f'],
  reducedPulseSeconds: 7,
} as const;

export interface GrassLayerConfig {
  spacing: number;
  height: readonly [number, number];
  width: readonly [number, number];
  base: string;
  tip: string;
  alpha: number;
  parallaxDepth: number;
  cursorScale: number;
  tipGlow: number;
}

export const GRASS = {
  layers: {
    back: {
      spacing: 4.5,
      height: [34, 82],
      width: [3, 6],
      base: '#071c11',
      tip: '#1d5235',
      alpha: 0.92,
      parallaxDepth: 0.45,
      cursorScale: 0.75,
      tipGlow: 0.05,
    },
    front: {
      spacing: 6,
      height: [46, 116],
      width: [4, 8.5],
      base: '#010805',
      tip: '#0c2a1a',
      alpha: 1,
      parallaxDepth: 1,
      cursorScale: 1,
      tipGlow: 0.16,
    },
  } satisfies Record<'back' | 'front', GrassLayerConfig>,
  /** Two overlapping traveling sine waves: [freq rad/s, wavenumber rad/px]. */
  wave1: [1.05, 0.0062] as const,
  wave2: [2.35, 0.019] as const,
  waveAmp: [0.13, 0.05] as const,
  /** Slow gust envelope that visibly rolls across the screen. */
  gust: [0.42, 0.0031] as const,
  cursorRadius: 110,
  cursorBend: 0.9, // rad at the blade tip
  cursorBrush: 0.00042, // rad per px/s of cursor velocity
  springK: 58,
  springZeta: 0.26,
  burstRadius: 100,
  burstImpulse: 12,
  /** Grass grows taller toward the page end so it rises through the footer. */
  growHero: 0.78,
  growFooter: 1.55,
  growRange: [0.78, 1] as const,
  bottomBleed: 10,
} as const;

export const FIREFLIES = {
  count: 18,
  size: [28, 52] as const,
  visibleRange: [0.26, 0.56] as const,
  wander: [30, 110] as const,
  wanderFreq: [0.02, 0.06] as const, // Hz
  pulseFreq: [0.12, 0.3] as const, // Hz
  shyRadius: 150,
  shyDistance: 120,
  fleeRate: 5.5,
  returnRate: 0.55,
  burstLightRadius: 300,
  burstLightDecay: 1.9,
  color: COLORS.mint,
} as const;

export const MOTES = {
  count: 46,
  size: [3, 8] as const,
  alpha: [0.08, 0.32] as const,
  rise: [3, 11] as const,
  warm: '#f4efc4',
  cool: '#b6f3cc',
  cursorRadius: 120,
  cursorPush: 380,
} as const;

export const BURST = {
  particles: [8, 12] as const,
  speed: [230, 460] as const,
  drag: 2.7,
  gravity: 110,
  life: [1.0, 1.55] as const,
  size: [10, 19] as const,
  spin: [-5, 5] as const,
  ringDuration: 0.45,
  ringRadius: 115,
  particlePool: 96,
  ringPool: 10,
  color: COLORS.mint,
  reducedGlowSeconds: 0.6,
} as const;

// ─── Hero scene ─────────────────────────────────────────────────────────────
export const HERO = {
  sectionHeightVh: 190,
  fov: 38,
  camera: {
    distance: 16,
    elevation: 0.1,
    target: [-2.3, 2.5, 0] as const,
    mobileTarget: [0, 2.9, 0] as const,
    /** Narrow aspect → pull the camera back so the crown fits. */
    narrowAspect: 1.3,
    maxNarrowMul: 2.1,
    idleLoopSeconds: 20,
    idleAzimuthDeg: 6,
    idleElevationDeg: 2.5,
    orbitDeg: 8,
    tiltDeg: 4,
    mouseDamping: 1.3,
  },
  intro: {
    desktopSeconds: 2,
    mobileSeconds: 1.1,
    wideDistanceMul: 1.85,
    wideElevation: 0.32,
    cardDelayFraction: 0.55,
    cardStagger: 0.12,
  },
  scrollOut: {
    pullBack: 0.55,
    riseElevation: 0.22,
    riseTarget: 1.6,
    raysWiden: 0.9,
    raysBrighten: 0.3,
    scrub: 1.2,
  },
  breathe: {
    bobSeconds: 5,
    bobAmount: 0.06,
    swayDeg: 1.4,
    swaySeconds: 6.5,
    canopySwayDeg: 1.3,
    canopyLean: 0.07,
  },
  lights: {
    key: { color: '#ffd59a', intensity: 3.1, position: [-7, 11, 5] as const, flicker: 0.05 },
    rim: { color: COLORS.mint, intensity: 2.4, position: [6, 5, -8] as const },
    fill: { sky: '#a6d9b6', ground: '#0a2416', intensity: 0.42 },
    ambient: 0.12,
  },
  fog: { color: '#1a5537', near: 12, far: 38 },
  island: { radius: 2.65, seed: 11 },
  tree: {
    seed: 7,
    leafDensity: 118,
    mobileLeafDensity: 72,
    pivotY: 3.4,
  },
  treeClick: {
    leaves: [5, 8] as const,
    gravity: 3.4,
    normalDrag: 5.5,
    tangentDrag: 0.45,
    flutter: 1.5,
    flutterRate: [2.2, 3.6] as const,
    rock: 2.2,
    launchOut: [1.0, 1.7] as const,
    launchUp: [0.5, 1.1] as const,
    regrowSeconds: 10,
    regrowDuration: 1.2,
    restSeconds: 5,
    /** Leaf length in world units (matches the canopy leaf card). */
    leafLength: 0.32,
  },
  godRays: { color: '#ffe3ad', source: [-9.5, 13, -3] as const, aim: [1.2, -1, 0.5] as const },
  parallax: { rays: 0.6, fogFar: 0.25, fogMid: 0.6, fogNear: 1.2 },
} as const;

// ─── UI / campaign ──────────────────────────────────────────────────────────
export const COUNTER = {
  start: 12483,
  intervalMs: 7000,
  jitterMs: 900,
} as const;

export const CAMPAIGN = {
  totalAcres: 50000,
  petitionBase: 84216,
  tiers: [
    { amount: 15, acres: 1, tag: null },
    { amount: 45, acres: 3, tag: 'Most chosen' },
    { amount: 100, acres: 6, tag: null },
  ],
  links: {
    about: '#top',
    transparency: '#help',
    contact: 'mailto:hello@rootedforest.org',
  },
  social: {
    instagram: 'https://instagram.com/rootedforest',
    tiktok: 'https://tiktok.com/@rootedforest',
    youtube: 'https://youtube.com/@rootedforest',
  },
} as const;

export const UI = {
  cardStagger: 0.12,
  cardLift: 6,
  revealDistance: 36,
  revealDuration: 0.8,
} as const;
