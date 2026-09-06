/**
 * The conference.
 *
 * It did not work in production at all: the service disabled itself on any
 * non-localhost host and dialled a WebSocket that Vercel cannot serve, so both
 * "Start New Meeting" and "Join Meeting" failed silently. These cover the
 * things that must not quietly stop working again.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const service = read('src/services/videoConferenceService.ts');
const signalling = read('src/services/conferenceSignalling.ts');
const page = read('src/pages/VideoConference.tsx');
const attendanceApi = read('api/conference-attendance.js');
const configApi = read('api/conference-config.js');

describe('the module is no longer disabled in production', () => {
  it('has no serverless self-disable left', () => {
    // This was the check that made the whole feature a no-op on Vercel.
    expect(service).not.toContain('isServerless');
    expect(service).not.toContain('SERVERLESS_NOT_SUPPORTED');
  });

  it('no longer dials a WebSocket the host cannot serve', () => {
    expect(service).not.toMatch(/wss?:\/\/\$\{window\.location\.host\}/);
    expect(service).not.toContain('/ws/conference/');
  });

  it('signals over Supabase Realtime instead', () => {
    expect(service).toContain("from './conferenceSignalling'");
    expect(signalling).toContain('@supabase/supabase-js');
    expect(signalling).toContain('presenceState');
  });
});

describe('signalling', () => {
  it('drops messages addressed to somebody else', () => {
    // The channel is a room-wide bus; the addressing is ours, so a peer must
    // not act on an offer meant for a third party.
    expect(signalling).toContain("if ('to' in message && message.to !== 'all' && message.to !== self.id) return;");
  });

  it('resolves only once actually subscribed', () => {
    // A caller that awaits join() may start offering immediately, so join()
    // must not resolve before the channel can carry those offers.
    expect(signalling).toContain("if (status === 'SUBSCRIBED')");
    expect(signalling).toContain('channel.track(presence)');
  });

  it('gives up rather than hanging when the channel never comes up', () => {
    expect(signalling).toContain('Timed out reaching the conference channel');
  });

  it('loads the client library only when someone opens a conference', () => {
    expect(signalling).toContain("await import('@supabase/supabase-js')");
  });
});

describe('the key is not baked into the bundle', () => {
  it('is served, so it can be rotated without a rebuild', () => {
    expect(configApi).toContain('process.env.SUPABASE_ANON_KEY');
    expect(signalling).toContain("apiClient\n      .get('/conference-config')");
  });

  it('never serves the service role key to a browser', () => {
    expect(configApi).not.toContain('SERVICE_ROLE');
  });

  it('says so plainly when it is not configured', () => {
    expect(configApi).toContain('configured: false');
    expect(page).toContain('not configured on this deployment');
  });
});

describe('joining', () => {
  it('admits on arrival, with no lobby', () => {
    // Opening the module is joining; there is no start-or-join choice.
    expect(page).toContain('joinRoom(roomId');
    expect(page).not.toContain('Start New Meeting');
    expect(page).not.toContain('Join a Meeting');
  });

  it('everyone lands in the same room without circulating an id', () => {
    expect(page).toContain('function roomForToday()');
  });

  it('opens the microphone but not the camera', () => {
    // Fifteen cameras opening at once on a ward connection helps nobody.
    expect(page).toContain('requestMediaAccess({ audio: true, video: false })');
  });
});

describe('controls', () => {
  it('lets a participant toggle their own microphone and camera', () => {
    expect(service).toContain('toggleAudio()');
    expect(service).toContain('toggleVideo()');
    expect(page).toContain('videoConferenceService.toggleAudio()');
  });

  it('lets a host mute one person or everyone, and stop a camera', () => {
    expect(service).toContain('hostControl(');
    expect(page).toContain("hostControl('mute-audio', 'all')");
    expect(page).toContain("hostControl('disable-video', id)");
  });

  it('is honest that muting is a request the other client honours', () => {
    expect(page).toContain("Muting asks that person's app to mute them.");
  });

  it('shares a screen, a window or a tab', () => {
    expect(service).toContain('getDisplayMedia');
    // Ending the share from the browser's own bar must restore the camera.
    expect(service).toContain("track.addEventListener('ended'");
  });
});

describe('presenting a case', () => {
  it('sends the patient id, not a picture of the screen', () => {
    expect(service).toContain('presentCase(patientId: string | null');
    expect(service).toContain("kind: 'stage'");
    expect(page).toContain('<CasePresentation');
  });

  it('only the presenter can take their own case down', () => {
    expect(page).toContain('stage.presenterId === selfId');
  });

  it('viewers follow rather than drive the deck', () => {
    expect(page).toContain('followerMode={stage.presenterId !== selfId}');
  });
});

describe('attendance', () => {
  it('is recorded on joining and on leaving', () => {
    expect(page).toContain("action: 'join'");
    expect(page).toContain("action: 'leave'");
    expect(attendanceApi).toContain("case 'join'");
    expect(attendanceApi).toContain("case 'leave'");
  });

  it('survives a tab that is simply closed', () => {
    expect(page).toContain('sendBeacon');
    expect(page).toContain("'pagehide'");
  });

  it('accumulates time so a dropped connection costs one interval, not the meeting', () => {
    expect(attendanceApi).toContain('COALESCE(seconds_present, 0) + $1');
  });

  it('records which cases were actually presented', () => {
    expect(attendanceApi).toContain('conference_cases');
    expect(page).toContain("action: 'present-case'");
  });

  it('takes the participant from the token, never the request body', () => {
    expect(attendanceApi).toContain('auth.user');
    expect(attendanceApi).not.toMatch(/body\.userId/);
  });
});
