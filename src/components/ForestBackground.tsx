import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { RENDER } from '../tunables';
import { Bursts } from './forest/Bursts';
import { Fireflies } from './forest/Fireflies';
import { Grass } from './forest/Grass';
import { Leaves } from './forest/Leaves';
import { Motes } from './forest/Motes';

function LayerCanvas({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 ${className}`}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1, near: 0.1, far: 100 }}
        dpr={[1, RENDER.maxDpr]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ pointerEvents: 'none' }}
      >
        {children}
      </Canvas>
    </div>
  );
}

/**
 * The "Living Forest": one fixed layer behind all content (leaves, motes,
 * back grass, fireflies) plus a thin foreground pass (front grass + life
 * bursts) so grass can grow up through the footer's bottom edge.
 */
export function ForestBackground({ reduced }: { reduced: boolean }) {
  return (
    <>
      <LayerCanvas className="z-[1]">
        <Motes reduced={reduced} />
        <Leaves reduced={reduced} />
        <Grass layer="back" reduced={reduced} />
        <Fireflies reduced={reduced} />
      </LayerCanvas>
      <LayerCanvas className="z-[40]">
        <Grass layer="front" reduced={reduced} />
        <Bursts reduced={reduced} />
      </LayerCanvas>
    </>
  );
}
