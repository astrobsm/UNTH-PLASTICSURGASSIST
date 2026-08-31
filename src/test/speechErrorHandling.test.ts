/**
 * Dictation must never appear to be listening when it cannot hear.
 *
 * `audio-capture` — a microphone that is absent, already in use, or broken —
 * was grouped with `no-speech` and swallowed as non-fatal. The recogniser then
 * ended, the auto-restart brought it back, it failed the same way, and that
 * loop continued indefinitely with no error raised and no transcript produced.
 * The clinician saw a live microphone indicator over a dead device.
 *
 * The question this classification answers is only ever "could restarting
 * help?", so these assertions are about recoverability, not severity.
 */

import { describe, it, expect } from 'vitest';
import { classifySpeechError } from '../services/speechToTextService';

describe('speech recognition error classification', () => {
  it('keeps listening through a silence', () => {
    // The commonest event by far — raised whenever someone pauses to think.
    // Reporting it would bury the real errors.
    expect(classifySpeechError('no-speech')).toBe('transient');
  });

  it('ignores the abort raised by every stop and restart', () => {
    expect(classifySpeechError('aborted')).toBe('ignore');
  });

  it('stops on a microphone that cannot be read', () => {
    // Restarting cannot conjure a microphone. This is the one that span.
    expect(classifySpeechError('audio-capture')).toBe('fatal');
  });

  it('stops when permission was refused', () => {
    expect(classifySpeechError('not-allowed')).toBe('fatal');
    expect(classifySpeechError('service-not-allowed')).toBe('fatal');
  });

  it('reports a dropped connection but keeps the session', () => {
    // Recognition is a remote service in Chrome, so this recovers — but words
    // spoken during the gap are gone, which the clinician has to be told.
    expect(classifySpeechError('network')).toBe('recoverable');
  });

  it('treats an unknown error as fatal rather than looping on it', () => {
    // An error nobody anticipated is exactly the one not to retry forever.
    expect(classifySpeechError('some-future-error')).toBe('fatal');
    expect(classifySpeechError('')).toBe('fatal');
  });
});
