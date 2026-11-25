import { useCursor } from '@react-three/drei';
import { createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clamp, easeOutBack, randIn } from '../../lib/math';
import { HERO } from '../../tunables';
import { FallingLeaves, type FallingLeavesApi } from './FallingLeaves';
import { LEAF_FLUTTER, withWind, type HeroRig, type WindUniforms } from './rig';
import { makeBarkTexture, makeLeafTexture } from './textures';
import { generateTree } from './treeGen';

const PIVOT = HERO.tree.pivotY;
const deg = THREE.MathUtils.degToRad;
const mat = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const local = new THREE.Vector3();
const outward = new THREE.Vector3();

interface Detached {
  regrowAt: number;
}

export function Tree({
  rig,
  reduced,
  mobile,
  island,
}: {
  rig: HeroRig;
  reduced: boolean;
  mobile: boolean;
  island: React.RefObject<THREE.Group>;
}) {
  const scene = useThree((s) => s.scene);
  const data = useMemo(
    () => generateTree(HERO.tree.seed, mobile ? HERO.tree.mobileLeafDensity : HERO.tree.leafDensity),
    [mobile],
  );

  const res = useMemo(() => {
    const leafTex = makeLeafTexture();
    const barkTex = makeBarkTexture();
    const wind: WindUniforms = { uTime: { value: 0 }, uGust: { value: 0 } };
    const leafGeo = new THREE.PlaneGeometry(0.2, HERO.treeClick.leafLength);
    leafGeo.translate(0, HERO.treeClick.leafLength / 2, 0);
    const leafMat = withWind(
      new THREE.MeshStandardMaterial({
        map: leafTex,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.72,
        metalness: 0,
        emissive: new THREE.Color('#0b2a12'),
        emissiveIntensity: 0.35,
      }),
      wind,
      LEAF_FLUTTER,
    );
    const fallingMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.72,
      emissive: new THREE.Color('#0b2a12'),
      emissiveIntensity: 0.35,
    });
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: leafTex,
      alphaTest: 0.45,
    });
    const barkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      bumpMap: barkTex,
      bumpScale: 2.2,
      vertexColors: true,
      roughness: 0.93,
    });
    return { leafTex, barkTex, wind, leafGeo, leafMat, fallingMat, depthMat, barkMat };
  }, []);

  useEffect(
    () => () => {
      [res.leafTex, res.barkTex, res.leafGeo, res.leafMat, res.fallingMat, res.depthMat, res.barkMat].forEach((d) =>
        d.dispose(),
      );
    },
    [res],
  );
  useEffect(
    () => () => {
      data.trunk.dispose();
      data.branches.dispose();
      data.proxy.dispose();
    },
    [data],
  );

  const tree = useRef<THREE.Group>(null!);
  const canopyPivot = useRef<THREE.Group>(null!);
  const canopy = useRef<THREE.Group>(null!);
  const leaves = useRef<THREE.InstancedMesh>(null!);
  const falling = useRef<FallingLeavesApi>(null);
  const detached = useRef(new Map<number, Detached>());
  const [hovered, setHovered] = useState(false);
  const clock = useRef(0);
  useCursor(hovered);

  useLayoutEffect(() => {
    const m = leaves.current;
    for (let i = 0; i < data.leafCount; i++) {
      m.setMatrixAt(i, mat.compose(data.leafPos[i], data.leafQuat[i], scl.setScalar(data.leafScale[i])));
      m.setColorAt(i, data.leafColor[i]);
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor!.needsUpdate = true;
    m.computeBoundingSphere();
    detached.current.clear();
  }, [data]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    clock.current = t;
    const b = HERO.breathe;
    res.wind.uTime.value = reduced ? 0 : t;
    res.wind.uGust.value = rig.gust;
    const motion = reduced ? 0 : 1;

    // Trunk sway from the base; canopy adds its own sway + leans away from the cursor.
    tree.current.rotation.z = deg(b.swayDeg) * Math.sin((t / b.swaySeconds) * Math.PI * 2) * motion;
    tree.current.rotation.x = deg(b.swayDeg) * 0.5 * Math.sin((t / (b.swaySeconds * 1.37)) * Math.PI * 2) * motion;
    canopyPivot.current.rotation.z =
      (deg(b.canopySwayDeg) * Math.sin((t / (b.swaySeconds * 0.8)) * Math.PI * 2 + 0.6) + rig.mx * b.canopyLean) * motion;
    canopyPivot.current.rotation.x = rig.my * b.canopyLean * 0.5 * motion;

    // Regrow detached leaves.
    if (detached.current.size) {
      const m = leaves.current;
      for (const [idx, d] of detached.current) {
        if (t < d.regrowAt) continue;
        const k = clamp((t - d.regrowAt) / HERO.treeClick.regrowDuration);
        m.setMatrixAt(idx, mat.compose(data.leafPos[idx], data.leafQuat[idx], scl.setScalar(data.leafScale[idx] * easeOutBack(k))));
        if (k >= 1) detached.current.delete(idx);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  });

  const onTreeClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const regrowAt = clock.current + HERO.treeClick.regrowSeconds;
    const canopyGroup = canopy.current;
    canopyGroup.updateWorldMatrix(true, false);
    canopyGroup.worldToLocal(local.copy(e.point));
    // Clicking the lower trunk shakes leaves from the crown right above it.
    if (local.y < PIVOT + 0.8) local.set(local.x * 0.4, PIVOT + 2.2, local.z * 0.4 + 0.6);

    const candidates: { i: number; d: number }[] = [];
    for (let i = 0; i < data.leafCount; i++) {
      if (detached.current.has(i)) continue;
      candidates.push({ i, d: data.leafPos[i].distanceToSquared(local) });
    }
    candidates.sort((a, b) => a.d - b.d);
    const nearest = candidates.slice(0, 60);
    const count = Math.round(randIn(HERO.treeClick.leaves));
    const m = leaves.current;

    for (let k = 0; k < count && nearest.length; k++) {
      const { i } = nearest.splice(Math.floor(Math.random() * nearest.length), 1)[0];
      mat.compose(data.leafPos[i], data.leafQuat[i], scl.setScalar(data.leafScale[i]));
      mat.premultiply(canopyGroup.matrixWorld);
      mat.decompose(pos, quat, scl);
      outward.set(pos.x, 0, pos.z).normalize();
      if (outward.lengthSq() < 0.5) outward.set(1, 0, 0);
      falling.current?.spawn(pos, quat, scl.x, data.leafColor[i], outward);
      m.setMatrixAt(i, mat.makeScale(0, 0, 0));
      detached.current.set(i, { regrowAt });
    }
    m.instanceMatrix.needsUpdate = true;
  };

  const handlers = {
    onClick: onTreeClick,
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
    },
    onPointerOut: () => setHovered(false),
  };

  return (
    <>
      <group ref={tree}>
        <mesh geometry={data.trunk} material={res.barkMat} castShadow receiveShadow {...handlers} />
        <group ref={canopyPivot} position={[0, PIVOT, 0]}>
          <group ref={canopy} position={[0, -PIVOT, 0]}>
            <mesh geometry={data.branches} material={res.barkMat} castShadow receiveShadow {...handlers} />
            <instancedMesh
              key={data.leafCount}
              ref={leaves}
              args={[res.leafGeo, res.leafMat, data.leafCount]}
              customDepthMaterial={res.depthMat}
              castShadow
              receiveShadow
            />
            <mesh geometry={data.proxy} {...handlers}>
              <meshBasicMaterial visible={false} />
            </mesh>
          </group>
        </group>
      </group>
      {/* Physics runs in world space, so the pool lives at the scene root, not under the bobbing island. */}
      {createPortal(
        <FallingLeaves apiRef={falling} geometry={res.leafGeo} material={res.fallingMat} island={island} />,
        scene,
      )}
    </>
  );
}
