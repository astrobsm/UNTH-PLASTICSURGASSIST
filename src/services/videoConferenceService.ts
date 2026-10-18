/**
 * The conference: media, peers, and who is in the room.
 *
 * Audio and video travel directly between participants. Nothing but the
 * handshake passes through a server, which is why a meeting stays usable when
 * the connection is poor for one person but not the others.
 *
 * The handshake itself goes over Supabase Realtime — see conferenceSignalling.
 * It used to go over a WebSocket served by the app's own host, which Vercel
 * cannot do, so the whole module disabled itself in production and both
 * "Start New Meeting" and "Join Meeting" failed. That check is gone; the
 * transport it was compensating for has been replaced.
 *
 * Peers are meshed: each participant connects to every other. That is right
 * for a unit meeting of under ten with a presenter and mostly-quiet listeners.
 * It is the wrong shape for thirty cameras, which would need a media server.
 */

import {
  ConferenceSignalling,
  loadConferenceConfig,
  type SignalPresence,
  type ControlAction,
} from './conferenceSignalling';

export interface Participant {
  id: string;
  name: string;
  role: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isPresenting: boolean;
  joinedAt: Date;
}

export interface ConferenceRoom {
  id: string;
  name: string;
  hostId: string;
  participants: Participant[];
  isActive: boolean;
  createdAt: Date;
  type: 'mdt' | 'consultation' | 'education' | 'general' | 'pre_surgical';
  settings: RoomSettings;
}

export interface RoomSettings {
  allowScreenShare: boolean;
  allowRecording: boolean;
  allowChat: boolean;
  maxParticipants: number;
  requireApproval: boolean;
  waitingRoomEnabled: boolean;
}

export interface MediaConstraints {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
}

/** The case currently on everyone's screen, if any. */
export interface StageState {
  patientId: string | null;
  patientName?: string;
  presenterId?: string;
}

/**
 * A conference event listener.
 *
 * Named rather than `Function`, which accepts class declarations and anything
 * else callable and so promises nothing about how it may be invoked.
 */
type ConferenceEventListener = (data?: any) => void;

const DEFAULT_SETTINGS: RoomSettings = {
  allowScreenShare: true,
  allowRecording: false,
  allowChat: true,
  maxParticipants: 25,
  requireApproval: false,
  waitingRoomEnabled: false,
};

class VideoConferenceService {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  /** ICE candidates that arrived before the peer's remote description. */
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private signalling: ConferenceSignalling | null = null;
  private unsubscribes: Array<() => void> = [];
  private listeners = new Map<string, Set<ConferenceEventListener>>();

  private currentRoom: ConferenceRoom | null = null;
  private localParticipant: Participant | null = null;
  private stage: StageState = { patientId: null };

  // ── events ────────────────────────────────────────────────────────────────

