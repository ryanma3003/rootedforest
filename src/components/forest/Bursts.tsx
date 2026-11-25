import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { onBurst, toScene, type Burst } from '../../lib/interaction';
import { clamp, easeOutBack, easeOutCubic, rand, randIn } from '../../lib/math';
import { BURST } from '../../tunables';
import { createLeafGeometry, layerMaterialDefaults } from './geometry';
import { burstLeafFrag, burstLeafVert, ringFrag, ringVert } from './shaders';

const dummy = new THREE.Object3D();

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  age: number;
  life: number;
  size: number;
}

interface Ring {
  active: boolean;
  x: number;
  y: number;
  age: number;
  strength: number;
}

/** "Life burst": mint leaf particles + an expanding ring of mint light. */
export function Bursts({ reduced }: { reduced: boolean }) {
  const leafMesh = useRef<THREE.InstancedMesh>(null!);
  const ringMesh = useRef<THREE.InstancedMesh>(null!);
  const pending = useRef<Burst[]>([]);

  const res = useMemo(() => {
    const color = new THREE.Color(BURST.color);
    const leafGeo = createLeafGeometry();
    const leafAlpha = new THREE.InstancedBufferAttribute(new Float32Array(BURST.particlePool), 1);
    leafAlpha.setUsage(THREE.DynamicDrawUsage);
    leafGeo.setAttribute('aAlpha', leafAlpha);
    const leafMat = new THREE.ShaderMaterial({
      vertexShader: burstLeafVert,
      fragmentShader: burstLeafFrag,
      uniforms: { uColor: { value: color } },
      blending: THREE.AdditiveBlending,
      ...layerMaterialDefaults,
    });

    const ringGeo = new THREE.PlaneGeometry(1, 1);
    const ringAlpha = new THREE.InstancedBufferAttribute(new Float32Array(BURST.ringPool), 1);
    const ringProg = new THREE.InstancedBufferAttribute(new Float32Array(BURST.ringPool), 1);
    ringAlpha.setUsage(THREE.DynamicDrawUsage);
    ringProg.setUsage(THREE.DynamicDrawUsage);
    ringGeo.setAttribute('aAlpha', ringAlpha);
    ringGeo.setAttribute('aProgress', ringProg);
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: { uColor: { value: color } },
      blending: THREE.AdditiveBlending,
      ...layerMaterialDefaults,
    });

    const particles: Particle[] = Array.from({ length: BURST.particlePool }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      spin: 0,
      age: 0,
      life: 1,
      size: 1,
    }));
    const rings: Ring[] = Array.from({ length: BURST.ringPool }, () => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      strength: 1,
    }));
    return { leafGeo, leafMat, leafAlpha, ringGeo, ringMat, ringAlpha, ringProg, particles, rings };
  }, []);

  useEffect(() => onBurst((b) => pending.current.push(b)), []);
  useEffect(
    () => () => {
      res.leafGeo.dispose();
      res.leafMat.dispose();
      res.ringGeo.dispose();
      res.ringMat.dispose();
    },
    [res],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const { particles, rings, leafAlpha, ringAlpha, ringProg } = res;

    for (const b of pending.current.splice(0)) {
      const p = toScene(b.x, b.y);
      // Ring: reuse the oldest slot if all are busy.
      let ring = rings.find((r) => !r.active);
      if (!ring) ring = rings.reduce((a, r) => (r.age > a.age ? r : a));
      Object.assign(ring, { active: true, x: p.x, y: p.y, age: 0, strength: b.strength });
      if (reduced) continue;

      const n = b.particles;
      const offset = rand(0, Math.PI * 2);
      for (let k = 0; k < n; k++) {
        const slot = particles.find((q) => !q.active);
        if (!slot) break;
        const a = offset + (k / n) * Math.PI * 2 + rand(-0.25, 0.25);
        const speed = randIn(BURST.speed) * b.strength;
        Object.assign(slot, {
          active: true,
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed + 60,
          rot: a - Math.PI / 2,
          spin: randIn(BURST.spin),
          age: 0,
          life: randIn(BURST.life),
          size: randIn(BURST.size) * (0.9 + 0.2 * b.strength),
        });
      }
    }

    // Particles: launched fast, eased by drag, gentle gravity, fade.
    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      if (!q.active) {
        leafAlpha.setX(i, 0);
        dummy.scale.setScalar(0);
      } else {
        q.age += dt;
        if (q.age >= q.life) q.active = false;
        const drag = Math.exp(-BURST.drag * dt);
        q.vx *= drag;
        q.vy = q.vy * drag - BURST.gravity * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += q.spin * dt * Math.exp(-q.age * 1.5);
        const life = clamp(q.age / q.life);
        leafAlpha.setX(i, q.active ? Math.pow(1 - life, 1.6) * 0.95 : 0);
        const pop = easeOutBack(clamp(q.age / 0.2));
        dummy.position.set(q.x, q.y, 0);
        dummy.rotation.set(0, 0, q.rot);
        dummy.scale.set(q.size * pop * (0.55 + 0.45 * Math.abs(Math.cos(q.age * 4 + i))), q.size * pop, 1);
      }
      dummy.updateMatrix();
      leafMesh.current.setMatrixAt(i, dummy.matrix);
    }
    leafMesh.current.instanceMatrix.needsUpdate = true;
    leafAlpha.needsUpdate = true;

    // Rings: expanding soft light, 450ms fade (static glow when reduced).
    const duration = reduced ? BURST.reducedGlowSeconds : BURST.ringDuration;
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.active) {
        r.age += dt;
        if (r.age >= duration) r.active = false;
      }
      const p = clamp(r.age / duration);
      const radius = reduced ? BURST.ringRadius * 0.55 : BURST.ringRadius * easeOutCubic(p) * (0.8 + 0.2 * r.strength);
      ringAlpha.setX(i, r.active ? Math.pow(1 - p, 2) * (reduced ? 0.5 : 0.9) : 0);
      ringProg.setX(i, reduced ? 0.5 : p);
      dummy.position.set(r.x, r.y, 0);
      dummy.scale.setScalar(r.active ? Math.max(radius * 2, 1) : 0);
      dummy.updateMatrix();
      ringMesh.current.setMatrixAt(i, dummy.matrix);
    }
    ringMesh.current.instanceMatrix.needsUpdate = true;
    ringAlpha.needsUpdate = true;
    ringProg.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={ringMesh} args={[res.ringGeo, res.ringMat, BURST.ringPool]} frustumCulled={false} renderOrder={5} />
      <instancedMesh
        ref={leafMesh}
        args={[res.leafGeo, res.leafMat, BURST.particlePool]}
        frustumCulled={false}
        renderOrder={6}
      />
    </>
  );
}
