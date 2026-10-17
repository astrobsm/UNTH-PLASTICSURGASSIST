// ============================================================================
// Password / login-id comparison shared by sign-in and the forced password
// change.
//
// Temporary passwords are usually copied from WhatsApp or SMS. The copy often
// carries a trailing space or newline, a non-breaking space, or zero-width
// characters the user cannot see, and the correct password is then refused as
// "Invalid credentials". We compare the password exactly as typed first, then
// with only those invisible characters removed. Nothing visible is ever
// changed, so this does not weaken the check.
// ============================================================================

import bcrypt from 'bcryptjs';

const INVISIBLE = /[​-‍⁠﻿­]/g;

/** Strip invisible characters, turn non-breaking spaces into spaces, trim. */
export function normaliseSecret(value) {
  return String(value ?? '').replace(INVISIBLE, '').replace(/ /g, ' ').trim();
}

/** Login identifier as stored: invisible characters removed, trimmed. */
export function normaliseLoginId(value) {
  return normaliseSecret(value);
}

/** The password as typed, then the invisible-character-free form if different. */
export function passwordCandidates(password) {
  const raw = String(password ?? '');
  const clean = normaliseSecret(raw);
  return clean && clean !== raw ? [raw, clean] : [raw];
}

export const isBcryptHash = (h) => typeof h === 'string' && /^\$2[aby]\$/.test(h);

/**
 * Check a password against a stored value (bcrypt hash, or legacy plaintext).
 * Returns { ok, matched } where `matched` is the candidate that matched.
 */
export async function verifyPassword(password, stored) {
  if (!stored) return { ok: false, matched: null };
  for (const candidate of passwordCandidates(password)) {
    const ok = isBcryptHash(stored) ? await bcrypt.compare(candidate, stored) : candidate === stored;
    if (ok) return { ok: true, matched: candidate };
  }
  return { ok: false, matched: null };
}
