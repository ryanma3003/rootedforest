import { useFrame, useThree } from '@react-three/fiber';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import * as THREE from 'three';
import { spawnLeaf } from '../../lib/interaction';
import { clamp, rand, randIn } from '../../lib/math';
import { HERO } from '../../tunables';

export interface FallingLeavesApi {
  spawn(pos: THREE.Vector3, quat: THREE.Quaternion, scale: number, color: THREE.Color, outward: THREE.Vector3): void;
}

interface FallingLeaf {
  active: boolean;
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  scale: number;
  color: THREE.Color;
  age: number;
  phase: number;
  rate: number;
  spinY: number;
  landedAt: number;
}

const POOL = 32;
const cfg = HERO.treeClick;
const n = new THREE.Vector3();
const dq = new THREE.Quaternion();
const euler = new THREE.Euler();
const mat = new THREE.Matrix4();
const s3 = new THREE.Vector3();
const ndc = new THREE.Vector3();
const ndc2 = new THREE.Vector3();
const box = new THREE.Box2();
const boxPts = [
  [2.9, 0.2, 0],
  [-2.9, 0.2, 0],
  [0, 0.2, 2.9],
  [0, 0.2, -2.9],
  [2.2, -1.2, 0],
  [-2.2, -1.2, 0],
  [0, -4, 0],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const tmp = new THREE.Vector3();
const p2 = new THREE.Vector2();

/**
 * Leaves detached from the canopy: gravity + plate-like air resistance
 * (strong drag along the leaf normal, weak along its surface → gliding),
 * a precessing flutter force for the spiral, and pendulum rocking.
 * Leaves that land on the island rest, then fade; the rest are handed off
 * to the global 2D falling-leaf layer at their exact screen position.
 */
export function FallingLeaves({
  apiRef,
  geometry,
  material,
  island,
}: {
  apiRef: Ref<FallingLeavesApi>;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  island: React.RefObject<THREE.Object3D>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);

  const leaves = useMemo<FallingLeaf[]>(
    () =>
      Array.from({ length: POOL }, () => ({
        active: false,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        scale: 1,
        color: new THREE.Color(),
        age: 0,
        phase: 0,
        rate: 0,
        spinY: 0,
        landedAt: -1,
      })),
    [],
  );

  useImperativeHandle(apiRef, () => ({
    spawn(pos, quat, scale, color, outward) {
      const l = leaves.find((x) => !x.active);
      if (!l) return;
      l.active = true;
      l.p.copy(pos);
      l.q.copy(quat);
      l.scale = scale;
      // Canopy colours carry baked-in crown shading; lift it so the leaf reads green once it's out in the light.
      const peak = Math.max(color.r, color.g, color.b, 1e-3);
      l.color.copy(color).multiplyScalar(Math.max(1.15, 0.32 / peak));
      l.v
        .copy(outward)
        .multiplyScalar(randIn(cfg.launchOut))
        .add(tmp.set(rand(-0.3, 0.3), randIn(cfg.launchUp), rand(-0.3, 0.3)));
      l.age = 0;
      l.phase = rand(0, Math.PI * 2);
      l.rate = randIn(cfg.flutterRate);
      l.spinY = rand(-2.5, 2.5);
      l.landedAt = -1;
      mesh.current.setColorAt(leaves.indexOf(l), l.color);
      mesh.current.instanceColor!.needsUpdate = true;
    },
  }));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const isl = island.current;
    if (!isl) return;
    const top = isl.position.y;
    const radius = HERO.island.radius * 0.95;

    // Island's screen-space footprint: hand-off only where the 2D leaf won't hide behind it.
    box.makeEmpty();
    for (const p of boxPts) {
      tmp.copy(p).add(isl.position).project(camera);
      box.expandByPoint(p2.set(tmp.x, tmp.y));
    }

    for (let i = 0; i < POOL; i++) {
      const l = leaves[i];
      if (!l.active) {
        mat.makeScale(0, 0, 0);
        mesh.current.setMatrixAt(i, mat);
        continue;
      }
      l.age += dt;
      let fade = 1;

      if (l.landedAt >= 0) {
        // Resting on the acre, then gently gone.
        l.p.y = top + 0.015;
        const rest = t - l.landedAt;
        fade = 1 - clamp((rest - cfg.restSeconds) / 1.5);
        if (fade <= 0) l.active = false;
      } else {
        l.v.y -= cfg.gravity * dt;
        n.set(0, 0, 1).applyQuaternion(l.q);
        const vn = l.v.dot(n);
        l.v.addScaledVector(n, -vn * (1 - Math.exp(-cfg.normalDrag * dt)));
        l.v.multiplyScalar(Math.exp(-cfg.tangentDrag * dt));
        l.phase += l.rate * dt;
        l.v.x += Math.cos(l.phase) * cfg.flutter * dt;
        l.v.z += Math.sin(l.phase) * cfg.flutter * dt;
        euler.set(Math.cos(l.phase) * cfg.rock * dt, l.spinY * dt, Math.sin(l.phase * 1.3) * cfg.rock * 0.6 * dt);
        l.q.multiply(dq.setFromEuler(euler));
        l.p.addScaledVector(l.v, dt);

        const horiz = Math.hypot(l.p.x - isl.position.x, l.p.z - isl.position.z);
        if (horiz < radius && l.p.y < top + 0.03 && l.p.y > top - 0.4) {
          l.landedAt = t;
          l.q.setFromEuler(euler.set(-Math.PI / 2, rand(0, Math.PI * 2), 0, 'YXZ'));
        } else if (l.p.y < top - 0.25 || l.age > 10) {
          ndc.copy(l.p).project(camera);
          const behindIsland = box.containsPoint(p2.set(ndc.x, ndc.y)) && l.p.y > -4;
          if (Math.abs(ndc.x) > 1.05 || ndc.y < -1.05 || l.p.y < -8) {
            l.active = false;
          } else if (!behindIsland) {
            const rect = gl.domElement.getBoundingClientRect();
            ndc2.copy(l.p).addScaledVector(l.v, 0.05).project(camera);
            const dist = camera.position.distanceTo(l.p);
            const pxPerUnit = rect.height / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
            euler.setFromQuaternion(l.q);
            spawnLeaf({
              x: rect.left + ((ndc.x + 1) / 2) * rect.width,
              y: rect.top + ((1 - ndc.y) / 2) * rect.height,
              vx: (((ndc2.x - ndc.x) / 2) * rect.width) / 0.05,
              vy: (((ndc.y - ndc2.y) / 2) * rect.height) / 0.05,
              size: clamp(cfg.leafLength * l.scale * pxPerUnit, 14, 40),
              rot: euler.z,
              color: `#${l.color.getHexString()}`,
            });
            l.active = false;
          }
        }
      }

      mat.compose(l.p, l.q, s3.setScalar(l.active ? l.scale * fade : 0));
      mesh.current.setMatrixAt(i, mat);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={(m) => {
        if (m && !m.instanceColor) {
          for (let i = 0; i < POOL; i++) m.setColorAt(i, new THREE.Color('#3d7d33'));
          mat.makeScale(0, 0, 0);
          for (let i = 0; i < POOL; i++) m.setMatrixAt(i, mat);
        }
        if (m) mesh.current = m;
      }}
      args={[geometry, material, POOL]}
      frustumCulled={false}
      castShadow
    />
  );
}
