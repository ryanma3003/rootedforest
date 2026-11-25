import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { checkoutHref, submitForm } from '../lib/api';
import { formatNumber } from '../lib/hooks';
import { emitBurst } from '../lib/interaction';
import { CAMPAIGN, EASE, UI } from '../tunables';
import { AcreIcon, GuardianIcon, PetitionIcon } from './icons';

export type HelpTarget = 'adopt' | 'petition';
export interface HelpRequest {
  target: HelpTarget;
  n: number;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-night';
const primaryBtn = `inline-flex w-full items-center justify-center gap-2 rounded-full bg-mint px-6 py-3.5 font-display text-[15px] font-semibold text-ink shadow-[0_8px_28px_-10px_rgba(124,240,168,0.6)] transition-[transform,box-shadow,opacity] duration-300 ease-cinematic hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-8px_rgba(124,240,168,0.8)] disabled:cursor-wait disabled:opacity-70 ${focusRing}`;
const ghostBtn = `inline-flex w-full items-center justify-center rounded-full border border-mint/50 bg-mint/[0.06] px-6 py-3.5 font-display text-[15px] font-semibold text-mint transition-[transform,background-color,border-color] duration-300 ease-cinematic hover:-translate-y-0.5 hover:border-mint hover:bg-mint/[0.12] ${focusRing}`;
const inputCls = `w-full rounded-2xl border border-mist/20 bg-night/50 px-4 py-3 text-[15px] text-mist placeholder:text-mist/50 transition-colors duration-200 hover:border-mist/35 focus:border-mint/70 ${focusRing}`;

function burstFrom(el: HTMLElement | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  emitBurst(r.left + r.width / 2, r.top + r.height / 2, { strength: 1.35, particles: 14 });
}

export function WaysToHelp({ request, reduced }: { request: HelpRequest | null; reduced: boolean }) {
  const [petitionOpen, setPetitionOpen] = useState(false);
  const adoptFirst = useRef<HTMLButtonElement>(null);
  const petitionName = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    const el = document.getElementById(request.target);
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    if (request.target === 'petition') setPetitionOpen(true);
    const id = window.setTimeout(
      () => (request.target === 'adopt' ? adoptFirst.current : petitionName.current)?.focus({ preventScroll: true }),
      reduced ? 50 : 900,
    );
    return () => window.clearTimeout(id);
  }, [request, reduced]);

  return (
    <section id="help" aria-labelledby="help-title" className="relative px-5 pb-[22vh] pt-[18vh] sm:px-8">
      <div className="mx-auto max-w-page">
        <motion.header
          initial={reduced ? false : { opacity: 0, y: UI.revealDistance }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: UI.revealDuration, ease: EASE.cinematic }}
          className="max-w-2xl"
        >
          <h2 id="help-title" className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white/90">
            Your move.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-mist">Pick how you show up for the forest.</p>
        </motion.header>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card index={0} id="adopt" icon={<AcreIcon />} title="Adopt an Acre" reduced={reduced}>
            <AdoptBody firstTierRef={adoptFirst} />
          </Card>
          <Card index={1} id="petition" icon={<PetitionIcon />} title="Sign the Petition" reduced={reduced}>
            <PetitionBody open={petitionOpen} onOpen={() => setPetitionOpen(true)} nameRef={petitionName} />
          </Card>
          <Card index={2} id="guardians" icon={<GuardianIcon />} title="Join the Guardians" reduced={reduced}>
            <GuardiansBody />
          </Card>
        </div>
      </div>
    </section>
  );
}

