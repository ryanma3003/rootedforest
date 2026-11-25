import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm3, lerp, mulberry32, noise3, smoothstep } from '../../lib/math';
import { COLORS, HERO } from '../../tunables';
import { withWind, type HeroRig, type WindUniforms } from './rig';
import { taperedTube } from './treeGen';

const R = HERO.island.radius;
const UNDER_H = 3.4;
const dummy = new THREE.Object3D();

function edgeWobble(a: number) {
  return 1 + 0.05 * Math.sin(a * 5 + 0.7) + 0.035 * Math.sin(a * 11 + 2.1) + 0.02 * Math.sin(a * 23 + 0.4);
}

function buildTop() {
  const g = new THREE.CylinderGeometry(R, R * 0.92, 0.5, 112, 3, false);
  const p = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const colors = new Float32Array(p.count * 3);
  const grass = new THREE.Color('#3b6a2c');
  const grassLight = new THREE.Color('#56873a');
  const soil = new THREE.Color('#4b3424');
  const soilDark = new THREE.Color('#2a1c12');
  const moss = new THREE.Color('#2f4a22');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const isCap = nrm.getY(i) > 0.9;
    const a = Math.atan2(z, x);
    const w = edgeWobble(a);
    x *= w;
    z *= w;
    const rr = Math.hypot(x, z) / R;
    if (isCap) {
      y += (noise3(x * 0.9, 0, z * 0.9) - 0.5) * 0.08 * rr;
      c.copy(grass).lerp(grassLight, fbm3(x * 1.3, 4, z * 1.3));
    } else if (y > 0.12) {
      c.copy(moss);
    } else {
      c.copy(soil).lerp(soilDark, smoothstep(0.1, -0.25, y) * 0.8 + noise3(a * 4, y * 6, 1) * 0.2);
    }
    p.setXYZ(i, x, y, z);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.translate(0, -0.25, 0);
  g.computeVertexNormals();
  return g;
}

