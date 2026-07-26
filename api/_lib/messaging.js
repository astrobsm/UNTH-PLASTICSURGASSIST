// ============================================================================
// Outbound messaging (WhatsApp / SMS).
//
// There is no messaging provider wired into this deployment yet, so the default
// adapter DOES NOT SEND — it records what would have been sent and reports
// `delivered: false`. That is deliberate: a reminder system that silently
// pretends to have messaged a house officer is worse than one that says plainly
// "not sent, here is the link to send it yourself".
//
// To turn on real delivery, set MESSAGING_PROVIDER and the matching credentials
// in the Vercel project environment. Nothing else changes.
//
//   MESSAGING_PROVIDER=meta          (WhatsApp Cloud API)
//     WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
//   MESSAGING_PROVIDER=twilio        (Twilio WhatsApp)
//     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. +14155238886)
//   MESSAGING_PROVIDER=console       (default — logs only, never delivers)
// ============================================================================

/**
 * International digits for wa.me / provider APIs. Bare local numbers starting
 * with 0 are Nigerian (UNTH context) and get the 234 country code — same rule
 * as the client's normalizeForWhatsApp so a number works in both places.
 */
export function normalizePhone(raw, defaultCountry = '234') {
  if (!raw) return '';
  let s = String(raw).trim();
  const hadPlus = s.startsWith('+') || s.startsWith('00');
  s = s.replace(/[^\d]/g, '');
  if (s.startsWith('00')) s = s.slice(2);
  if (!hadPlus && s.startsWith('0')) s = defaultCountry + s.slice(1);
  return s;
}

/** A wa.me link that opens the message ready to send by hand. */
export function whatsAppLink(phone, message) {
  const num = normalizePhone(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function activeProvider() {
  return (process.env.MESSAGING_PROVIDER || 'console').toLowerCase();
}

/** True when this deployment can actually deliver a message. */
export function canDeliver() {
  const p = activeProvider();
  if (p === 'meta') return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (p === 'twilio') {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  }
  return false;
}

async function sendViaMeta(to, message) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { delivered: false, provider: 'meta', error: data?.error?.message || `HTTP ${res.status}` };
  }
  return { delivered: true, provider: 'meta', providerId: data?.messages?.[0]?.id || null };
}

async function sendViaTwilio(to, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const body = new URLSearchParams({
    From: `whatsapp:+${normalizePhone(process.env.TWILIO_WHATSAPP_FROM)}`,
    To: `whatsapp:+${to}`,
    Body: message,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { delivered: false, provider: 'twilio', error: data?.message || `HTTP ${res.status}` };
  }
  return { delivered: true, provider: 'twilio', providerId: data?.sid || null };
}

/**
 * Attempt delivery. Never throws — the caller records the outcome either way.
 *
 * @returns {{delivered: boolean, provider: string, providerId?: string|null,
 *            error?: string, link: string|null}}
 *   `delivered:false` with no error means no provider is configured: the message
 *   is prepared and `link` can be used to send it by hand.
 */
export async function sendWhatsApp({ toPhone, message }) {
  const to = normalizePhone(toPhone);
  const link = whatsAppLink(toPhone, message);
  if (!to) return { delivered: false, provider: activeProvider(), error: 'No phone number on file', link: null };

  const provider = activeProvider();
  try {
    if (provider === 'meta' && canDeliver()) return { ...(await sendViaMeta(to, message)), link };
    if (provider === 'twilio' && canDeliver()) return { ...(await sendViaTwilio(to, message)), link };
    if (provider !== 'console' && !canDeliver()) {
      return { delivered: false, provider, error: `${provider} selected but its credentials are not set`, link };
    }
    console.log(`[duty-reminder:console] would send to ${to} (${message.length} chars)`);
    return { delivered: false, provider: 'console', link };
  } catch (e) {
    return { delivered: false, provider, error: e.message, link };
  }
}

export default { sendWhatsApp, whatsAppLink, normalizePhone, canDeliver, activeProvider };
