import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { parallax, pointer, scroll, toScene } from '../../lib/interaction';
import { rand, randIn, smoothstep } from '../../lib/math';
import { MOTES } from '../../tunables';
import { layerMaterialDefaults } from './geometry';
import { glowFrag, glowVert } from './shaders';

const TAU = Math.PI * 2;
const dummy = new THREE.Object3D();

/** Floating dust / light motes catching the light. */
export function Motes({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const N = MOTES.count;

  const { geometry, material, alphaAttr, colorAttr, motes, warm, cool } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aAlpha', alphaAttr);
    geometry.setAttribute('aColor', colorAttr);
    const material = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      uniforms: { uCore: { value: 0.35 } },
      blending: THREE.AdditiveBlending,
      ...layerMaterialDefaults,
    });
    const motes = Array.from({ length: N }, () => ({
      x: rand(-0.5, 0.5),
      y: rand(-0.5, 0.5),
      rise: randIn(MOTES.rise),
      sway: rand(6, 22),
      swayF: rand(0.08, 0.2) * TAU,
      phase: rand(0, TAU),
      size: randIn(MOTES.size),
      alpha: randIn(MOTES.alpha),
      depth: rand(0.2, 0.9),
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      init: false,
    }));
    return {
      geometry,
      material,
      alphaAttr,
      colorAttr,
      motes,
      warm: new THREE.Color(MOTES.warm),
      cool: new THREE.Color(MOTES.cool),
    };
  }, [N]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const tint = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = state.clock.elapsedTime;
    const { width: w, height: h } = state.size;
    tint.copy(warm).lerp(cool, smoothstep(0.1, 0.6, scroll.progress));
    const dim = 1 - smoothstep(0.5, 1, scroll.progress) * 0.35;
    const cursor = pointer.active && !reduced ? toScene(pointer.x, pointer.y) : null;

    for (let i = 0; i < N; i++) {
      const m = motes[i];
      if (!m.init) {
        m.x *= w;
        m.y *= h;
        m.init = true;
      }
      let alpha = m.alpha * dim;
      if (reduced) {
        alpha *= 0.7 + 0.3 * Math.sin(t * 0.8 + m.phase);
      } else {
        m.y += m.rise * dt;
        if (m.y > h / 2 + 20) {
          m.y = -h / 2 - 20;
          m.x = rand(-w / 2, w / 2);
        }
        if (cursor) {
          const dx = m.x + m.ox - cursor.x;
          const dy = m.y + m.oy - cursor.y;
          const d = Math.hypot(dx, dy);
          if (d < MOTES.cursorRadius && d > 0.001) {
            const f = Math.pow(1 - d / MOTES.cursorRadius, 2) * MOTES.cursorPush * dt;
            m.vx += (dx / d) * f;
            m.vy += (dy / d) * f;
          }
        }
        // Spring back to the drift path.
        m.vx += -m.ox * 4 * dt;
        m.vy += -m.oy * 4 * dt;
        m.vx *= Math.exp(-3 * dt);
        m.vy *= Math.exp(-3 * dt);
        m.ox += m.vx * dt;
        m.oy += m.vy * dt;
        alpha *= 0.6 + 0.4 * Math.sin(t * 1.3 + m.phase);
      }
      const sway = reduced ? 0 : m.sway * Math.sin(t * m.swayF + m.phase);
      dummy.position.set(m.x + sway + m.ox + parallax.x * m.depth, m.y + m.oy + parallax.y * m.depth, 0);
      dummy.scale.setScalar(m.size * 3);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      alphaAttr.setX(i, alpha);
      colorAttr.setXYZ(i, tint.r, tint.g, tint.b);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, N]} frustumCulled={false} renderOrder={1} />;
}
