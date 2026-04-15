/**
 * Offline Authentication Service
 * 
 * Stores hashed credentials in IndexedDB so users can authenticate
 * even when there is no network connection — provided they have
 * previously logged in online at least once.
 * 
 * Security model:
 *  - Passwords are NEVER stored in plaintext.
 *  - PBKDF2 (100 000 iterations, SHA-256) derives a verification hash.
 *  - A random 16-byte salt per user prevents rainbow-table attacks.
 *  - On successful online login the hash + salt are saved/updated.
 *  - On offline login the supplied password is re-hashed with the
 *    stored salt and compared to the stored hash.
 */

import { db } from '../db/database';

// ── Types ────────────────────────────────────────────────────────────
export interface OfflineCredential {
  id?: number;
  email: string;             // lookup key
  passwordHash: string;      // hex-encoded PBKDF2 hash
  salt: string;              // hex-encoded random salt
  userId: string;
  userName: string;
  userRole: string;
  lastOnlineLogin: Date;
  updatedAt: Date;
}

// ── Crypto helpers ───────────────────────────────────────────────────

/** Convert ArrayBuffer → hex string */
function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert hex string → Uint8Array */
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Derive a PBKDF2 hash from password + salt */
async function deriveHash(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  return bufToHex(bits);
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Store / update a credential after a successful **online** login.
 * Called from authStore.login() after the server confirms the password.
 */
export async function storeOfflineCredential(
  email: string,
  password: string,
  user: { id: string; name: string; role: string }
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await deriveHash(password, salt);

  const existing = await db.table('offline_credentials')
    .where('email')
    .equalsIgnoreCase(email)
    .first();

  const record: OfflineCredential = {
    email: email.toLowerCase(),
    passwordHash,
    salt: bufToHex(salt),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    lastOnlineLogin: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.table('offline_credentials').update(existing.id!, record);
  } else {
    await db.table('offline_credentials').add(record);
  }
}

/**
 * Verify password against stored credential during **offline** login.
 * Returns the cached user object on success, null on failure.
 */
export async function verifyOfflineCredential(
  email: string,
  password: string
): Promise<{ id: string; name: string; email: string; role: string } | null> {
  try {
    const cred: OfflineCredential | undefined = await db
      .table('offline_credentials')
      .where('email')
      .equalsIgnoreCase(email)
      .first();

    if (!cred) return null; // never logged in online with this email

    const salt = hexToBuf(cred.salt);
    const attemptHash = await deriveHash(password, salt);

    if (attemptHash !== cred.passwordHash) return null; // wrong password

    return {
      id: cred.userId,
      name: cred.userName,
      email: cred.email,
      role: cred.userRole,
    };
  } catch (err) {
    console.error('Offline credential verification failed:', err);
    return null;
  }
}

/**
 * Check whether a given email has a stored offline credential.
 */
export async function hasOfflineCredential(email: string): Promise<boolean> {
  const count = await db
    .table('offline_credentials')
    .where('email')
    .equalsIgnoreCase(email)
    .count();
  return count > 0;
}

/**
 * Remove all offline credentials (e.g. on admin wipe).
 */
export async function clearAllOfflineCredentials(): Promise<void> {
  await db.table('offline_credentials').clear();
}
