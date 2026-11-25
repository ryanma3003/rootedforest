import * as THREE from 'three';

/** Unit-length leaf silhouette (y from -0.5 base to 0.5 tip), local x/y kept for vein shading. */
export function createLeafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.3, -0.32, 0.27, 0.18, 0, 0.5);
  s.bezierCurveTo(-0.27, 0.18, -0.3, -0.32, 0, -0.5);
  return new THREE.ShapeGeometry(s, 10);
}

/** Additive, depth-agnostic material defaults for the 2D layer. */
export const layerMaterialDefaults = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
} as const;