function buildUnderside() {
  const g = new THREE.ConeGeometry(R * 0.93, UNDER_H, 64, 14, true);
  g.rotateX(Math.PI);
  g.translate(0, -0.5 - UNDER_H / 2, 0);
  const p = g.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const soil = new THREE.Color('#47311f');
  const deep = new THREE.Color('#1b120b');
  const rock = new THREE.Color('#544e46');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const a = Math.atan2(z, x);
    const depthT = THREE.MathUtils.clamp((-0.5 - y) / UNDER_H, 0, 1);
    const n = fbm3(Math.cos(a) * 2 + 3, y * 1.6, Math.sin(a) * 2);
    const jag = (1 + (n - 0.5) * 0.7 * (0.35 + depthT)) * edgeWobble(a);
    x = x * jag + depthT * depthT * 0.35;
    z *= jag;
    y += (noise3(a * 3, y * 2, 5) - 0.5) * 0.35 * depthT;
    p.setXYZ(i, x, y, z);
    c.copy(soil).lerp(deep, depthT * 0.85);
    if (n > 0.6) c.lerp(rock, 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function buildRoots() {
  const r = mulberry32(HERO.island.seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 20; i++) {
    const a = r() * Math.PI * 2;
    const depthT = lerp(0.04, 0.62, r());
    const y0 = -0.5 - depthT * UNDER_H;
    const rad = R * 0.93 * (1 - depthT) * 0.92;
    const start = new THREE.Vector3(Math.cos(a) * rad, y0, Math.sin(a) * rad);
    const len = lerp(1.1, 2.8, r());
    const pts = [start];
    for (let k = 1; k <= 4; k++) {
      pts.push(
        new THREE.Vector3(
          start.x * (1 + k * 0.03) + (r() - 0.5) * 0.35,
          y0 - (len * k) / 4,
          start.z * (1 + k * 0.03) + (r() - 0.5) * 0.35,
        ),
      );
    }
    const thick = lerp(0.03, 0.055, r());
    parts.push(
      taperedTube(new THREE.CatmullRomCurve3(pts), 22, 5, (t) => lerp(thick, 0.005, t), {
        extra: { name: 'aSway', fn: (t) => Math.pow(t, 1.5) },
      }),
    );
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((x) => x.dispose());
  return g;
}

function buildMushroom() {
  const stem = new THREE.CylinderGeometry(0.014, 0.02, 0.09, 6, 1);
  stem.translate(0, 0.045, 0);
  const cap = new THREE.SphereGeometry(0.048, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.6, 1);
  cap.translate(0, 0.088, 0);
  const g = mergeGeometries([stem.toNonIndexed(), cap.toNonIndexed()])!;
  stem.dispose();
  cap.dispose();
  return g;
}

/** The acre: grass island, crumbling soil underside, floating chunks, hanging roots. */
export const Island = forwardRef<THREE.Group, { rig: HeroRig; reduced: boolean; mobile: boolean; children?: React.ReactNode }>(
  function Island({ rig, reduced, mobile, children }, ref) {
    const chunks = useRef<THREE.InstancedMesh>(null!);
    const blades = useRef<THREE.InstancedMesh>(null!);
    const shrooms = useRef<THREE.InstancedMesh>(null!);
    const bladeCount = mobile ? 900 : 1700;
    const CHUNKS = 26;
    const SHROOMS = 9;

    const res = useMemo(() => {
      const wind: WindUniforms = { uTime: { value: 0 }, uGust: { value: 0 } };
      const top = buildTop();
      const under = buildUnderside();
      const roots = buildRoots();
      const rock = new THREE.DodecahedronGeometry(1, 0);
      const blade = new THREE.PlaneGeometry(0.045, 0.26, 1, 3);
      blade.translate(0, 0.13, 0);
      const bp = blade.getAttribute('position');
      for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - bp.getY(i) / 0.27));
      const shroom = buildMushroom();

      const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
      const underMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
      const rockMat = new THREE.MeshStandardMaterial({ color: '#3f2c1f', roughness: 1, flatShading: true });
      const rootMat = withWind(
        new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 }),
        wind,
        /* glsl */ `
          transformed.x += sin(uTime * 0.8 + position.y * 1.3 + position.z * 2.0) * 0.12 * aSway;
          transformed.z += cos(uTime * 0.6 + position.x * 2.0) * 0.08 * aSway;
        `,
        'attribute float aSway;',
      );
      const grassMat = withWind(
        new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 }),
        wind,
        /* glsl */ `
          #ifdef USE_INSTANCING
            float gp = dot(instanceMatrix[3].xz, vec2(4.1, 3.3));
            float bendAmt = uv.y * uv.y;
            transformed.x += (sin(uTime * 1.7 + gp) * 0.035 + uGust * 0.03 * sin(uTime * 5.0 + gp)) * bendAmt;
            transformed.z += cos(uTime * 1.3 + gp) * 0.025 * bendAmt;
          #endif
        `,
      );
      const shroomMat = new THREE.MeshStandardMaterial({
        color: '#d6f9e2',
        emissive: new THREE.Color(COLORS.mint),
        emissiveIntensity: 1.5,
        roughness: 0.5,
      });
      return { wind, top, under, roots, rock, blade, shroom, groundMat, underMat, rockMat, rootMat, grassMat, shroomMat };
    }, []);

    useEffect(
      () => () => {
        Object.values(res).forEach((v) => {
          if (v instanceof THREE.BufferGeometry || v instanceof THREE.Material) v.dispose();
        });
      },
      [res],
    );

    const chunkData = useMemo(() => {
      const r = mulberry32(HERO.island.seed + 5);
      return Array.from({ length: CHUNKS }, () => {
        const a = r() * Math.PI * 2;
        const near = r();
        return {
          pos: new THREE.Vector3(
            Math.cos(a) * R * lerp(0.82, 1.35, near),
            lerp(-0.4, -3.1, Math.pow(r(), 1.2)) * lerp(1, 0.55, near),
            Math.sin(a) * R * lerp(0.82, 1.35, near),
          ),
          size: lerp(0.32, 0.06, near) * lerp(0.7, 1.2, r()),
          rot: new THREE.Euler(r() * 6, r() * 6, r() * 6),
          spin: lerp(-0.25, 0.25, r()),
          phase: r() * Math.PI * 2,
        };
      });
    }, []);

    useLayoutEffect(() => {
      const r = mulberry32(HERO.island.seed + 9);
      const col = new THREE.Color();
      const greens = ['#3f7a2e', '#4d8a35', '#5c9a3e', '#335f27', '#6aa84a'];
      for (let i = 0; i < bladeCount; i++) {
        let rad = 0;
        let a = 0;
        do {
          rad = R * 0.97 * Math.sqrt(r());
          a = r() * Math.PI * 2;
        } while (rad < 0.4);
        const w = edgeWobble(a);
        dummy.position.set(Math.cos(a) * rad * w, -0.01, Math.sin(a) * rad * w);
        dummy.rotation.set(lerp(-0.25, 0.25, r()), r() * Math.PI, lerp(-0.25, 0.25, r()));
        dummy.scale.setScalar(lerp(0.7, 1.55, r()));
        dummy.updateMatrix();
        blades.current.setMatrixAt(i, dummy.matrix);
        col.set(greens[Math.floor(r() * greens.length)]).multiplyScalar(lerp(0.7, 1.1, r()));
        blades.current.setColorAt(i, col);
      }
      blades.current.instanceMatrix.needsUpdate = true;
      blades.current.instanceColor!.needsUpdate = true;

      // Glowing mushrooms in two little clusters near the rim.
      for (let i = 0; i < SHROOMS; i++) {
        const base = i < 5 ? 2.4 : 4.1;
        const a = base + lerp(-0.18, 0.18, r());
        const rad = R * lerp(0.78, 0.92, r());
        dummy.position.set(Math.cos(a) * rad, -0.01, Math.sin(a) * rad);
        dummy.rotation.set(lerp(-0.2, 0.2, r()), r() * 6, lerp(-0.2, 0.2, r()));
        dummy.scale.setScalar(lerp(0.7, 1.4, r()));
        dummy.updateMatrix();
        shrooms.current.setMatrixAt(i, dummy.matrix);
      }
      shrooms.current.instanceMatrix.needsUpdate = true;
    }, [bladeCount]);

    useFrame((state) => {
      const t = reduced ? 0 : state.clock.elapsedTime;
      res.wind.uTime.value = t;
      res.wind.uGust.value = rig.gust;
      res.shroomMat.emissiveIntensity = 1.3 + 0.35 * Math.sin(state.clock.elapsedTime * 0.9);
      for (let i = 0; i < CHUNKS; i++) {
        const c = chunkData[i];
        dummy.position.copy(c.pos);
        dummy.position.y += Math.sin(t * 0.6 + c.phase) * 0.07;
        dummy.rotation.set(c.rot.x + t * c.spin, c.rot.y + t * c.spin * 0.7, c.rot.z);
        dummy.scale.setScalar(c.size);
        dummy.updateMatrix();
        chunks.current.setMatrixAt(i, dummy.matrix);
      }
      chunks.current.instanceMatrix.needsUpdate = true;
    });

    const shroomPos = useMemo(() => new THREE.Vector3(Math.cos(2.4) * R * 0.85, 0.25, Math.sin(2.4) * R * 0.85), []);

    return (
      <group ref={ref}>
        <mesh geometry={res.top} material={res.groundMat} receiveShadow castShadow />
        <mesh geometry={res.under} material={res.underMat} castShadow />
        <mesh geometry={res.roots} material={res.rootMat} castShadow />
        <instancedMesh ref={chunks} args={[res.rock, res.rockMat, CHUNKS]} castShadow frustumCulled={false} />
        <instancedMesh key={bladeCount} ref={blades} args={[res.blade, res.grassMat, bladeCount]} receiveShadow />
        <instancedMesh ref={shrooms} args={[res.shroom, res.shroomMat, SHROOMS]} />
        <pointLight position={shroomPos} color={COLORS.mint} intensity={1.4} distance={2.6} decay={2} />
        {children}
      </group>
    );
  },
);