function Card({
  index,
  id,
  icon,
  title,
  reduced,
  children,
}: {
  index: number;
  id: string;
  icon: ReactNode;
  title: string;
  reduced: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  const variants: Variants = {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: UI.revealDistance + 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: UI.revealDuration, ease: EASE.cinematic, delay: reduced ? 0 : index * UI.cardStagger },
    },
    hover: reduced ? {} : { y: -UI.cardLift, transition: { duration: 0.3, ease: EASE.cinematic } },
  };
  return (
    <motion.article
      id={id}
      aria-labelledby={headingId}
      variants={variants}
      initial="hidden"
      whileInView="show"
      whileHover="hover"
      viewport={{ once: true, margin: '-10% 0px' }}
      className="group relative flex scroll-mt-24 flex-col rounded-[26px] border border-mint/15 bg-night/35 p-7 shadow-[0_24px_60px_-24px_rgba(1,8,4,0.9)] backdrop-blur-[14px] transition-[box-shadow,border-color] duration-300 ease-cinematic hover:border-mint/35 hover:shadow-[0_24px_60px_-20px_rgba(1,8,4,0.9),0_0_44px_-6px_rgba(124,240,168,0.35)] focus-within:border-mint/35"
    >
      <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-mint/20 bg-mint/[0.07] text-mint">
        {icon}
      </div>
      <h3 id={headingId} className="font-display text-2xl font-semibold tracking-[-0.01em] text-white/90">
        {title}
      </h3>
      {children}
    </motion.article>
  );
}

