/**
 * PhoneActions — one-tap contact actions for a phone number (Addendum v2.1 §5).
 *
 * Renders the number with Call (tel:), SMS (sms:), WhatsApp (wa.me) and Copy
 * actions. Platform-aware: WhatsApp deep-links work on Android/iOS/Web via
 * https://wa.me/<international-digits>. Used by the consult detail drawer and
 * the MDT patient card.
 */

import React, { useState } from 'react';
import { Phone, MessageSquare, Copy, Check } from 'lucide-react';

/**
 * Normalise a phone number for WhatsApp's wa.me deep link (international digits,
 * no '+' or separators). Bare local numbers starting with 0 are assumed
 * Nigerian (UNTH context) and prefixed with the 234 country code.
 */
export function normalizeForWhatsApp(raw: string, defaultCountry = '234'): string {
  if (!raw) return '';
  let s = raw.trim();
  const hadPlus = s.startsWith('+') || s.startsWith('00');
  s = s.replace(/[^\d]/g, '');
  if (s.startsWith('00')) s = s.slice(2);
  if (!hadPlus && s.startsWith('0')) s = defaultCountry + s.slice(1);
  return s;
}

interface Props {
  phone?: string | null;
  /** Optional label shown before the number (e.g. the person's role). */
  label?: string;
  /** Pre-filled message for SMS/WhatsApp. */
  message?: string;
  /** Compact icon-only row (no visible number). */
  compact?: boolean;
  className?: string;
}

const WHATSAPP_GREEN = 'text-green-600 hover:bg-green-50';

const PhoneActions: React.FC<Props> = ({ phone, label, message, compact = false, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const num = (phone || '').trim();
  if (!num) return null;

  const wa = normalizeForWhatsApp(num);
  const text = message ? encodeURIComponent(message) : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(num);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }

  const btn = 'p-1.5 rounded-md transition-colors';

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {!compact && (
        <span className="text-sm text-gray-800">
          {label && <span className="text-gray-500">{label}: </span>}
          <a href={`tel:${num}`} className="text-blue-700 hover:underline font-medium">{num}</a>
        </span>
      )}
      <span className="inline-flex items-center gap-0.5">
        <a href={`tel:${num}`} title="Call" className={`${btn} text-blue-600 hover:bg-blue-50`}>
          <Phone className="w-4 h-4" />
        </a>
        <a href={`sms:${num}${text ? `?body=${text}` : ''}`} title="SMS" className={`${btn} text-indigo-600 hover:bg-indigo-50`}>
          <MessageSquare className="w-4 h-4" />
        </a>
        {wa && (
          <a
            href={`https://wa.me/${wa}${text ? `?text=${text}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
            className={`${btn} ${WHATSAPP_GREEN}`}
          >
            <WhatsAppGlyph />
          </a>
        )}
        <button type="button" onClick={copy} title="Copy number" className={`${btn} text-gray-500 hover:bg-gray-100`}>
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </span>
    </span>
  );
};

// Inline WhatsApp glyph (lucide has no brand icon).
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.64.15-.19.29-.74.93-.9 1.12-.17.19-.33.22-.62.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.55-.88-2.12-.23-.56-.47-.48-.64-.49-.17-.01-.36-.01-.55-.01-.19 0-.51.07-.77.36-.26.29-1.01.99-1.01 2.41s1.03 2.79 1.18 2.98c.15.19 2.03 3.1 4.92 4.35.69.3 1.22.48 1.64.61.69.22 1.31.19 1.81.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34z M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2z m0 1.67c2.2 0 4.27.86 5.83 2.41a8.2 8.2 0 012.42 5.83c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.17 8.17 0 01-1.26-4.39c0-4.54 3.7-8.24 8.24-8.24z"/>
    </svg>
  );
}

export default PhoneActions;
