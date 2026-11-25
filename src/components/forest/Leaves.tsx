import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  drainLeafSpawns,
  onBurst,
  parallax,
  pointer,
  scroll,
  toScene,
  type Burst,
} from '../../lib/interaction';
import { lerp, pick, rand, randIn, smoothstep } from '../../lib/math';
import { LEAVES } from '../../tunables';
import { createLeafGeometry, layerMaterialDefaults } from './geometry';
import { leafFrag, leafVert } from './shaders';

interface Leaf {
  active: boolean;
  ambient: boolean;
  depth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  fall: number;
  a1: number;
  f1: number;
  p1: number;
  a2: number;
  f2: number;
  p2: number;
  rot: number;
  spin: number;
  tumble: number;
  tumbleSpeed: number;
  /** 0→1 ramp so handed-off leaves blend into the ambient sway. */
  swayIn: number;
  pulse: number;
}

const TOTAL = LEAVES.count + LEAVES.poolFromTree;
const TAU = Math.PI * 2;
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

function makeLeaf(ambient: boolean, depth: number): Leaf {
  return {
    active: ambient,
    ambient,
    depth,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: THREE.MathUtils.clamp(lerp(LEAVES.sizeMin, LEAVES.sizeMax, depth) * rand(0.88, 1.12), LEAVES.sizeMin, LEAVES.sizeMax),
    alpha: lerp(LEAVES.alphaMin, LEAVES.alphaMax, depth),
    fall: lerp(LEAVES.fallSpeed[0], LEAVES.fallSpeed[1], depth) * rand(0.85, 1.15),
    a1: randIn(LEAVES.swayAmp1) * (0.5 + depth * 0.5),
    f1: randIn(LEAVES.swayFreq1) * TAU,
    p1: rand(0, TAU),
    a2: randIn(LEAVES.swayAmp2),
    f2: randIn(LEAVES.swayFreq2) * TAU,
    p2: rand(0, TAU),
    rot: rand(0, TAU),
    spin: randIn(LEAVES.spin) * (Math.random() < 0.5 ? -1 : 1),
    tumble: rand(0, TAU),
    tumbleSpeed: randIn(LEAVES.tumble),
    swayIn: 1,
    pulse: rand(0, TAU),
  };
}