function AdoptBody({ firstTierRef }: { firstTierRef: React.RefObject<HTMLButtonElement> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const tier = selected === null ? CAMPAIGN.tiers[0] : CAMPAIGN.tiers[selected];
  const href = checkoutHref(tier.amount, tier.acres);
  const label = selected === null ? 'Adopt an Acre →' : `Protect ${tier.acres} ${tier.acres === 1 ? 'acre' : 'acres'} →`;

  return (
    <>
      <p className="mt-3 text-[16px] leading-relaxed text-mist">
        $15 protects an acre forever. It's bought, titled, and guarded — so no chainsaw ever gets a say.
      </p>
      <fieldset className="mt-6">
        <legend className="mb-3 text-[13px] font-medium uppercase tracking-[0.12em] text-mist/90">Choose your acres</legend>
        <div role="radiogroup" aria-label="Donation amount" className="grid grid-cols-3 gap-2">
          {CAMPAIGN.tiers.map((t, i) => {
            const active = selected === i;
            return (
              <button
                key={t.amount}
                ref={i === 0 ? firstTierRef : undefined}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSelected(i);
                  setConfirmed(false);
                }}
                className={`relative rounded-2xl border px-2 pb-2.5 pt-3 text-center transition-[background-color,border-color,transform] duration-300 ease-cinematic hover:-translate-y-0.5 ${focusRing} ${
                  active ? 'border-mint bg-mint/15 text-white/95' : 'border-mist/20 bg-night/40 text-mist hover:border-mint/50'
                }`}
              >
                {t.tag && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold leading-tight text-ink">
                    {t.tag}
                  </span>
                )}
                <span className="block font-display text-xl font-semibold">${t.amount}</span>
                <span className="block text-[13px] text-mist/90">
                  {t.acres} {t.acres === 1 ? 'acre' : 'acres'}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-auto pt-6">
        <AnimatePresence mode="wait" initial={false}>
          {confirmed && !href ? (
            <motion.p
              key="confirmed"
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-[15px] text-mist"
            >
              {tier.acres} {tier.acres === 1 ? 'acre' : 'acres'} for ${tier.amount} — checkout isn't connected on this
              deployment yet (set <code className="text-mint">VITE_CHECKOUT_URL</code>).
            </motion.p>
          ) : (
            <motion.a
              key={label}
              href={href ?? '#adopt'}
              onClick={(e) => {
                if (href) return;
                e.preventDefault();
                setConfirmed(true);
                burstFrom(e.currentTarget);
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE.cinematic }}
              className={primaryBtn}
            >
              {label}
            </motion.a>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

type Status = 'idle' | 'sending' | 'done' | 'error';

function PetitionBody({
  open,
  onOpen,
  nameRef,
}: {
  open: boolean;
  onOpen: () => void;
  nameRef: React.RefObject<HTMLInputElement>;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [signature, setSignature] = useState(0);
  const submitRef = useRef<HTMLButtonElement>(null);
  const ids = useId();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus('sending');
    try {
      await submitForm('petition', { name: String(fd.get('name')), email: String(fd.get('email')) });
      setSignature(CAMPAIGN.petitionBase + 1);
      burstFrom(submitRef.current);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <p className="mt-3 text-[16px] leading-relaxed text-mist">
        Tell the Ministry of Forestry to cancel the Emerald Basin logging permits. {formatNumber(CAMPAIGN.petitionBase)} people
        already have — your name makes that number impossible to ignore.
      </p>
      <div className="mt-auto pt-6">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'done' ? (
            <SuccessNote key="done">
              <strong className="font-display text-white/95">Signature #{formatNumber(signature)}</strong> — the forest felt that.
            </SuccessNote>
          ) : open ? (
            <motion.form
              key="form"
              onSubmit={onSubmit}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: EASE.cinematic }}
              className="space-y-3 overflow-visible"
            >
              <div>
                <label htmlFor={`${ids}-name`} className="mb-1.5 block text-[13px] font-medium text-mist">
                  Your name
                </label>
                <input ref={nameRef} id={`${ids}-name`} name="name" required autoComplete="name" className={inputCls} placeholder="Alex Rivera" />
              </div>
              <div>
                <label htmlFor={`${ids}-email`} className="mb-1.5 block text-[13px] font-medium text-mist">
                  Email
                </label>
                <input id={`${ids}-email`} name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@example.com" />
              </div>
              {status === 'error' && (
                <p role="alert" className="text-[14px] text-[#ffb4a8]">
                  That didn't go through. Check your connection and hit sign again.
                </p>
              )}
              <button ref={submitRef} type="submit" disabled={status === 'sending'} className={`${primaryBtn} mt-1`}>
                {status === 'sending' ? 'Adding your name…' : 'Sign it →'}
              </button>
            </motion.form>
          ) : (
            <motion.div key="cta" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <button type="button" onClick={onOpen} className={ghostBtn}>
                Add my name
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function GuardiansBody() {
  const [status, setStatus] = useState<Status>('idle');
  const submitRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus('sending');
    try {
      await submitForm('guardians', { email: String(fd.get('email')) });
      burstFrom(submitRef.current);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <p className="mt-3 text-[16px] leading-relaxed text-mist">
        One email a month, straight from the rangers on the ground. Real wins, real threats, and the exact moment your voice is
        needed.
      </p>
      <div className="mt-auto pt-6">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'done' ? (
            <SuccessNote key="done">
              <strong className="font-display text-white/95">You're in.</strong> Expect forest news, not spam.
            </SuccessNote>
          ) : (
            <motion.form key="form" onSubmit={onSubmit} exit={{ opacity: 0, y: -8 }} className="space-y-3">
              <div>
                <label htmlFor={`${id}-email`} className="mb-1.5 block text-[13px] font-medium text-mist">
                  Email
                </label>
                <input id={`${id}-email`} name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@example.com" />
              </div>
              {status === 'error' && (
                <p role="alert" className="text-[14px] text-[#ffb4a8]">
                  Couldn't subscribe you just now. Give it another go in a moment.
                </p>
              )}
              <button ref={submitRef} type="submit" disabled={status === 'sending'} className={primaryBtn}>
                {status === 'sending' ? 'Joining…' : 'Count me in →'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <motion.p
      role="status"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE.cinematic }}
      className="rounded-2xl border border-mint/35 bg-mint/10 px-4 py-4 text-[16px] leading-relaxed text-mist shadow-[0_0_40px_-10px_rgba(124,240,168,0.45)]"
    >
      {children}
    </motion.p>
  );
}
