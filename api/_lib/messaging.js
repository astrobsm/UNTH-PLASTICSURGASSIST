// ============================================================================
// WhatsApp link building.
//
// Reminders are sent BY HAND, on purpose: a person reads the message and presses
// send. There is deliberately no automatic-delivery path here — not a disabled
// one either, so that setting an environment variable can never quietly turn
// this into a system that messages clinicians on its own.
//
// If automated sending is ever wanted, it belongs in a new module with its own
// review, not behind a flag in this one.
// ============================================================================

/**
 * International digits for a wa.me link. Bare local numbers starting with 0 are
 * Nigerian (UNTH context) and get the 234 country code — the same rule as the
 * client's normalizeForWhatsApp, so a number behaves identically in both.
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

/** A wa.me link that opens WhatsApp with the message ready to send. */
export function whatsAppLink(phone, message) {
  const num = normalizePhone(phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export default { whatsAppLink, normalizePhone };
