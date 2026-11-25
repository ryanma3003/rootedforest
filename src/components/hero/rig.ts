import * as THREE from 'three';

/** Per-frame hero state, written once by <RigDriver> and read by every scene piece. */
export interface HeroRig {
  /** Damped cursor, -1..1 (DOM orientation). */
  mx: number;
  my: number;
  /** 0..1 cursor speed, drives extra canopy flutter. */
  gust: number;
  /** GSAP-scrubbed scroll-out progress 0..1. */
  scrollP: number;
  /** Intro progress 0..1. */
  intro: number;
  time: number;
}

export const createRig = (): HeroRig => ({ mx: 0, my: 0, gust: 0, scrollP: 0, intro: 0, time: 0 });

export type WindUniforms = { uTime: { value: number }; uGust: { value: number } };

/**
 * Inject a vertex-wind displacement into a built-in material.
 * `body` runs after <begin_vertex> and may modify `transformed`.
 */
export function withWind<T extends THREE.Material>(material: T, uniforms: WindUniforms, body: string, decl = '') {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uGust = uniforms.uGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uGust;\n${decl}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${body}`);
  };
  material.customProgramCacheKey = () => body;
  return material;
}

/** Leaf flutter keyed off each instance's position so neighbours move differently. */
export const LEAF_FLUTTER = /* glsl */ `
#ifdef USE_INSTANCING
  float ph = dot(instanceMatrix[3].xyz, vec3(3.1, 1.7, 2.3));
  float fl = sin(uTime * 2.2 + ph) * 0.5 + sin(uTime * 3.7 + ph * 1.3) * 0.25;
  transformed.z += fl * (0.045 + 0.09 * uGust) * uv.y;
  transformed.x += sin(uTime * 1.6 + ph * 0.7) * (0.02 + 0.03 * uGust) * uv.y;
#endif
`;
