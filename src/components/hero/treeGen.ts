import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm3, lerp, mulberry32, smoothstep } from '../../lib/math';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Tube along a curve with a radius that varies along length (t) and angle (a).
 * Optional per-vertex scalar attribute (e.g. sway weight) from t.
 */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  tubular: number,
  radial: number,
  radiusAt: (t: number, a: number) => number,
  opts: { vScale?: number; extra?: { name: string; fn: (t: number) => number } } = {},
) {
  const frames = curve.computeFrenetFrames(tubular, false);
  const len = curve.getLength();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const extra: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const s = Math.sin(a);
      const c = -Math.cos(a);
      N.set(c * n.x + s * b.x, c * n.y + s * b.y, c * n.z + s * b.z).normalize();
      const r = radiusAt(t, a);
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      nor.push(N.x, N.y, N.z);
      uv.push(j / radial, t * len * (opts.vScale ?? 1));
      if (opts.extra) extra.push(opts.extra.fn(t));
    }
  }
  const idx: number[] = [];
  for (let i = 1; i <= tubular; i++) {
    for (let j = 1; j <= radial; j++) {
      const a = (radial + 1) * (i - 1) + (j - 1);
      const b = (radial + 1) * i + (j - 1);
      const c = (radial + 1) * i + j;
      const d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (opts.extra) g.setAttribute(opts.extra.name, new THREE.Float32BufferAttribute(extra, 1));
  g.setIndex(idx);
  return g;
}

/** Bark tint with moss creeping up the buttresses and lichen patches higher up. */
function colorizeBark(g: THREE.BufferGeometry, darker: number) {
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const bark = new THREE.Color('#9b8f78').multiplyScalar(darker);
  const barkDark = new THREE.Color('#5e5444').multiplyScalar(darker);
  const moss = new THREE.Color('#4d7a35');
  const lichen = new THREE.Color('#b7c4a0');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = fbm3(x * 2.2, y * 1.4, z * 2.2);
    c.copy(bark).lerp(barkDark, smoothstep(0.35, 0.75, n));
    const mossAmt = smoothstep(2.2, 0.1, y) * smoothstep(0.3, 0.65, fbm3(x * 3.1 + 7, y * 2.3, z * 3.1));
    c.lerp(moss, mossAmt * 0.9);
    const lichenAmt = smoothstep(0.68, 0.8, fbm3(x * 5 + 3, y * 3, z * 5)) * smoothstep(1.5, 3, y);
    c.lerp(lichen, lichenAmt * 0.5);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export interface Cluster {
  center: THREE.Vector3;
  radius: number;
}

export interface TreeData {
  trunk: THREE.BufferGeometry;
  branches: THREE.BufferGeometry;
  proxy: THREE.BufferGeometry;
  leafCount: number;
  leafPos: THREE.Vector3[];
  leafQuat: THREE.Quaternion[];
  leafScale: number[];
  leafColor: THREE.Color[];
}

/** A rainforest emergent: buttressed pale trunk, wide umbrella crown. */
export function generateTree(seed: number, leafDensity: number): TreeData {
  const r = mulberry32(seed);
  const rr = (a: number, b: number) => lerp(a, b, r());

  const trunkCurve = new THREE.CatmullRomCurve3([
    v3(0, -0.35, 0),
    v3(0.06, 1.4, 0.03),
    v3(-0.07, 2.9, -0.04),
    v3(0.05, 4.3, 0.02),
    v3(-0.02, 5.5, 0),
  ]);
  const trunkParts: THREE.BufferGeometry[] = [
    taperedTube(
      trunkCurve,
      56,
      22,
      (t, a) =>
        lerp(0.36, 0.12, t) * (1 + 1.1 * Math.exp(-t * 16)) * (1 + 0.05 * Math.sin(a * 7 + t * 9) + 0.03 * Math.sin(a * 13 + t * 37)),
      { vScale: 0.45 },
    ),
  ];

  // Buttress roots flaring into the island.
  for (let i = 0; i < 7; i++) {
    const th = (i / 7) * Math.PI * 2 + rr(-0.2, 0.2);
    const h0 = rr(0.9, 1.6);
    const reach = rr(1.15, 1.7);
    const c = Math.cos(th);
    const s = Math.sin(th);
    const curve = new THREE.QuadraticBezierCurve3(
      v3(c * 0.18, h0, s * 0.18),
      v3(c * reach * 0.5, h0 * 0.22, s * reach * 0.5),
      v3(c * reach, -0.14, s * reach),
    );
    trunkParts.push(
      taperedTube(curve, 18, 10, (t, a) => lerp(0.17, 0.03, Math.pow(t, 0.8)) * (1 + 0.06 * Math.sin(a * 5 + t * 11)), {
        vScale: 0.45,
      }),
    );
  }

  const branchParts: THREE.BufferGeometry[] = [];
  const clusters: Cluster[] = [];
  const MAIN = 7;
  for (let i = 0; i < MAIN; i++) {
    const tOn = Math.min(0.97, 0.62 + (i / MAIN) * 0.34 + rr(0, 0.03));
    const start = trunkCurve.getPointAt(tOn);
    const th = i * 2.39996 + rr(-0.25, 0.25);
    const el = rr(0.3, 0.75);
    const L = rr(2.0, 3.0) * (1 - i * 0.04);
    const dir = v3(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el));
    const end = start.clone().addScaledVector(dir, L).add(v3(0, 0.3, 0));
    const ctrl = start.clone().add(v3(dir.x * L * 0.3, L * 0.45, dir.z * L * 0.3));
    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
    const baseR = 0.13 - i * 0.006;
    branchParts.push(
      taperedTube(curve, 20, 10, (t, a) => lerp(baseR, 0.035, t) * (1 + 0.04 * Math.sin(a * 6 + t * 13)), {
        vScale: 0.45,
      }),
    );
    clusters.push({ center: end.clone().add(v3(0, 0.25, 0)), radius: rr(0.95, 1.3) });

    const subs = 2 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < subs; k++) {
      const ts = rr(0.45, 0.85);
      const s = curve.getPointAt(ts);
      const sth = th + (k % 2 ? 1 : -1) * rr(0.6, 1.2);
      const sel = rr(0.45, 0.95);
      const L2 = rr(0.8, 1.5);
      const d2 = v3(Math.cos(sth) * Math.cos(sel), Math.sin(sel), Math.sin(sth) * Math.cos(sel));
      const e2 = s.clone().addScaledVector(d2, L2);
      const c2 = s.clone().addScaledVector(d2, L2 * 0.5).add(v3(0, 0.2, 0));
      const r0 = lerp(baseR, 0.035, ts) * 0.75;
      branchParts.push(
        taperedTube(new THREE.QuadraticBezierCurve3(s, c2, e2), 12, 7, (t) => lerp(r0, 0.016, t), { vScale: 0.45 }),
      );
      clusters.push({ center: e2.clone().add(v3(0, 0.18, 0)), radius: rr(0.65, 0.95) });
    }
  }
  clusters.push({ center: trunkCurve.getPointAt(1).add(v3(0, 0.45, 0)), radius: 1.15 });

  // Satellite clumps fill gaps for a dense, layered crown.
  const primary = clusters.slice();
  for (const c of primary) {
    for (let k = 0; k < 2; k++) {
      const a = rr(0, Math.PI * 2);
      const off = v3(Math.cos(a), rr(-0.3, 0.4), Math.sin(a)).multiplyScalar(c.radius * 0.85);
      clusters.push({ center: c.center.clone().add(off), radius: c.radius * rr(0.55, 0.75) });
    }
  }

  const trunk = mergeGeometries(trunkParts)!;
  const branches = mergeGeometries(branchParts)!;
  colorizeBark(trunk, 1);
  colorizeBark(branches, 0.82);
  trunkParts.forEach((g) => g.dispose());
  branchParts.forEach((g) => g.dispose());

  // Foliage: leaf cards biased to each clump's outer shell, normals outward/up.
  const palette = ['#2f6b2c', '#3d7d33', '#4c8f3a', '#29592a', '#5a9a3f', '#3f7a3c'].map((h) => new THREE.Color(h));
  const leafPos: THREE.Vector3[] = [];
  const leafQuat: THREE.Quaternion[] = [];
  const leafScale: number[] = [];
  const leafColor: THREE.Color[] = [];
  const dummy = new THREE.Object3D();
  const dir = new THREE.Vector3();
  for (const c of clusters) {
    const n = Math.round(c.radius * c.radius * leafDensity * 0.6);
    for (let i = 0; i < n; i++) {
      dir.set(rr(-1, 1), rr(-1, 1), rr(-1, 1));
      if (dir.lengthSq() < 1e-4) dir.set(0, 1, 0);
      dir.normalize();
      const depth = 0.45 + 0.55 * Math.sqrt(r());
      const radius = c.radius * depth;
      const p = c.center.clone().add(v3(dir.x * radius, dir.y * radius * 0.62, dir.z * radius));
      const normal = dir.clone().add(v3(0, 0.6, 0)).normalize();
      dummy.position.copy(p);
      dummy.lookAt(p.clone().add(normal));
      dummy.rotateZ(rr(0, Math.PI * 2));
      dummy.rotateX(rr(-0.45, 0.45));
      leafPos.push(p);
      leafQuat.push(dummy.quaternion.clone());
      leafScale.push(rr(0.75, 1.35));
      const shade = 0.42 + 0.58 * depth * (0.62 + 0.38 * (dir.y * 0.5 + 0.5));
      const col = palette[Math.floor(r() * palette.length)].clone();
      col.offsetHSL(rr(-0.015, 0.015), rr(-0.08, 0.08), rr(-0.03, 0.03)).multiplyScalar(shade);
      leafColor.push(col);
    }
  }

  // Cheap invisible hit volume for the crown (raycasting 4k instances is wasteful).
  const proxyParts = primary.map((c) => {
    const g = new THREE.IcosahedronGeometry(c.radius * 1.05, 1);
    g.scale(1, 0.7, 1);
    g.translate(c.center.x, c.center.y, c.center.z);
    return g;
  });
  const proxy = mergeGeometries(proxyParts)!;
  proxyParts.forEach((g) => g.dispose());

  return { trunk, branches, proxy, leafCount: leafPos.length, leafPos, leafQuat, leafScale, leafColor };
}
