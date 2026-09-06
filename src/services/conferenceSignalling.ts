/**
 * How two browsers in a conference find each other.
 *
 * WebRTC carries the audio and video directly between participants, but it
 * cannot begin until they have swapped an offer, an answer and their ICE
 * candidates. That exchange needs a channel both can reach at the same time —
 * and Vercel is serverless, so the app's own host cannot hold a socket open.
 * This module carries the exchange over Supabase Realtime instead, which the
 * browsers reach directly; Vercel is not in the path at all.
 *
 * It also carries three things that are not strictly signalling but belong on
 * the same channel, because they must reach everyone at once:
 *
 *   presence  who is in the room, which is what attendance is taken from
 *   control   a host muting somebody, or ending the meeting
 *   stage     which patient is on screen, so every participant's app renders
 *             the same case at the same moment
 *
 * Media never passes through here. Once the handshake is done the streams flow
 * peer to peer.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { apiClient } from './apiClient';

export interface SignalPresence {
  id: string;
  name: string;
  role: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isPresenting: boolean;
  joinedAt: string;
}

/** Everything that travels over the channel, tagged by what it is. */
export type SignalMessage =
  | { kind: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: 'chat'; from: string; name: string; text: string; at: string }
  | { kind: 'control'; from: string; to: string | 'all'; action: ControlAction }
  | { kind: 'stage'; from: string; patientId: string | null; patientName?: string };

export type ControlAction = 'mute-audio' | 'disable-video' | 'end-meeting' | 'request-state';

export interface ConferenceConfig {
  configured: boolean;
  url?: string;
  anonKey?: string;
  iceServers?: RTCIceServer[];
  reason?: string;
}

type Handler<T> = (payload: T) => void;

/** Cached so a page that opens the conference twice does not fetch twice. */
let configPromise: Promise<ConferenceConfig> | null = null;

export function loadConferenceConfig(force = false): Promise<ConferenceConfig> {
  if (force) configPromise = null;
  if (!configPromise) {
    configPromise = apiClient
      .get('/conference-config')
      .catch((e): ConferenceConfig => ({
        configured: false,
        reason: e instanceof Error ? e.message : 'Could not reach the server.',
      }));
  }
  return configPromise;
}

/**
 * One participant's connection to a room's signalling channel.
 *
 * Created through `ConferenceSignalling.join`, which resolves only once the
 * channel is actually subscribed — so a caller that awaits it can start
 * offering to peers immediately, without racing the subscription.
 */
export class ConferenceSignalling {
  private channel: RealtimeChannel;
  private client: SupabaseClient;
  private handlers = new Map<string, Set<Handler<never>>>();
  private presenceHandlers = new Set<Handler<SignalPresence[]>>();
  private closed = false;

  readonly roomId: string;
  readonly self: SignalPresence;
  readonly iceServers: RTCIceServer[];

  private constructor(
    client: SupabaseClient,
    channel: RealtimeChannel,
    roomId: string,
    self: SignalPresence,
    iceServers: RTCIceServer[],
  ) {
    this.client = client;
    this.channel = channel;
    this.roomId = roomId;
    this.self = self;
    this.iceServers = iceServers;
  }

  /**
   * Joins a room.
   *
   * Throws when the server has no Supabase credentials configured, rather than
   * returning a half-built object that fails later at a confusing point.
   */
  static async join(
    roomId: string,
    self: Omit<SignalPresence, 'joinedAt'>,
  ): Promise<ConferenceSignalling> {
    const config = await loadConferenceConfig();
    if (!config.configured || !config.url || !config.anonKey) {
      throw new Error(
        config.reason
        || 'The conference is not configured on the server. An administrator needs to set '
           + 'SUPABASE_URL and SUPABASE_ANON_KEY.',
      );
    }

    // Imported here rather than at module load so the 100kB client is only
    // fetched by someone who actually opens a conference.
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });

    const presence: SignalPresence = { ...self, joinedAt: new Date().toISOString() };

    const channel = client.channel(`conference:${roomId}`, {
      config: {
        presence: { key: self.id },
        // Signalling is addressed peer to peer, so a participant must receive
        // their own broadcasts too when they are the target of a relayed reply.
        broadcast: { self: false, ack: false },
      },
    });

    const signalling = new ConferenceSignalling(
      client, channel, roomId, presence,
      config.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
    );

    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      const message = payload as SignalMessage;
      // Directed messages are dropped by everyone they are not for. The
      // channel is a room-wide bus; the addressing is ours.
      if ('to' in message && message.to !== 'all' && message.to !== self.id) return;
      signalling.dispatch(message.kind, message);
    });

    channel.on('presence', { event: 'sync' }, () => {
      signalling.emitPresence();
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out reaching the conference channel.')),
        15000,
      );
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          void channel.track(presence).then(() => resolve());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(err ?? new Error(`Could not join the conference channel (${status}).`));
        }
      });
    });

    return signalling;
  }

  /** Everyone currently in the room, ordered by when they arrived. */
  participants(): SignalPresence[] {
    const state = this.channel.presenceState<SignalPresence>();
    return Object.values(state)
      .flat()
      .map((p) => p as unknown as SignalPresence)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  /** Updates this participant's own state — muted, camera off, presenting. */
  async updateSelf(patch: Partial<Omit<SignalPresence, 'id' | 'joinedAt'>>): Promise<void> {
    if (this.closed) return;
    Object.assign(this.self, patch);
    await this.channel.track(this.self);
  }

  async send(message: SignalMessage): Promise<void> {
    if (this.closed) return;
    await this.channel.send({ type: 'broadcast', event: 'signal', payload: message });
  }

  on<K extends SignalMessage['kind']>(
    kind: K,
    handler: Handler<Extract<SignalMessage, { kind: K }>>,
  ): () => void {
    if (!this.handlers.has(kind)) this.handlers.set(kind, new Set());
    const set = this.handlers.get(kind)!;
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  /** Notified whenever anyone joins, leaves, or changes their own state. */
  onPresence(handler: Handler<SignalPresence[]>): () => void {
    this.presenceHandlers.add(handler);
    handler(this.participants());
    return () => this.presenceHandlers.delete(handler);
  }

  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.handlers.clear();
    this.presenceHandlers.clear();
    try {
      await this.channel.untrack();
      await this.client.removeChannel(this.channel);
    } catch {
      // Leaving is best-effort: presence times out on its own if this fails.
    }
  }

  private dispatch(kind: string, message: SignalMessage) {
    this.handlers.get(kind)?.forEach((h) => {
      try {
        (h as Handler<SignalMessage>)(message);
      } catch (e) {
        console.warn('conference handler failed', e);
      }
    });
  }

  private emitPresence() {
    const list = this.participants();
    this.presenceHandlers.forEach((h) => {
      try {
        h(list);
      } catch (e) {
        console.warn('presence handler failed', e);
      }
    });
  }
}
