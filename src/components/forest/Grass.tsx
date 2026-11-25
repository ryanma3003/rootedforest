import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { onBurst, parallax, pointer, scroll, toScene, type Burst } from '../../lib/interaction';
import { clamp, lerp, rand, smoothstep } from '../../lib/math';
import { COLORS, GRASS } from '../../tunables';
import { layerMaterialDefaults } from './geometry';
import { grassFrag, grassVert } from './shaders';

const MARGIN = 48; // extra blades beyond the edges so parallax never reveals a gap

/**
 * Procedural grass anchored to the viewport bottom. Wind runs entirely on the
 * GPU; the cursor/click response is a per-blade damped spring on the CPU.
 */
export function Grass({ layer, reduced }: { layer: 'back' | 'front'; reduced: boolean }) {
  const cfg = GRASS.layers[layer];
  const width = useThree((s) => s.size.width);
  const pending = useRef<Burst[]>([]);

  const blade = useMemo(() => {
    const count = Math.ceil((width + MARGIN * 2) / cfg.spacing);
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 6);
    geometry.translate(0, 0.5, 0);
    const data = new Float32Array(count * 4);
    const pushAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    pushAttr.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) {
      data[i * 4] = -width / 2 - MARGIN + i * cfg.spacing + rand(-cfg.spacing, cfg.spacing) * 0.45;
      // Clumpy heights: mix a slow noise-ish wave with per-blade randomness.
      const clump = 0.5 + 0.5 * Math.sin(i * 0.21) * Math.sin(i * 0.053 + 1.3);
      data[i * 4 + 1] = lerp(cfg.height[0], cfg.height[1], clamp(clump * 0.55 + Math.random() * 0.6));
      data[i * 4 + 2] = rand(cfg.width[0], cfg.width[1]);
      data[i * 4 + 3] = Math.random();
    }
    // Sorting by x is not needed; order shuffles overlap naturally.
    geometry.setAttribute('aBlade', new THREE.InstancedBufferAttribute(data, 4));
    geometry.setAttribute('aPush', pushAttr);
    return {
      count,
      geometry,
      data,
      pushAttr,
      push: new Float32Array(count),
      vel: new Float32Array(count),
    };
  }, [width, cfg]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: grassVert,
        fragmentShader: grassFrag,
        uniforms: {
          uTime: { value: 0 },
          uGrow: { value: GRASS.growHero },
          uBottom: { value: 0 },
          uOffset: { value: new THREE.Vector2() },
          uWindAmp: { value: 1 },
          uWave: { value: new THREE.Vector4(GRASS.wave1[0], GRASS.wave1[1], GRASS.wave2[0], GRASS.wave2[1]) },
          uWaveAmp: { value: new THREE.Vector2(GRASS.waveAmp[0], GRASS.waveAmp[1]) },
          uGust: { value: new THREE.Vector2(GRASS.gust[0], GRASS.gust[1]) },
          uBase: { value: new THREE.Color(cfg.base) },
          uTip: { value: new THREE.Color(cfg.tip) },
          uGlow: { value: new THREE.Color(COLORS.mint) },
          uGlowAmt: { value: cfg.tipGlow },
          uAlpha: { value: cfg.alpha },
        },
        ...layerMaterialDefaults,
      }),
    [cfg],
  );

  useEffect(() => onBurst((b) => pending.current.push(b)), []);
  useEffect(() => () => blade.geometry.dispose(), [blade]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { height: h } = state.size;
    const u = material.uniforms;
    const viewportScale = clamp(h / 900, 0.62, 1);
    const grow =
      lerp(GRASS.growHero, GRASS.growFooter, smoothstep(GRASS.growRange[0], GRASS.growRange[1], scroll.progress)) *
      viewportScale;
    const offX = parallax.x * cfg.parallaxDepth;
    const offY = parallax.y * cfg.parallaxDepth * 0.3;
    const bottom = -h / 2 - GRASS.bottomBleed - Math.abs(offY);

    u.uTime.value = reduced ? 0 : state.clock.elapsedTime;
    u.uWindAmp.value = reduced ? 0 : 1;
    u.uGrow.value = grow;
    u.uBottom.value = bottom;
    (u.uOffset.value as THREE.Vector2).set(offX, offY);

    const bursts = pending.current.splice(0);
    if (reduced) return;

    const { count, data, push, vel, pushAttr } = blade;
    const cursor = pointer.active ? toScene(pointer.x, pointer.y) : null;
    const R = GRASS.cursorRadius;
    const K = GRASS.springK;
    const C = 2 * GRASS.springZeta * Math.sqrt(K);
    const scenes = bursts.map((b) => ({ ...toScene(b.x, b.y), s: b.strength }));

    for (let i = 0; i < count; i++) {
      const bx = data[i * 4] + offX;
      const top = bottom + data[i * 4 + 1] * grow;
      let target = 0;

      if (cursor) {
        const cy = clamp(cursor.y, bottom, top);
        const dx = bx - cursor.x;
        const d = Math.hypot(dx, (cursor.y - cy) * 0.8);
        if (d < R) {
          const f = 1 - d / R;
          const side = dx === 0 ? 1 : Math.sign(dx);
          target =
            (side * Math.pow(f, 1.3) * GRASS.cursorBend + pointer.vx * GRASS.cursorBrush * f) * cfg.cursorScale;
        }
      }
      for (const b of scenes) {
        const cy = clamp(b.y, bottom, top);
        const dx = bx - b.x;
        const d = Math.hypot(dx, b.y - cy);
        if (d < GRASS.burstRadius) {
          const side = Math.abs(dx) < 1 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
          vel[i] += side * GRASS.burstImpulse * (1 - d / GRASS.burstRadius) * b.s;
        }
      }

      // Semi-implicit Euler, under-damped: swings past, then settles.
      vel[i] += (K * (target - push[i]) - C * vel[i]) * dt;
      push[i] = clamp(push[i] + vel[i] * dt, -1.35, 1.35);
      pushAttr.setX(i, push[i]);
    }
    pushAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={blade.count}
      args={[blade.geometry, material, blade.count]}
      frustumCulled={false}
      renderOrder={layer === 'back' ? 3 : 1}
    />
  );
}
