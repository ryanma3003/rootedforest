/* GLSL for the 2D living-forest layer (orthographic, 1 unit = 1 CSS px). */

export const leafVert = /* glsl */ `
attribute float aAlpha;
attribute vec3 aColorA;
attribute vec3 aColorB;
uniform float uDark;
varying float vAlpha;
varying vec3 vColor;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vAlpha = aAlpha;
  vColor = mix(aColorA, aColorB, uDark);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const leafFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
varying vec2 vLocal;
void main() {
  float rib = 1.0 - smoothstep(0.0, 0.035, abs(vLocal.x));
  vec3 c = vColor * (0.8 + 0.24 * step(0.0, vLocal.x));
  c *= 1.0 - rib * 0.3;
  float veins = smoothstep(0.9, 1.0, sin((vLocal.y - abs(vLocal.x) * 1.5) * 36.0));
  c *= 1.0 - veins * 0.12;
  gl_FragColor = vec4(c, vAlpha);
  #include <colorspace_fragment>
}
`;

/** Soft additive glow quad (fireflies, motes). */
export const glowVert = /* glsl */ `
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
varying vec2 vUv;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const glowFrag = /* glsl */ `
uniform float uCore;
varying float vAlpha;
varying vec3 vColor;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, uCore, d);
  float halo = pow(max(0.0, 1.0 - d), 2.4);
  float a = (core * 0.95 + halo * 0.6) * vAlpha;
  gl_FragColor = vec4(vColor * (0.75 + core * 0.6), a);
  #include <colorspace_fragment>
}
`;

/** Burst leaf particles: leaf silhouette with a hot core. */
export const burstLeafFrag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying vec2 vLocal;
void main() {
  float rib = 1.0 - smoothstep(0.0, 0.06, abs(vLocal.x));
  vec3 c = uColor * (1.0 + rib * 0.6);
  gl_FragColor = vec4(c, vAlpha);
  #include <colorspace_fragment>
}
`;

export const burstLeafVert = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const ringVert = /* glsl */ `
attribute float aAlpha;
attribute float aProgress;
varying float vAlpha;
varying float vProgress;
varying vec2 vUv;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  vProgress = aProgress;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const ringFrag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vProgress;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float ring = exp(-pow((d - 0.86) / 0.07, 2.0));
  float fill = (1.0 - smoothstep(0.0, 0.9, d)) * 0.4 * (1.0 - vProgress);
  float a = (ring + fill) * vAlpha;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

export const grassVert = /* glsl */ `
attribute vec4 aBlade;   // x, height, width, seed
attribute float aPush;   // CPU spring bend (rad)
uniform float uTime;
uniform float uGrow;
uniform float uBottom;
uniform vec2 uOffset;
uniform float uWindAmp;
uniform vec4 uWave;      // f1, k1, f2, k2
uniform vec2 uWaveAmp;
uniform vec2 uGust;      // freq, k
varying float vH;
varying float vSeed;
void main() {
  float h = position.y;
  float height = aBlade.y * uGrow;
  float x0 = aBlade.x + uOffset.x;
  // Two traveling waves, phase-offset by x so gusts roll across the screen.
  float w1 = sin(uTime * uWave.x - x0 * uWave.y + aBlade.w * 1.7);
  float w2 = sin(uTime * uWave.z - x0 * uWave.w + aBlade.w * 5.3);
  float gust = 0.5 + 0.5 * sin(uTime * uGust.x - x0 * uGust.y);
  float lean = (aBlade.w - 0.5) * 0.32;
  float bend = (w1 * uWaveAmp.x + w2 * uWaveAmp.y) * (0.35 + gust) * uWindAmp + aPush + lean;
  float k = h * h;
  float px = x0 + position.x * aBlade.z * (1.0 - h * 0.94) + bend * height * k * 0.9;
  float py = uBottom + uOffset.y + height * h * (1.0 - 0.28 * bend * bend * k);
  vH = h;
  vSeed = aBlade.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(px, py, 0.0, 1.0);
}
`;

export const grassFrag = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
uniform vec3 uGlow;
uniform float uGlowAmt;
uniform float uAlpha;
varying float vH;
varying float vSeed;
void main() {
  vec3 c = mix(uBase, uTip, pow(vH, 1.4)) * (0.82 + 0.36 * vSeed);
  c += uGlow * uGlowAmt * pow(vH, 5.0) * step(0.62, vSeed);
  gl_FragColor = vec4(c, uAlpha);
  #include <colorspace_fragment>
}
`;
