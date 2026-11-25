import { AnimatePresence, motion, useScroll, useTransform, type Variants } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatNumber, useLiveCounter } from '../lib/hooks';
import { EASE, HERO } from '../tunables';
import { HeroScene } from './HeroScene';
import type { HelpTarget } from './WaysToHelp';

gsap.registerPlugin(ScrollTrigger);

interface HeroProps {
  reduced: boolean;
  mobile: boolean;
  onRequest: (target: HelpTarget) => void;
}

export function Hero({ reduced, mobile, onRequest }: HeroProps) {
  const section = useRef<HTMLElement>(null);
  const scrollRef = useRef({ p: 0 });
  const [active, setActive] = useState(true);
  const intro = reduced ? 0 : mobile ? HERO.intro.mobileSeconds : HERO.intro.desktopSeconds;

  // GSAP-scrubbed camera hand-off: pull back, rise, widen the god rays.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(scrollRef.current, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: section.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: reduced ? true : HERO.scrollOut.scrub,
        },
      });
    }, section);
    return () => ctx.revert();
  }, [reduced]);

  // Pause the WebGL loop once the hero has fully scrolled away.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '0px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const cardOpacity = useTransform(scrollYProgress, [0, 0.42], [1, 0]);
  const cardY = useTransform(scrollYProgress, [0, 0.42], [0, -70]);
  const cardEvents = useTransform(scrollYProgress, (v) => (v > 0.38 ? 'none' : 'auto'));
  const sceneOpacity = useTransform(scrollYProgress, [0.62, 1], [1, 0]);

  const container: Variants = {
    hidden: {},
    show: {
      transition: { delayChildren: intro * HERO.intro.cardDelayFraction, staggerChildren: reduced ? 0 : HERO.intro.cardStagger },
    },
  };
  const item: Variants = {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 24, filter: 'blur(6px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: EASE.cinematic } },
  };

  const go = (target: HelpTarget) => (e: React.MouseEvent) => {
    e.preventDefault();
    onRequest(target);
  };

  return (
    <section
      ref={section}
      id="top"
      aria-labelledby="hero-title"
      className="relative"
      style={{ height: `${HERO.sectionHeightVh}vh` }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div className="absolute inset-0" style={{ opacity: sceneOpacity }}>
          <HeroScene scrollRef={scrollRef} introSeconds={Math.max(intro, 0.001)} reduced={reduced} mobile={mobile} active={active} />
        </motion.div>

        {/* Warm sun bloom + readability scrim; fade with the scene so the hero never leaves a hard edge. */}
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: sceneOpacity }}>
          <div
            className="absolute inset-0 mix-blend-screen"
            style={{ background: 'radial-gradient(60% 55% at 8% 0%, rgba(255,222,160,0.16), transparent 70%)' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: mobile
                ? 'radial-gradient(90% 60% at 50% 60%, rgba(4,21,13,0.5), transparent 80%)'
                : 'linear-gradient(90deg, rgba(4,21,13,0.62) 0%, rgba(4,21,13,0.38) 38%, transparent 62%), radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(4,21,13,0.55) 100%)',
            }}
          />
        </motion.div>

        <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-page items-center px-5 pb-16 pt-20 sm:px-8 md:pb-0 md:pt-0">
          <motion.div className="w-full md:w-1/2" style={{ opacity: cardOpacity, y: cardY, pointerEvents: cardEvents }}>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="pointer-events-auto max-w-[600px] rounded-[28px] border border-mint/20 bg-deep/10 p-6 shadow-[0_30px_80px_-20px_rgba(2,10,6,0.75)] backdrop-blur-[18px] sm:p-9"
            >
              <motion.p
                variants={item}
                className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-night/30 px-3 py-1.5 font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mint"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint shadow-[0_0_10px_2px_rgba(124,240,168,0.7)]" />
                The Emerald Forest is disappearing
              </motion.p>

              <motion.h1
                id="hero-title"
                variants={item}
                className="mt-5 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white/90"
              >
                50,000 acres. One forest. <span className="text-mint">We're its last line of defense.</span>
              </motion.h1>

              <motion.p variants={item} className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-mist sm:text-lg">
                Adopt a single acre for $15 and it's protected permanently — bought, guarded, and off the logging map for good.
              </motion.p>

              <motion.div variants={item} className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#adopt"
                  onClick={go('adopt')}
                  className="group inline-flex items-center gap-2 rounded-full bg-mint px-6 py-3.5 font-display text-[15px] font-semibold text-ink shadow-[0_8px_30px_-8px_rgba(124,240,168,0.55)] transition-[transform,box-shadow] duration-300 ease-cinematic hover:-translate-y-0.5 hover:shadow-[0_14px_44px_-6px_rgba(124,240,168,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night"
                >
                  Adopt an Acre
                  <span aria-hidden="true" className="transition-transform duration-300 ease-cinematic group-hover:translate-x-0.5">
                    →
                  </span>
                </a>
                <a
                  href="#petition"
                  onClick={go('petition')}
                  className="inline-flex items-center rounded-full border border-mint/50 bg-mint/[0.06] px-6 py-3.5 font-display text-[15px] font-semibold text-mint backdrop-blur-md transition-[transform,background-color,border-color] duration-300 ease-cinematic hover:-translate-y-0.5 hover:border-mint hover:bg-mint/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night"
                >
                  Sign the Petition
                </a>
              </motion.div>

              <motion.div variants={item}>
                <LiveCounter reduced={reduced} />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        {!reduced && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 bg-[#020a06]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: intro * 0.85, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </div>
    </section>
  );
}

function LiveCounter({ reduced }: { reduced: boolean }) {
  const value = useLiveCounter();
  return (
    <p className="mt-7 flex items-center gap-3 text-[15px] text-mist">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
      </span>
      <span className="relative inline-flex shrink-0 overflow-hidden font-display text-lg font-semibold tabular-nums text-white/90">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={reduced ? false : { y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE.cinematic }}
          >
            {formatNumber(value)}
          </motion.span>
        </AnimatePresence>
      </span>
      <span>acres protected — and counting</span>
    </p>
  );
}