export function Leaves({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const size = useThree((s) => s.size);
  const pending = useRef<Burst[]>([]);
  const initialized = useRef(false);

  const { geometry, material, leaves, alphaAttr, colorA, colorB } = useMemo(() => {
    const geometry = createLeafGeometry();
    const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL), 1);
    const colorA = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 3), 3);
    const colorB = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 3), 3);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aAlpha', alphaAttr);
    geometry.setAttribute('aColorA', colorA);
    geometry.setAttribute('aColorB', colorB);

    // Instances draw in index order with depth test off → sort far-to-near.
    const depths = Array.from({ length: LEAVES.count }, () => Math.pow(Math.random(), 1.2)).sort((a, b) => a - b);
    const leaves: Leaf[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const ambient = i < LEAVES.count;
      leaves.push(makeLeaf(ambient, ambient ? depths[i] : rand(0.75, 0.95)));
      tmpColor.set(pick(LEAVES.brightPalette));
      colorA.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      tmpColor.set(pick(LEAVES.darkPalette));
      colorB.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: leafVert,
      fragmentShader: leafFrag,
      uniforms: { uDark: { value: 0 } },
      ...layerMaterialDefaults,
    });
    return { geometry, material, leaves, alphaAttr, colorA, colorB };
  }, []);

  useEffect(() => onBurst((b) => pending.current.push(b)), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = state.clock.elapsedTime;
    const w = size.width;
    const h = size.height;
    const m = mesh.current;

    if (!initialized.current) {
      for (const l of leaves) {
        l.x = rand(-w / 2, w / 2);
        l.y = rand(-h / 2, h / 2);
      }
      initialized.current = true;
    }

    material.uniforms.uDark.value = smoothstep(LEAVES.darkenRange[0], LEAVES.darkenRange[1], scroll.progress);

    // Leaves arriving from the hero tree.
    drainLeafSpawns((s) => {
      const idx = leaves.findIndex((l, i) => i >= LEAVES.count && !l.active);
      if (idx < 0) return;
      const l = leaves[idx];
      const p = toScene(s.x, s.y);
      Object.assign(l, makeLeaf(false, l.depth), {
        active: true,
        x: p.x,
        y: p.y,
        vx: s.vx,
        vy: -s.vy,
        size: s.size,
        rot: s.rot,
        alpha: 0.58,
        swayIn: 0,
      });
      tmpColor.set(s.color);
      colorA.setXYZ(idx, tmpColor.r, tmpColor.g, tmpColor.b);
      colorB.setXYZ(idx, tmpColor.r * 0.75, tmpColor.g * 0.75, tmpColor.b * 0.75);
      colorA.needsUpdate = true;
      colorB.needsUpdate = true;
    });

    const bursts = pending.current.splice(0);
    const cursor = pointer.active && !reduced ? toScene(pointer.x, pointer.y) : null;
    const R = LEAVES.cursorRadius;

    for (let i = 0; i < TOTAL; i++) {
      const l = leaves[i];
      if (!l.active) {
        alphaAttr.setX(i, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const depthMul = 0.3 + 0.7 * l.depth;
      let px: number;
      let py: number;
      let rotZ: number;
      let flip: number;
      let alpha = l.alpha;

      if (reduced) {
        // Static, gently breathing scene.
        px = l.x;
        py = l.y;
        rotZ = l.rot;
        flip = 0.55 + 0.45 * Math.abs(Math.cos(l.tumble));
        alpha *= 0.75 + 0.25 * Math.sin((t / LEAVES.reducedPulseSeconds) * TAU + l.pulse);
      } else {
        l.y -= l.fall * dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        const k = Math.exp(-LEAVES.pushDamping * dt);
        l.vx *= k;
        l.vy *= k;
        l.swayIn = Math.min(1, l.swayIn + dt * 0.6);

        const ph1 = t * l.f1 + l.p1;
        const sway = (l.a1 * Math.sin(ph1) + l.a2 * Math.sin(t * l.f2 + l.p2)) * l.swayIn;
        px = l.x + sway + parallax.x * depthMul;
        py = l.y + parallax.y * depthMul;

        if (cursor) {
          const dx = px - cursor.x;
          const dy = py - cursor.y;
          const d = Math.hypot(dx, dy);
          if (d < R && d > 0.001) {
            const f = Math.pow(1 - d / R, 2);
            l.vx += ((dx / d) * LEAVES.cursorForce + pointer.vx * LEAVES.cursorVelocityTransfer * 3) * f * dt;
            l.vy += ((dy / d) * LEAVES.cursorForce - pointer.vy * LEAVES.cursorVelocityTransfer * 3) * f * dt;
          }
        }
        for (const b of bursts) {
          const bp = toScene(b.x, b.y);
          const dx = px - bp.x;
          const dy = py - bp.y;
          const d = Math.hypot(dx, dy);
          if (d < LEAVES.burstRadius && d > 0.001) {
            const f = (1 - d / LEAVES.burstRadius) * LEAVES.burstImpulse * b.strength;
            l.vx += (dx / d) * f;
            l.vy += (dy / d) * f;
          }
        }

        l.rot += (l.spin + l.vx * 0.003) * dt;
        l.tumble += l.tumbleSpeed * dt;
        rotZ = l.rot + LEAVES.rockAmount * Math.cos(ph1) * l.swayIn;
        flip = 0.25 + 0.75 * Math.abs(Math.cos(l.tumble));

        const margin = l.size * 2 + 40;
        if (l.y < -h / 2 - margin) {
          if (l.ambient) {
            l.y = h / 2 + margin + rand(0, h * 0.2);
            l.x = rand(-w / 2, w / 2);
            l.vx = 0;
            l.vy = 0;
          } else {
            l.active = false;
          }
        }
        if (l.x < -w / 2 - margin) l.x += w + margin * 2;
        else if (l.x > w / 2 + margin) l.x -= w + margin * 2;
      }

      alphaAttr.setX(i, alpha);
      dummy.position.set(px, py, 0);
      dummy.rotation.set(0, 0, rotZ);
      dummy.scale.set(l.size * flip, l.size, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, TOTAL]} frustumCulled={false} renderOrder={2} />;
}
