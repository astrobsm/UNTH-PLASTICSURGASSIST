/**
 * Encryption utility for sensitive data using Web Crypto API
 * Used to encrypt PHI data before storing in localStorage/IndexedDB
 */

// Encryption key stored in memory (derived from user session)
let encryptionKey: CryptoKey | null = null;

/**
 * Initialize encryption key from password/session
 */
export async function initializeEncryption(password: string): Promise<void> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('plasticsurg_assistant_salt_2026'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data to store securely
 */
export async function encrypt(data: string): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption key not initialized. Call initializeEncryption first.');
  }

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encoder.encode(data)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data from storage
 */
export async function decrypt(encryptedData: string): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption key not initialized. Call initializeEncryption first.');
  }

  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(c => c.charCodeAt(0))
  );

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Hash sensitive data (one-way) for indexing/searching
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Clear encryption key from memory
 */
export function clearEncryption(): void {
  encryptionKey = null;
}
