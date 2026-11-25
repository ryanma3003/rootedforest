import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp, lerp, mulberry32 } from '../../lib/math';
import { HERO } from '../../tunables';
import type { HeroRig } from './rig';

/**
 * Atmosphere lives on layer 1: the main camera sees it, but drei's
 * ContactShadows camera (layer 0) does not, so fog planes and light shafts
 * never cast fake shadows.
 */
export function AtmosphereLayer({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null!);
  useLayoutEffect(() => {
    group.current.traverse((o) => o.layers.set(1));
  });
  return <group ref={group}>{children}</group>;
}

// ─── God rays ────────────────────────────────────────────────────────────────
const rayVert = /* glsl */ `
varying vec2 vUv;
varying float vFres;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFres = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;
const rayFrag = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uSeed;
uniform vec3 uColor;
varying vec2 vUv;
varying float vFres;
void main() {
  float along = vUv.y;
  float ends = smoothstep(0.0, 0.5, along) * smoothstep(1.0, 0.82, along);
  float core = pow(vFres, 2.6);
  float shimmer = 0.72 + 0.28 * sin(uTime * 0.55 + uSeed * 10.0 + vUv.x * 12.566) * sin(uTime * 0.31 + vUv.x * 6.283 + uSeed);
  float a = min(core * ends * shimmer * uIntensity, 0.22);
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

const RAYS = [
  { off: [0, 0, 0], rTop: 0.35, rBot: 1.7, len: 19, intensity: 0.2, aim: [0, 0, 0] },
  { off: [1.6, 0.4, 1.2], rTop: 0.2, rBot: 1.0, len: 18, intensity: 0.16, aim: [1.4, 0.2, 1] },
  { off: [-1.4, -0.2, 2], rTop: 0.25, rBot: 1.3, len: 20, intensity: 0.13, aim: [-1.6, 0, 1.4] },
  { off: [2.4, 0.8, -1.4], rTop: 0.18, rBot: 0.8, len: 17, intensity: 0.15, aim: [2.4, 0.5, -0.6] },
  { off: [0.6, -0.6, 3], rTop: 0.3, rBot: 2.2, len: 21, intensity: 0.09, aim: [0.3, -0.5, 2.6] },
] as const;

const MOTE_COUNT = 150;

export function GodRays({ rig, reduced }: { rig: HeroRig; reduced: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const motes = useRef<THREE.InstancedMesh>(null!);

  const res = useMemo(() => {
    const color = new THREE.Color(HERO.godRays.color);
    const src = new THREE.Vector3(...HERO.godRays.source);
    const up = new THREE.Vector3(0, -1, 0);
    const rays = RAYS.map((r, i) => {
      const geo = new THREE.CylinderGeometry(r.rTop, r.rBot, r.len, 32, 1, true);
      geo.translate(0, -r.len / 2, 0);
      const mat = new THREE.ShaderMaterial({
        vertexShader: rayVert,
        fragmentShader: rayFrag,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: r.intensity },
          uSeed: { value: i * 1.37 },
          uColor: { value: color },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const start = src.clone().add(new THREE.Vector3(...r.off));
      const aim = new THREE.Vector3(...HERO.godRays.aim).add(new THREE.Vector3(...r.aim));
      const dir = aim.clone().sub(start).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      return { geo, mat, start, dir, quat, base: r.intensity, len: r.len, rBot: r.rBot };
    });

    // Dust motes drifting inside the shafts.
    const r = mulberry32(21);
    const moteData = Array.from({ length: MOTE_COUNT }, () => {
      const ray = rays[Math.floor(r() * rays.length)];
      const t = lerp(0.35, 0.92, r());
      const base = ray.start.clone().addScaledVector(ray.dir, ray.len * t);
      const radial = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(ray.rBot * t * 0.6 * r());
      return {
        base: base.add(radial),
        size: lerp(0.01, 0.034, r() * r()),
        phase: r() * Math.PI * 2,
        speed: lerp(0.15, 0.45, r()),
      };
    });
    const moteGeo = new THREE.IcosahedronGeometry(1, 0);
    const moteMat = new THREE.MeshBasicMaterial({
      color: '#fff3cf',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    return { rays, moteData, moteGeo, moteMat };
  }, []);

  useEffect(
    () => () => {
      res.rays.forEach((r) => {
        r.geo.dispose();
        r.mat.dispose();
      });
      res.moteGeo.dispose();
      res.moteMat.dispose();
    },
    [res],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offset = useRef(0);

  useFrame((state, delta) => {
    const t = reduced ? 0 : state.clock.elapsedTime;
    const p = rig.scrollP;
    offset.current = damp(offset.current, -rig.mx * HERO.parallax.rays, 2, Math.min(delta, 0.1));
    group.current.position.x = offset.current;
    const widen = 1 + p * HERO.scrollOut.raysWiden;
    const glow = (1 + p * HERO.scrollOut.raysBrighten) * lerp(0.2, 1, rig.intro);
    group.current.children.forEach((child, i) => {
      if (i >= res.rays.length) return;
      child.scale.set(widen, 1, widen);
      const u = res.rays[i].mat.uniforms;
      u.uTime.value = t;
      u.uIntensity.value = res.rays[i].base * glow;
    });
    for (let i = 0; i < MOTE_COUNT; i++) {
      const m = res.moteData[i];
      dummy.position.set(
        m.base.x + Math.sin(t * m.speed + m.phase) * 0.35,
        m.base.y + Math.sin(t * m.speed * 0.7 + m.phase * 1.3) * 0.3,
        m.base.z + Math.cos(t * m.speed * 0.8 + m.phase) * 0.35,
      );
      dummy.scale.setScalar(m.size * (0.55 + 0.45 * Math.sin(t * 1.4 + m.phase * 3)));
      dummy.updateMatrix();
      motes.current.setMatrixAt(i, dummy.matrix);
    }
    motes.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group}>
      {res.rays.map((r, i) => (
        <mesh key={i} geometry={r.geo} material={r.mat} position={r.start} quaternion={r.quat} renderOrder={10} />
      ))}
      <instancedMesh ref={motes} args={[res.moteGeo, res.moteMat, MOTE_COUNT]} frustumCulled={false} renderOrder={11} />
    </group>
  );
}

// ─── Fog layers ──────────────────────────────────────────────────────────────
const fogVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fogFrag = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec2 uDrift;
uniform vec2 uScale;
uniform float uBottomHeavy;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.02; a *= 0.5; }
  return s;
}
void main() {
  vec2 p = vUv * uScale + uDrift * uTime;
  float n = fbm(p + fbm(p * 0.5 + uTime * 0.02));
  n = smoothstep(0.28, 0.8, n);
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float vert = mix(smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y), smoothstep(1.0, 0.15, vUv.y), uBottomHeavy);
  gl_FragColor = vec4(uColor, n * edge * vert * uOpacity);
  #include <colorspace_fragment>
}
`;

