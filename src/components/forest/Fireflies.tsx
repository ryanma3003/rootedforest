import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { now, parallax, pointer, recentBursts, scroll, toScene } from '../../lib/interaction';
import { clamp, damp, rand, randIn, smoothstep } from '../../lib/math';
import { FIREFLIES } from '../../tunables';
import { layerMaterialDefaults } from './geometry';
import { glowFrag, glowVert } from './shaders';

const TAU = Math.PI * 2;
const dummy = new THREE.Object3D();

/** Bioluminescent mint fireflies — the soul of the dark lower half. */
export function Fireflies({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const N = FIREFLIES.count;

  const { geometry, material, alphaAttr, flies } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    const mint = new THREE.Color(FIREFLIES.color);
    const warm = new THREE.Color('#d8ffb0');
    for (let i = 0; i < N; i++) {
      const c = mint.clone().lerp(warm, Math.random() * 0.35);
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    geometry.setAttribute('aAlpha', alphaAttr);
    geometry.setAttribute('aColor', colorAttr);
    const material = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      uniforms: { uCore: { value: 0.18 } },
      blending: THREE.AdditiveBlending,
      ...layerMaterialDefaults,
    });
    const flies = Array.from({ length: N }, () => ({
      hx: rand(-0.48, 0.48),
      hy: rand(-0.46, 0.32),
      ax: randIn(FIREFLIES.wander),
      ay: randIn(FIREFLIES.wander) * 0.7,
      fx: randIn(FIREFLIES.wanderFreq) * TAU,
      fy: randIn(FIREFLIES.wanderFreq) * TAU,
      px: rand(0, TAU),
      py: rand(0, TAU),
      pulseF: randIn(FIREFLIES.pulseFreq) * TAU,
      pulseP: rand(0, TAU),
      size: randIn(FIREFLIES.size),
      depth: rand(0.4, 1),
      ox: 0,
      oy: 0,
    }));
    return { geometry, material, alphaAttr, flies };
  }, [N]);

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
    const { width: w, height: h } = state.size;
    const visible = smoothstep(FIREFLIES.visibleRange[0], FIREFLIES.visibleRange[1], scroll.progress);
    const cursor = pointer.active && !reduced ? toScene(pointer.x, pointer.y) : null;
    const tNow = now();

    for (let i = 0; i < N; i++) {
      const f = flies[i];
      const motion = reduced ? 0 : 1;
      const bx = f.hx * w + f.ax * Math.sin(t * f.fx + f.px) * motion + parallax.x * f.depth;
      const by = f.hy * h + f.ay * Math.sin(t * f.fy + f.py) * motion + parallax.y * f.depth;

      // Shy: flee the cursor fast, then curiously drift back slowly.
      let tx = 0;
      let ty = 0;
      let fleeing = false;
      if (cursor) {
        const dx = bx + f.ox - cursor.x;
        const dy = by + f.oy - cursor.y;
        const d = Math.hypot(dx, dy);
        if (d < FIREFLIES.shyRadius && d > 0.001) {
          const push = FIREFLIES.shyDistance * (1 - d / FIREFLIES.shyRadius) + 30;
          tx = f.ox + (dx / d) * push;
          ty = f.oy + (dy / d) * push;
          fleeing = true;
        }
      }
      const rate = fleeing ? FIREFLIES.fleeRate : FIREFLIES.returnRate;
      f.ox = damp(f.ox, tx, rate, dt);
      f.oy = damp(f.oy, ty, rate, dt);

      const x = bx + f.ox;
      const y = by + f.oy;

      // Bursts briefly light up nearby fireflies.
      let boost = 0;
      for (const b of recentBursts) {
        const age = tNow - b.t;
        if (age > 2) continue;
        const bp = toScene(b.x, b.y);
        const d = Math.hypot(x - bp.x, y - bp.y);
        if (d < FIREFLIES.burstLightRadius) {
          boost += Math.exp(-age * FIREFLIES.burstLightDecay) * (1 - d / FIREFLIES.burstLightRadius) * 1.6;
        }
      }

      const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * f.pulseF + f.pulseP), 3);
      const a = clamp((pulse * 0.85 + boost) * visible * (0.55 + 0.45 * f.depth), 0, 1.4);
      alphaAttr.setX(i, a);
      dummy.position.set(x, y, 0);
      dummy.scale.setScalar(f.size * (0.8 + 0.25 * pulse + boost * 0.5));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, N]} frustumCulled={false} renderOrder={4} />;
}
