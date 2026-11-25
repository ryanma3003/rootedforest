/**
 * Integration points. Configure in `.env`:
 *   VITE_CHECKOUT_URL   – payment page; receives ?amount=&acres=
 *   VITE_FORMS_ENDPOINT – base URL; receives POST /petition and POST /guardians (JSON)
 */
const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL as string | undefined;
const FORMS_ENDPOINT = import.meta.env.VITE_FORMS_ENDPOINT as string | undefined;

export function checkoutHref(amount: number, acres: number) {
  if (!CHECKOUT_URL) return null;
  const url = new URL(CHECKOUT_URL, window.location.href);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('acres', String(acres));
  url.searchParams.set('campaign', 'emerald-forest');
  return url.toString();
}

export async function submitForm(kind: 'petition' | 'guardians', data: Record<string, string>) {
  if (!FORMS_ENDPOINT) {
    if (import.meta.env.PROD) console.warn(`[rooted] VITE_FORMS_ENDPOINT is not set — ${kind} submission was not sent.`);
    await new Promise((r) => setTimeout(r, 650));
    return;
  }
  const res = await fetch(`${FORMS_ENDPOINT.replace(/\/$/, '')}/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, campaign: 'emerald-forest' }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}
