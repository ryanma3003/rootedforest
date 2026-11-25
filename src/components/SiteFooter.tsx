import { motion } from 'framer-motion';
import { CAMPAIGN, EASE } from '../tunables';
import { InstagramIcon, TikTokIcon, YouTubeIcon } from './icons';

const underline =
  'relative rounded-sm after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-mint after:transition-transform after:duration-300 after:ease-cinematic hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night';
const linkCls = `${underline} text-mint`;

const socials = [
  { label: 'Rooted on Instagram', href: CAMPAIGN.social.instagram, Icon: InstagramIcon },
  { label: 'Rooted on TikTok', href: CAMPAIGN.social.tiktok, Icon: TikTokIcon },
  { label: 'Rooted on YouTube', href: CAMPAIGN.social.youtube, Icon: YouTubeIcon },
];

/**
 * Transparent footer: no background of its own. A bottom-anchored scrim
 * (transparent → rgba(4,19,13,.75)) carries the contrast while leaves,
 * fireflies and the grass layer stay visible straight through it.
 */
export function SiteFooter({ reduced }: { reduced: boolean }) {
  return (
    <footer className="relative z-[2]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(4,19,13,0) 0%, rgba(4,19,13,0.35) 45%, rgba(4,19,13,0.75) 100%)' }}
      />
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.9, ease: EASE.cinematic }}
        className="relative mx-auto max-w-page px-5 pb-[clamp(150px,22vh,210px)] pt-28 sm:px-8"
      >
        <p className="max-w-3xl font-display text-[clamp(1.5rem,3.2vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-mint [text-shadow:0_0_30px_rgba(124,240,168,0.25)]">
          Rooted. Because once it's gone, "sorry" doesn't grow back.
        </p>

        <div className="mt-14 grid gap-10 border-t border-mist/15 pt-10 md:grid-cols-[1.4fr_1fr_auto] md:items-start">
          <div>
            <a href="#top" className={`font-display text-2xl font-bold tracking-[-0.02em] text-mist ${underline}`}>
              Rooted
            </a>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-mist/95">
              We're protecting all 50,000 acres of the Emerald Forest — one adopted acre, one signature, one guardian at a time.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-7 gap-y-3 text-[15px]">
              <li>
                <a href={CAMPAIGN.links.about} className={linkCls}>
                  About
                </a>
              </li>
              <li>
                <a href={CAMPAIGN.links.transparency} className={linkCls}>
                  Transparency
                </a>
              </li>
              <li>
                <a href={CAMPAIGN.links.contact} className={linkCls}>
                  Contact
                </a>
              </li>
            </ul>
          </nav>

          <ul className="flex gap-3" aria-label="Social media">
            {socials.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-mint/25 bg-night/30 text-mint transition-[transform,background-color,border-color,box-shadow] duration-300 ease-cinematic hover:-translate-y-0.5 hover:border-mint/60 hover:bg-mint/10 hover:shadow-[0_0_24px_-4px_rgba(124,240,168,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-[13px] leading-relaxed text-mist/90">
          © {new Date().getFullYear()} Rooted Forest Alliance. Every dollar is tracked on our public ledger — follow the money,
          then follow the trees.
        </p>
      </motion.div>
    </footer>
  );
}