  on(event: string, callback: ConferenceEventListener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn(`conference listener for "${event}" failed`, e);
      }
    });
  }

  // ── media ─────────────────────────────────────────────────────────────────

  async getMediaDevices(): Promise<{ cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[]; speakers: MediaDeviceInfo[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        cameras: devices.filter((d) => d.kind === 'videoinput'),
        microphones: devices.filter((d) => d.kind === 'audioinput'),
        speakers: devices.filter((d) => d.kind === 'audiooutput'),
      };
    } catch {
      return { cameras: [], microphones: [], speakers: [] };
    }
  }

  async requestMediaAccess(
    constraints: MediaConstraints = { video: true, audio: true },
  ): Promise<MediaStream | null> {
    try {
      // Replaces any previous stream rather than leaving the old camera on.
      this.localStream?.getTracks().forEach((t) => t.stop());
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.replaceOutgoingTracks(this.localStream);
      this.emit('local-stream', this.localStream);
      return this.localStream;
    } catch (error) {
      this.emit('error', {
        code: 'MEDIA_DENIED',
        message: 'Could not reach your camera or microphone. Check the browser permissions.',
        error,
      });
      return null;
    }
  }

  /**
   * Shares a screen, a window or a tab.
   *
   * The shared video replaces the camera on every existing peer connection, so
   * participants see it without renegotiating, and the camera is restored when
   * the share ends — including when it is ended from the browser's own bar,
   * which is why the track's `ended` event is listened for.
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: true,
      });

      const [track] = this.screenStream.getVideoTracks();
      this.replaceVideoTrack(track);
      track.addEventListener('ended', () => this.stopScreenShare());

      if (this.localParticipant) this.localParticipant.isScreenSharing = true;
      void this.signalling?.updateSelf({ isScreenSharing: true });
      this.emit('screen-share-started', this.screenStream);
      return this.screenStream;
    } catch {
      // A cancelled picker is a choice, not a failure.
      return null;
    }
  }

  stopScreenShare() {
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;

    const cameraTrack = this.localStream?.getVideoTracks()[0];
    if (cameraTrack) this.replaceVideoTrack(cameraTrack);

    if (this.localParticipant) this.localParticipant.isScreenSharing = false;
    void this.signalling?.updateSelf({ isScreenSharing: false });
    this.emit('screen-share-stopped');
  }

  /**
   * Every peer connection carries one audio and one video transceiver from the
   * start, sending or not. Outgoing media is then always a replaceTrack on the
   * right transceiver — no renegotiation. Previously a participant who joined
   * with the camera off and turned it on later called addTrack without a new
   * offer, so nobody ever saw them.
   */
  private senderFor(pc: RTCPeerConnection, kind: 'audio' | 'video'): RTCRtpSender | undefined {
    // Every transceiver has a receiver track of its kind, sending or not.
    return pc.getTransceivers().find((x) => x.receiver.track?.kind === kind)?.sender;
  }

  private attachLocalTracks(pc: RTCPeerConnection) {
    for (const kind of ['audio', 'video'] as const) {
      const track = kind === 'video'
        ? (this.screenStream?.getVideoTracks()[0] || this.localStream?.getVideoTracks()[0] || null)
        : (this.localStream?.getAudioTracks()[0] || null);
      const tr = pc.getTransceivers().find((x) => x.receiver.track?.kind === kind);
      if (!tr) continue;
      if (tr.direction !== 'sendrecv') {
        try { tr.direction = 'sendrecv'; } catch { /* closed */ }
      }
      void tr.sender.replaceTrack(track).catch(() => { /* peer closed */ });
    }
  }

  /** Swaps the outgoing video on every peer without a renegotiation. */
  private replaceVideoTrack(track: MediaStreamTrack) {
    this.peerConnections.forEach((pc) => {
      void this.senderFor(pc, 'video')?.replaceTrack(track).catch(() => {});
    });
  }

  private replaceOutgoingTracks(_stream: MediaStream) {
    this.peerConnections.forEach((pc) => this.attachLocalTracks(pc));
  }

  // ── rooms ─────────────────────────────────────────────────────────────────

  /** Is the conference usable on this deployment? */
  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const config = await loadConferenceConfig();
    return config.configured ? { ok: true } : { ok: false, reason: config.reason };
  }

  async createRoom(
    name: string,
    type: ConferenceRoom['type'] = 'general',
    settings?: Partial<RoomSettings>,
  ): Promise<ConferenceRoom | null> {
    // Short enough to read aloud on a ward round, long enough not to collide.
    // The channel is reachable by anyone who knows the id, so the random part
    // is long enough not to be guessed.
    const rand = (() => {
      try { return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join(''); }
      catch { return Math.random().toString(36).slice(2, 12); }
    })();
    const roomId = `${type === 'pre_surgical' ? 'psc' : 'psa'}-${Date.now().toString(36)}-${rand}`;
    this.currentRoom = {
      id: roomId,
      name,
      hostId: '',
      participants: [],
      isActive: true,
      createdAt: new Date(),
      type,
      settings: { ...DEFAULT_SETTINGS, ...settings },
    };
    return this.currentRoom;
  }

  /**
   * Joins a room and connects to everyone already in it.
   *
   * The participant who was there first offers to the one who arrives, so two
   * peers never offer to each other at the same time and glare into a failed
   * negotiation.
   */
  async joinRoom(
    roomId: string,
    participant: Omit<Participant, 'stream' | 'joinedAt'>,
  ): Promise<boolean> {
    try {
      this.localParticipant = { ...participant, joinedAt: new Date() };

      this.signalling = await ConferenceSignalling.join(roomId, {
        id: participant.id,
        name: participant.name,
        role: participant.role,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
        isScreenSharing: false,
        isPresenting: false,
      });

      this.wireSignalling();

      if (!this.currentRoom || this.currentRoom.id !== roomId) {
        this.currentRoom = {
          id: roomId,
          name: roomId,
          hostId: this.signalling.participants()[0]?.id ?? participant.id,
          participants: [],
          isActive: true,
          createdAt: new Date(),
          type: roomId.startsWith('psc-') ? 'pre_surgical' : 'general',
          settings: DEFAULT_SETTINGS,
        };
      }

      // Offer to everyone already present. Anyone arriving later offers to us.
      for (const peer of this.signalling.participants()) {
        if (peer.id !== participant.id) await this.offerTo(peer.id);
      }

      this.emit('joined', { roomId });
      return true;
    } catch (error) {
      this.emit('error', {
        code: 'JOIN_FAILED',
        message: error instanceof Error ? error.message : 'Could not join the conference.',
        error,
      });
      return false;
    }
  }

  async leaveRoom() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.pendingIce.clear();

    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];

    await this.signalling?.leave();
    this.signalling = null;

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;

    this.currentRoom = null;
    this.localParticipant = null;
    this.stage = { patientId: null };
    this.emit('left');
  }

  // ── signalling ────────────────────────────────────────────────────────────

  private wireSignalling() {
    const s = this.signalling;
    if (!s) return;

    this.unsubscribes.push(
      s.on('offer', async (m) => {
        try {
          // A fresh offer from a peer we already hold (they reloaded) replaces
          // the old connection rather than colliding with it.
          const old = this.peerConnections.get(m.from);
          if (old && old.signalingState !== 'stable') this.dropPeer(m.from, false);
          const pc = this.peerFor(m.from, false);
          await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
          this.attachLocalTracks(pc);
          await this.flushIce(m.from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await s.send({ kind: 'answer', from: s.self.id, to: m.from, sdp: answer });
        } catch (e) {
          console.warn('conference: could not answer', e);
        }
      }),

      s.on('answer', async (m) => {
        const pc = this.peerConnections.get(m.from);
        // An answer for a connection we no longer hold is stale, not an error.
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
            await this.flushIce(m.from);
          } catch (e) {
            console.warn('conference: bad answer', e);
          }
        }
      }),

      s.on('ice', async (m) => {
        const pc = this.peerConnections.get(m.from);
        // Candidates often arrive before the remote description. They used to
        // be thrown away, which on hospital networks (where the first
        // candidates are often the only ones that work) meant no media.
        if (!pc || !pc.remoteDescription) {
          const q = this.pendingIce.get(m.from) || [];
          q.push(m.candidate);
          this.pendingIce.set(m.from, q);
          return;
        }
        try { await pc.addIceCandidate(new RTCIceCandidate(m.candidate)); } catch { /* stale */ }
      }),

      s.on('chat', (m) => this.emit('message-received', {
        senderId: m.from, senderName: m.name, content: m.text, timestamp: m.at,
      })),

      s.on('control', (m) => this.applyControl(m.action, m.from)),

      s.on('stage', (m) => {
        this.stage = { patientId: m.patientId, patientName: m.patientName, presenterId: m.from };
        this.emit('stage-changed', this.stage);
      }),

      s.onPresence((people) => {
        this.syncParticipants(people);
        // Anyone new who joined after us will offer to us, so we only need to
        // drop the peers who have gone.
        for (const id of [...this.peerConnections.keys()]) {
          if (!people.some((p) => p.id === id)) this.dropPeer(id);
        }
      }),
    );
  }

  private syncParticipants(people: SignalPresence[]) {
    if (!this.currentRoom) return;
    this.currentRoom.hostId = people[0]?.id ?? this.currentRoom.hostId;
    this.currentRoom.participants = people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      audioEnabled: p.audioEnabled,
      videoEnabled: p.videoEnabled,
      isScreenSharing: p.isScreenSharing,
      isPresenting: p.isPresenting,
      joinedAt: new Date(p.joinedAt),
      stream: this.remoteStreams.get(p.id),
    }));
    this.emit('participants-changed', this.currentRoom.participants);
  }

  private async flushIce(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    const q = this.pendingIce.get(peerId);
    if (!pc || !q?.length) return;
    this.pendingIce.delete(peerId);
    for (const c of q) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
    }
  }

  private peerFor(peerId: string, asOfferer = true): RTCPeerConnection {
    const existing = this.peerConnections.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: this.signalling?.iceServers ?? [] });
    this.peerConnections.set(peerId, pc);

    // The offerer creates the audio and video transceivers; the answerer gets
    // them from the offer. Either way media is attached with replaceTrack.
    if (asOfferer) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
      this.attachLocalTracks(pc);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && this.signalling) {
        void this.signalling.send({
          kind: 'ice', from: this.signalling.self.id, to: peerId, candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      // A track sent through a transceiver may arrive without a stream; the
      // peer's tracks are gathered into one stream of our own.
      let stream = this.remoteStreams.get(peerId) || e.streams[0];
      if (!stream) stream = new MediaStream();
      if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
      this.remoteStreams.set(peerId, stream);
      this.emit('stream-added', { participantId: peerId, stream });
      if (this.signalling) this.syncParticipants(this.signalling.participants());
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // A failed connection is retried by restarting ICE; a peer whose
        // network moved (ward wifi to mobile) recovers without rejoining.
        pc.restartIce?.();
      }
    };

    return pc;
  }

  private async offerTo(peerId: string) {
    if (!this.signalling) return;
    const pc = this.peerFor(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.signalling.send({ kind: 'offer', from: this.signalling.self.id, to: peerId, sdp: offer });
  }

  private dropPeer(peerId: string, announce = true) {
    this.peerConnections.get(peerId)?.close();
    this.peerConnections.delete(peerId);
    this.remoteStreams.delete(peerId);
    this.pendingIce.delete(peerId);
    if (announce) this.emit('participant-left', { participantId: peerId });
  }

  // ── host controls ─────────────────────────────────────────────────────────

  /**
   * A host silencing or ending things.
   *
   * The host asks; the participant's own client acts. There is no way to reach
   * into somebody's device and take their microphone, and pretending otherwise
   * would misrepresent what the button does.
   */
  async hostControl(action: ControlAction, target: string | 'all') {
    if (!this.signalling) return;
    if (!this.isHost()) {
      this.emit('error', { code: 'NOT_HOST', message: 'Only the host can do that.' });
      return;
    }
    await this.signalling.send({
      kind: 'control', from: this.signalling.self.id, to: target, action,
    });
    // The host is in the room too, so an "everyone" instruction includes them.
    if (target === 'all') this.applyControl(action, this.signalling.self.id);
  }

  private applyControl(action: ControlAction, from: string) {
    // Only the host's instructions are obeyed. Any participant could otherwise
    // mute everyone or end the meeting by sending the same message.
    if (from !== this.localParticipant?.id && !this.isHost(from)) return;
    switch (action) {
      case 'mute-audio':
        if (this.localParticipant?.audioEnabled) this.toggleAudio();
        this.emit('muted-by-host', { by: from });
        break;
      case 'disable-video':
        if (this.localParticipant?.videoEnabled) this.toggleVideo();
        this.emit('video-disabled-by-host', { by: from });
        break;
      case 'end-meeting':
        this.emit('meeting-ended', { by: from });
        void this.leaveRoom();
        break;
      default:
        break;
    }
  }

  /** Is this participant the host — the first one who joined? */
  isHost(participantId?: string): boolean {
    const id = participantId ?? this.localParticipant?.id;
    return Boolean(id && this.currentRoom?.hostId === id);
  }

  // ── the case on screen ────────────────────────────────────────────────────

  /**
   * Puts a patient's pre-surgical brief on everyone's screen at once.
   *
   * The patient's id is broadcast, not a picture of it: every participant's own
   * app fetches and renders the case. It stays legible on a phone, scrolls
   * independently for anyone who wants a closer look at a photograph, and costs
   * a fraction of the bandwidth of sharing a screen.
   */
  async presentCase(patientId: string | null, patientName?: string) {
    if (!this.signalling) return;
    this.stage = { patientId, patientName, presenterId: this.signalling.self.id };
    await this.signalling.send({
      kind: 'stage', from: this.signalling.self.id, patientId, patientName,
    });
    await this.signalling.updateSelf({ isPresenting: patientId !== null });
    if (this.localParticipant) this.localParticipant.isPresenting = patientId !== null;
    this.emit('stage-changed', this.stage);
  }

  getStage(): StageState {
    return this.stage;
  }

  // ── chat and state ────────────────────────────────────────────────────────

  sendChatMessage(content: string) {
    if (!this.signalling || !content.trim()) return;
    const message = {
      kind: 'chat' as const,
      from: this.signalling.self.id,
      name: this.signalling.self.name,
      text: content.trim(),
      at: new Date().toISOString(),
    };
    void this.signalling.send(message);
    // Broadcasts do not echo to the sender, so the author's own copy is local.
    this.emit('message-received', {
      senderId: message.from, senderName: message.name,
      content: message.text, timestamp: message.at,
    });
  }

  toggleAudio(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    if (this.localParticipant) this.localParticipant.audioEnabled = track.enabled;
    void this.signalling?.updateSelf({ audioEnabled: track.enabled });
    this.emit('audio-toggled', track.enabled);
    return track.enabled;
  }

  toggleVideo(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    if (this.localParticipant) this.localParticipant.videoEnabled = track.enabled;
    void this.signalling?.updateSelf({ videoEnabled: track.enabled });
    this.emit('video-toggled', track.enabled);
    return track.enabled;
  }

  getLocalStream() { return this.localStream; }
  getScreenStream() { return this.screenStream; }
  getCurrentRoom() { return this.currentRoom; }
  getLocalParticipant() { return this.localParticipant; }
  getParticipants(): Participant[] { return this.currentRoom?.participants ?? []; }
}

export const videoConferenceService = new VideoConferenceService();
export default videoConferenceService;
