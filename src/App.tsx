import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { ForestBackground } from './components/ForestBackground';
import { Hero } from './components/Hero';
import { SiteFooter } from './components/SiteFooter';
import { WaysToHelp, type HelpRequest, type HelpTarget } from './components/WaysToHelp';
import { useMediaQuery } from './lib/hooks';
import { env, initInteraction } from './lib/interaction';
import { COLORS, PAGE_GRADIENT } from './tunables';

const pageGradient = `linear-gradient(180deg, ${PAGE_GRADIENT.map(([c, p]) => `${c} ${p}%`).join(', ')})`;

// Static film grain (SVG turbulence) — one paint, no animation cost.
const grain =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function App() {
  const reduced = useReducedMotion() ?? false;
  const mobile = useMediaQuery('(max-width: 767px)');
  const [request, setRequest] = useState<HelpRequest | null>(null);

  useEffect(() => initInteraction(), []);
  useEffect(() => {
    env.reduced = reduced;
  }, [reduced]);

  const onRequest = useCallback((target: HelpTarget) => setRequest((r) => ({ target, n: (r?.n ?? 0) + 1 })), []);

  return (
    <div className="relative overflow-x-clip">
      {/* One continuous descent: canopy → forest → deep woods → night. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ background: pageGradient }}>
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            background: `radial-gradient(40% 18% at 18% 62%, ${COLORS.mint}14, transparent 70%), radial-gradient(35% 14% at 82% 80%, ${COLORS.mint}12, transparent 70%), radial-gradient(60% 12% at 50% 100%, ${COLORS.mint}10, transparent 75%)`,
          }}
        />
      </div>

      <ForestBackground reduced={reduced} />

      <a
        href="#help"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-full bg-mint px-4 py-2 font-display text-sm font-semibold text-ink transition-transform duration-300 ease-cinematic focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night"
      >
        Skip to ways to help
      </a>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-page items-center px-5 py-5 sm:px-8">
          <a
            href="#top"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full font-display text-lg font-bold tracking-[-0.02em] text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night"
          >
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
              <path fill={COLORS.mint} d="M16 3C9 9 7 15 9.5 21c1.4 3.3 4 5 6.5 5.6V30h2v-3.4c2.5-.6 5.1-2.3 6.5-5.6C27 15 23 9 16 3z" />
            </svg>
            Rooted
          </a>
        </div>
      </header>

      <main className="relative z-[2]">
        <Hero reduced={reduced} mobile={mobile} onRequest={onRequest} />
        <WaysToHelp request={request} reduced={reduced} />
      </main>
      <SiteFooter reduced={reduced} />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[45] opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: grain }}
      />
    </div>
  );
}
