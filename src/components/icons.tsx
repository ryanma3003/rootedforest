import { motion, type TargetAndTransition, type Variants } from 'framer-motion';
import { EASE } from '../tunables';

const t = { duration: 0.45, ease: EASE.cinematic };
const svgProps = {
  width: 48,
  height: 48,
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Icons share the card's variant labels: idle while hidden/shown, animate on hover. */
const iconVariants = (rest: TargetAndTransition, hover: TargetAndTransition): Variants => ({ hidden: rest, show: rest, hover });

const grow = iconVariants({ scale: 1 }, { scale: 1.22, transition: t });

/** Acre plot with a seedling whose leaves grow on hover. */
export function AcreIcon() {
  return (
    <svg {...svgProps}>
      <path d="M6 36l18 7 18-7-18-7-18 7z" opacity={0.7} />
      <path d="M24 36V20" />
      <motion.path variants={grow} style={{ originX: '24px', originY: '24px' }} d="M24 26c-6 0-9-4-9-9 6 0 9 4 9 9z" />
      <motion.path variants={grow} style={{ originX: '24px', originY: '22px' }} d="M24 22c0-6 4-10 10-10 0 6-4 10-10 10z" />
    </svg>
  );
}

// Native pathLength=1 normalises the dash maths; the offset "writes" the signature.
const sign: Variants = {
  hidden: { strokeDashoffset: 0.45 },
  show: { strokeDashoffset: 0.45 },
  hover: { strokeDashoffset: 0, transition: { duration: 0.6, ease: EASE.cinematic } },
};

/** Petition sheet whose signature writes itself on hover. */
export function PetitionIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 6h18l8 8v28H12z" />
      <path d="M30 6v8h8" />
      <path d="M17 18h12M17 23h16" opacity={0.7} />
      <motion.path variants={sign} pathLength={1} strokeDasharray="1 1" d="M16 35c2-4 4-4 5-1s3 3 5-1 3-3 4 0 2 2 5-1" />
    </svg>
  );
}

const rise = iconVariants({ y: 3 }, { y: -2, transition: t });

/** Guardian shield with a sprout rising inside. */
export function GuardianIcon() {
  return (
    <svg {...svgProps}>
      <path d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z" />
      <motion.g variants={rise}>
        <path d="M24 34V23" />
        <path d="M24 27c-4 0-6-2.5-6-6 4 0 6 2.5 6 6zM24 25c0-4 2.5-6.5 6.5-6.5 0 4-2.5 6.5-6.5 6.5z" />
      </motion.g>
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 3c.4 2.3 1.8 3.8 4.1 4v3.2c-1.5.1-2.9-.4-4.1-1.2v6.3c0 3.5-2.7 5.7-5.7 5.7a5.6 5.6 0 0 1-1.1-11.1v3.3a2.4 2.4 0 1 0 1.7 2.3V3h5.1z" />
    </svg>
  );
}

export function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12c0 1.3.1 2.5.4 3.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.3.4-2.5.4-3.8s-.1-2.5-.4-3.8zM10 15.2V8.8l5.2 3.2-5.2 3.2z" />
    </svg>
  );
}