const FOG_LAYERS = [
  { key: 'far', pos: [0, 1.5, -13], size: [90, 22], color: '#2d6f4a', opacity: 0.42, scale: [3, 1.1], drift: [0.006, 0], bottomHeavy: 0, factor: HERO.parallax.fogFar },
  { key: 'mid', pos: [0, -2.3, -1.5], size: [36, 6], color: '#24603f', opacity: 0.55, scale: [3.5, 1], drift: [0.012, 0.002], bottomHeavy: 0, factor: HERO.parallax.fogMid },
  { key: 'near', pos: [0, -1.6, 6.5], size: [34, 5], color: '#163f2b', opacity: 0.6, scale: [3, 0.9], drift: [-0.016, 0.003], bottomHeavy: 1, factor: HERO.parallax.fogNear },
] as const;

export function FogLayers({ rig, reduced }: { rig: HeroRig; reduced: boolean }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const mats = useMemo(
    () =>
      FOG_LAYERS.map(
        (l) =>
          new THREE.ShaderMaterial({
            vertexShader: fogVert,
            fragmentShader: fogFrag,
            uniforms: {
              uTime: { value: 0 },
              uOpacity: { value: l.opacity },
              uColor: { value: new THREE.Color(l.color) },
              uDrift: { value: new THREE.Vector2(...l.drift) },
              uScale: { value: new THREE.Vector2(...l.scale) },
              uBottomHeavy: { value: l.bottomHeavy },
            },
            transparent: true,
            depthWrite: false,
          }),
      ),
    [],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = reduced ? 0 : state.clock.elapsedTime;
    FOG_LAYERS.forEach((l, i) => {
      mats[i].uniforms.uTime.value = t;
      const m = refs.current[i];
      if (!m) return;
      m.position.x = damp(m.position.x, l.pos[0] - rig.mx * l.factor, 2.2, dt);
      m.position.y = damp(m.position.y, l.pos[1] + rig.my * l.factor * 0.3 + rig.scrollP * (i === 2 ? 1.6 : 0.6), 2.2, dt);
      mats[i].uniforms.uOpacity.value = l.opacity * (1 + rig.scrollP * 0.4);
    });
  });

  return (
    <>
      {FOG_LAYERS.map((l, i) => (
        <mesh
          key={l.key}
          ref={(m) => {
            if (m) refs.current[i] = m;
          }}
          position={[l.pos[0], l.pos[1], l.pos[2]]}
          material={mats[i]}
          renderOrder={i === 2 ? 20 : 5 + i}
        >
          <planeGeometry args={[l.size[0], l.size[1]]} />
        </mesh>
      ))}
    </>
  );
}

// ─── Endless forest silhouettes ──────────────────────────────────────────────
const FOREST_COUNT = 90;

export function DistantForest() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const res = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.1, 0.18, 3, 6, 1).toNonIndexed();
    trunk.translate(0, 1.5, 0);
    const crown = new THREE.IcosahedronGeometry(1.3, 2);
    crown.scale(1.25, 0.75, 1.25);
    crown.translate(0, 3.4, 0);
    const crown2 = new THREE.IcosahedronGeometry(0.9, 2);
    crown2.scale(1.2, 0.8, 1.2);
    crown2.translate(0.8, 3.0, 0.3);
    const geo = mergeGeometries([trunk, crown, crown2])!;
    [trunk, crown, crown2].forEach((g) => g.dispose());
    const mat = new THREE.MeshStandardMaterial({ color: '#123a27', roughness: 1 });
    return { geo, mat };
  }, []);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res],
  );

  useLayoutEffect(() => {
    const r = mulberry32(42);
    const d = new THREE.Object3D();
    for (let i = 0; i < FOREST_COUNT; i++) {
      const z = lerp(-14, -46, Math.pow(r(), 0.8));
      const spread = lerp(22, 62, (-z - 14) / 32);
      const x = lerp(-spread, spread, r());
      const s = lerp(1.4, 3.2, r());
      d.position.set(x, lerp(-11, -5.5, r()) + (-z - 8) * 0.06, z);
      d.rotation.set(0, r() * 6, lerp(-0.05, 0.05, r()));
      d.scale.set(s * lerp(0.9, 1.3, r()), s * lerp(0.9, 1.4, r()), s);
      d.updateMatrix();
      mesh.current.setMatrixAt(i, d.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, []);

  return <instancedMesh ref={mesh} args={[res.geo, res.mat, FOREST_COUNT]} />;
}
