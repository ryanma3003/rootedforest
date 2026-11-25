import { ContactShadows } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { pointer } from '../lib/interaction';
import { clamp, damp, easeInOutCubic, lerp } from '../lib/math';
import { HERO, RENDER } from '../tunables';
import { AtmosphereLayer, DistantForest, FogLayers, GodRays } from './hero/Atmosphere';
import { Island } from './hero/Island';
import { createRig, type HeroRig } from './hero/rig';
import { Tree } from './hero/Tree';

const deg = THREE.MathUtils.degToRad;

export interface HeroSceneProps {
  /** GSAP-scrubbed scroll-out progress. */
  scrollRef: MutableRefObject<{ p: number }>;
  introSeconds: number;
  reduced: boolean;
  mobile: boolean;
  /** Stop rendering entirely once the hero is off-screen. */
  active: boolean;
}

/** Writes the shared per-frame rig before anything else reads it. */
function RigDriver({ rig, scrollRef, introSeconds, reduced }: { rig: HeroRig } & Omit<HeroSceneProps, 'mobile' | 'active'>) {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    rig.time = t;
    const steer = pointer.active && !reduced;
    rig.mx = damp(rig.mx, steer ? pointer.nx : 0, HERO.camera.mouseDamping, dt);
    rig.my = damp(rig.my, steer ? pointer.ny : 0, HERO.camera.mouseDamping, dt);
    const speed = clamp(Math.hypot(pointer.vx, pointer.vy) / 2200);
    rig.gust = damp(rig.gust, reduced ? 0 : speed, 3, dt);
    rig.scrollP = scrollRef.current.p;
    rig.intro = reduced ? 1 : clamp(t / introSeconds);
  }, -2);
  return null;
}

/** Lissajous idle dolly + damped cursor steering + intro push-in + scroll pull-back. */
function CameraRig({ rig, mobile, reduced }: { rig: HeroRig; mobile: boolean; reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const target = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    camera.layers.enable(1);
  }, [camera]);

  useFrame((state) => {
    const c = HERO.camera;
    const t = state.clock.elapsedTime;
    const aspect = size.width / size.height;
    const centred = mobile || aspect < 1;
    const base = centred ? c.mobileTarget : c.target;
    const k = easeInOutCubic(rig.intro);
    const idle = reduced ? 0 : 1;
    const loop = (t / c.idleLoopSeconds) * Math.PI * 2;
    const p = rig.scrollP;
    const narrow = aspect < c.narrowAspect ? clamp(c.narrowAspect / aspect, 1, c.maxNarrowMul) : 1;

    const az = deg(c.idleAzimuthDeg) * Math.sin(loop) * idle + deg(c.orbitDeg) * rig.mx;
    const el =
      c.elevation +
      deg(c.idleElevationDeg) * Math.sin(loop * 2 + 0.6) * idle -
      deg(c.tiltDeg) * rig.my +
      lerp(HERO.intro.wideElevation, 0, k) +
      p * HERO.scrollOut.riseElevation;
    const dist = c.distance * narrow * lerp(HERO.intro.wideDistanceMul, 1, k) * (1 + p * HERO.scrollOut.pullBack);

    target.set(base[0], base[1] + p * HERO.scrollOut.riseTarget, base[2]);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(target);
  }, -1);
  return null;
}

function Lights({ reduced }: { reduced: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null!);
  const L = HERO.lights;
  useFrame((state) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    // Very slow breathing (±5%): sun through moving canopy.
    key.current.intensity = L.key.intensity * (1 + L.key.flicker * (Math.sin(t * 0.55) * 0.6 + Math.sin(t * 1.7 + 1.3) * 0.4));
  });
  return (
    <>
      <directionalLight
        ref={key}
        color={L.key.color}
        intensity={L.key.intensity}
        position={[...L.key.position]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={9}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight color={L.rim.color} intensity={L.rim.intensity} position={[...L.rim.position]} />
      <hemisphereLight args={[L.fill.sky, L.fill.ground, L.fill.intensity]} />
      <ambientLight intensity={L.ambient} />
    </>
  );
}

function SceneContents({ scrollRef, introSeconds, reduced, mobile }: Omit<HeroSceneProps, 'active'>) {
  const rig = useMemo(createRig, []);
  const island = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = reduced ? 0 : state.clock.elapsedTime;
    const b = HERO.breathe;
    island.current.position.y = Math.sin((t / b.bobSeconds) * Math.PI * 2) * b.bobAmount;
  });

  return (
    <>
      <RigDriver rig={rig} scrollRef={scrollRef} introSeconds={introSeconds} reduced={reduced} />
      <CameraRig rig={rig} mobile={mobile} reduced={reduced} />
      <Lights reduced={reduced} />
      <Island ref={island} rig={rig} reduced={reduced} mobile={mobile}>
        <Tree rig={rig} reduced={reduced} mobile={mobile} island={island} />
      </Island>
      <AtmosphereLayer>
        <DistantForest />
        <FogLayers rig={rig} reduced={reduced} />
        <GodRays rig={rig} reduced={reduced} />
      </AtmosphereLayer>
      <ContactShadows
        position={[0.9, -3.05, 0.8]}
        scale={[12, 8]}
        opacity={0.55}
        blur={2.8}
        far={3.6}
        resolution={512}
        color="#010805"
      />
    </>
  );
}

export function HeroScene(props: HeroSceneProps) {
  const { active, ...rest } = props;
  return (
    <Canvas
      shadows
      dpr={[1, RENDER.maxDpr]}
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: HERO.fov, near: 0.1, far: 140, position: [0, 6, 30] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.Fog(HERO.fog.color, HERO.fog.near, HERO.fog.far);
      }}
      aria-hidden="true"
    >
      <SceneContents {...rest} />
    </Canvas>
  );
}
