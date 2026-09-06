/**
 * PSA Conference.
 *
 * Opening this page puts you in the meeting. There is no lobby and no "start
 * or join" choice: the unit has one standing conference on a Tuesday evening,
 * and asking each of fifteen people to agree on a room id before they can see
 * each other was the surest way to lose the first ten minutes of it.
 *
 * A room id in the URL joins that room; without one you join the unit's room
 * for the day, which everybody's app works out the same way.
 *
 * The presenter can put a patient's pre-surgical brief on every screen at once.
 * That is sent as the patient's id rather than as a picture of their screen —
 * each participant's own app renders the case, so it stays sharp on a phone and
 * costs almost nothing. Screen sharing is still there for anything else:
 * imaging, a paper, a window from another program.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, MonitorUp, MonitorX,
  Users, MessageSquare, Send, Loader2, AlertTriangle, Presentation,
  X, Copy, Check, ShieldOff, Search, ClipboardList,
} from 'lucide-react';
import videoConferenceService, { type Participant, type StageState } from '../services/videoConferenceService';
import { preSurgicalConferenceService, type ConferencePatient } from '../services/preSurgicalConferenceService';
import { CasePresentation } from '../components/preSurgicalConference/CasePresentation';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';

interface ChatLine {
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

/** How often a participant's presence is written to the register. */
const HEARTBEAT_MS = 60_000;

/**
 * The unit's room for a given day.
 *
 * Derived from the date so everyone's app arrives at the same id without
 * anybody circulating one. A specific room can still be joined by URL.
 */
function roomForToday(): string {
  return `psc-${new Date().toISOString().slice(0, 10)}`;
}

export default function VideoConference() {
  const { roomId: roomFromUrl } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const roomId = roomFromUrl || roomForToday();

  const [status, setStatus] = useState<'joining' | 'in' | 'failed'>('joining');
  const [failure, setFailure] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [stage, setStage] = useState<StageState>({ patientId: null });
  const [notice, setNotice] = useState<string>('');

  const [showPeople, setShowPeople] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const joinedRef = useRef(false);

  const selfId = String(user?.id ?? '');
  const isHost = useMemo(
    () => participants.length > 0 && participants[0]?.id === selfId,
    [participants, selfId],
  );

  // ── join on arrival ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || joinedRef.current) return;
    joinedRef.current = true;
    let cancelled = false;

    (async () => {
      const available = await videoConferenceService.isAvailable();
      if (!available.ok) {
        if (!cancelled) {
          setFailure(available.reason || 'The conference is not configured on this deployment.');
          setStatus('failed');
        }
        return;
      }

      // Microphone only to begin with. Fifteen cameras opening at once on a
      // ward connection helps nobody; anyone who wants to be seen turns theirs
      // on. A refused microphone is not fatal — you can still watch and listen.
      const stream = await videoConferenceService.requestMediaAccess({ audio: true, video: false });
      if (!cancelled) {
        setLocalStream(stream);
        setMicOn(Boolean(stream));
      }

      const ok = await videoConferenceService.joinRoom(roomId, {
        id: selfId,
        name: user.name || user.full_name || 'Unknown',
        role: user.role || 'staff',
        audioEnabled: Boolean(stream),
        videoEnabled: false,
        isScreenSharing: false,
        isPresenting: false,
      });

      if (cancelled) return;
      if (!ok) { setStatus('failed'); return; }
      setStatus('in');

      // The register. Presence says who is here now; this says who came.
      void apiClient.post('/conference-attendance', {
        action: 'join', roomId, type: roomId.startsWith('psc-') ? 'pre_surgical' : 'general',
        topic: roomId.startsWith('psc-') ? 'Pre-Surgical Conference' : undefined,
      }).catch(() => { /* the meeting matters more than the register */ });
    })();

    return () => { cancelled = true; };
  }, [user, roomId, selfId]);

  // ── service events ────────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      videoConferenceService.on('participants-changed', (list: Participant[]) => setParticipants([...list])),
      videoConferenceService.on('stream-added', () => setParticipants([...videoConferenceService.getParticipants()])),
      videoConferenceService.on('stage-changed', (s: StageState) => setStage({ ...s })),
      videoConferenceService.on('local-stream', (s: MediaStream) => setLocalStream(s)),
      videoConferenceService.on('message-received', (m: ChatLine) => setChat((c) => [...c, m])),
      videoConferenceService.on('audio-toggled', (on: boolean) => setMicOn(on)),
      videoConferenceService.on('video-toggled', (on: boolean) => setCamOn(on)),
      videoConferenceService.on('screen-share-started', () => setSharing(true)),
      videoConferenceService.on('screen-share-stopped', () => setSharing(false)),
      videoConferenceService.on('muted-by-host', () => setNotice('You were muted by the host.')),
      videoConferenceService.on('video-disabled-by-host', () => setNotice('Your camera was turned off by the host.')),
      videoConferenceService.on('meeting-ended', () => {
        setNotice('The host ended the meeting.');
        setStatus('failed');
        setFailure('The host ended the meeting.');
      }),
      videoConferenceService.on('error', (e: { message?: string }) => {
        if (e?.message) setNotice(e.message);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Keep the register honest while the meeting runs.
  useEffect(() => {
    if (status !== 'in') return;
    const timer = setInterval(() => {
      void apiClient.post('/conference-attendance', {
        action: 'heartbeat', roomId, seconds: HEARTBEAT_MS / 1000,
      }).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [status, roomId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Leaving by closing the tab still closes the register entry.
  useEffect(() => {
    const onUnload = () => {
      navigator.sendBeacon?.(
        '/api/conference-attendance',
        new Blob([JSON.stringify({ action: 'leave', roomId })], { type: 'application/json' }),
      );
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, [roomId]);

  // ── actions ───────────────────────────────────────────────────────────────

  const leave = useCallback(async () => {
    await apiClient.post('/conference-attendance', { action: 'leave', roomId }).catch(() => {});
    await videoConferenceService.leaveRoom();
    navigate('/');
  }, [navigate, roomId]);

  const toggleCam = useCallback(async () => {
    // The camera is opened on first use rather than at join, so a participant
    // who never turns it on never has it touched.
    if (!localStream?.getVideoTracks().length) {
      const stream = await videoConferenceService.requestMediaAccess({ audio: true, video: true });
      if (stream) { setLocalStream(stream); setCamOn(true); }
      return;
    }
    videoConferenceService.toggleVideo();
  }, [localStream]);

  const presentCase = useCallback(async (patient: ConferencePatient | null) => {
    await videoConferenceService.presentCase(patient?.id ?? null, patient?.full_name);
    setShowCasePicker(false);
    void apiClient.post('/conference-attendance', {
      action: 'present-case', roomId,
      patientId: patient?.id ?? null, patientName: patient?.full_name,
    }).catch(() => {});
  }, [roomId]);

  const copyInvite = useCallback(() => {
    void navigator.clipboard.writeText(`${window.location.origin}/conference/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  // ── screens ───────────────────────────────────────────────────────────────

  if (status === 'joining') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <Loader2 className="w-10 h-10 animate-spin text-green-400 mb-4" />
        <p className="font-medium">Joining the conference…</p>
        <p className="text-sm text-slate-400 mt-1">{roomId}</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
        <h1 className="text-lg font-semibold mb-2">The conference could not start</h1>
        <p className="text-sm text-slate-300 max-w-md">{failure}</p>
        <button onClick={() => navigate('/')} className="mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
          Back to dashboard
        </button>
      </div>
    );
  }

  const others = participants.filter((p) => p.id !== selfId);
  const presenting = Boolean(stage.patientId);

  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-b border-slate-700 bg-slate-800">
        <div className="min-w-0">
          <h1 className="font-semibold text-sm sm:text-base truncate">
            {roomId.startsWith('psc-') ? 'Pre-Surgical Conference' : 'PSA Conference'}
          </h1>
          <p className="text-[11px] text-slate-400 truncate">
            {participants.length} in the room{isHost ? ' · you are hosting' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={copyInvite} title="Copy the invite link"
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowPeople(!showPeople)} title="Participants"
            className={`p-2 rounded-lg ${showPeople ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <Users className="w-4 h-4" />
          </button>
          <button onClick={() => setShowChat(!showChat)} title="Chat"
            className={`p-2 rounded-lg ${showChat ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </header>

      {notice && (
        <div role="status" className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-200">
          {notice}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Stage — the case, if one is up; otherwise the people. */}
        <main className="flex-1 min-w-0 flex flex-col">
          {presenting ? (
            <div className="flex-1 min-h-0 flex flex-col bg-white text-gray-900">
              <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-green-700 text-white">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-green-200">Presenting</p>
                  <p className="font-semibold text-sm truncate">{stage.patientName || 'Case'}</p>
                </div>
                {/* Only whoever put the case up can take it down. */}
                {stage.presenterId === selfId && (
                  <button onClick={() => presentCase(null)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm">
                    <X className="w-4 h-4" /> Stop presenting
                  </button>
                )}
              </div>
              <CasePresentation
                patientId={stage.patientId!}
                followerMode={stage.presenterId !== selfId}
                className="flex-1 min-h-0"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <SelfTile stream={localStream} name={user?.name || 'You'} camOn={camOn} micOn={micOn} sharing={sharing} />
                {others.map((p) => <PeerTile key={p.id} participant={p} />)}
              </div>
              {others.length === 0 && (
                <p className="text-center text-slate-400 text-sm mt-8">
                  You are the first one here. Share the link, or wait — the conference starts at 8:00 p.m.
                </p>
              )}
            </div>
          )}

          {/* When a case is up, the faces move to a strip so the room can still
              see who is speaking without losing the brief. */}
          {presenting && others.length > 0 && (
            <div className="shrink-0 flex gap-2 overflow-x-auto p-2 bg-slate-800 border-t border-slate-700">
              <SelfTile stream={localStream} name={user?.name || 'You'} camOn={camOn} micOn={micOn} sharing={sharing} compact />
              {others.map((p) => <PeerTile key={p.id} participant={p} compact />)}
            </div>
          )}
        </main>

        {(showPeople || showChat) && (
          <aside className="w-72 shrink-0 border-l border-slate-700 bg-slate-800 flex flex-col min-h-0">
            {showPeople && (
              <PeoplePanel
                participants={participants} selfId={selfId} isHost={isHost}
                onMute={(id) => videoConferenceService.hostControl('mute-audio', id)}
                onStopVideo={(id) => videoConferenceService.hostControl('disable-video', id)}
                onMuteAll={() => videoConferenceService.hostControl('mute-audio', 'all')}
              />
            )}
            {showChat && (
              <ChatPanel
                chat={chat} draft={draft} setDraft={setDraft}
                onSend={() => { videoConferenceService.sendChatMessage(draft); setDraft(''); }}
              />
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 px-3 py-3 border-t border-slate-700 bg-slate-800">
        <ControlButton onClick={() => videoConferenceService.toggleAudio()} active={micOn}
          onIcon={<Mic className="w-5 h-5" />} offIcon={<MicOff className="w-5 h-5" />}
          label={micOn ? 'Mute' : 'Unmute'} />

        <ControlButton onClick={toggleCam} active={camOn}
          onIcon={<Video className="w-5 h-5" />} offIcon={<VideoOff className="w-5 h-5" />}
          label={camOn ? 'Stop video' : 'Start video'} />

        <ControlButton
          onClick={() => (sharing ? videoConferenceService.stopScreenShare() : videoConferenceService.startScreenShare())}
          active={sharing}
          onIcon={<MonitorX className="w-5 h-5" />} offIcon={<MonitorUp className="w-5 h-5" />}
          label={sharing ? 'Stop sharing' : 'Share screen'} />

        <button
          onClick={() => setShowCasePicker(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-sm font-medium"
          title="Put a patient's pre-surgical brief on every screen"
        >
          <Presentation className="w-5 h-5" />
          <span className="hidden sm:inline">Present case</span>
        </button>

        {isHost && (
          <ControlButton onClick={() => videoConferenceService.hostControl('mute-audio', 'all')} active={false}
            onIcon={<ShieldOff className="w-5 h-5" />} offIcon={<ShieldOff className="w-5 h-5" />}
            label="Mute everyone" />
        )}

        <button onClick={leave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-sm font-medium">
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </footer>

      {showCasePicker && (
        <CasePicker onPick={presentCase} onClose={() => setShowCasePicker(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ControlButton({ onClick, active, onIcon, offIcon, label }: {
  onClick: () => void; active: boolean;
  onIcon: React.ReactNode; offIcon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`p-2.5 sm:p-3 rounded-full transition-colors ${
        active ? 'bg-slate-600 hover:bg-slate-500' : 'bg-red-600/80 hover:bg-red-600'
      }`}>
      {active ? onIcon : offIcon}
    </button>
  );
}

/**
 * The participant's own preview.
 *
 * Takes the stream directly rather than through a ref shared with the parent:
 * the tile is rendered twice — as a grid tile and again in the filmstrip when a
 * case is up — and a single ref cannot drive two `<video>` elements at once.
 * Muted, always: playing your own microphone back is a howl of feedback.
 */
function SelfTile({ stream, name, camOn, micOn, sharing, compact }: {
  stream: MediaStream | null; name: string;
  camOn: boolean; micOn: boolean; sharing: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-slate-800 border border-slate-700 ${
      compact ? 'w-40 shrink-0 aspect-video' : 'aspect-video'
    }`}>
      <video ref={ref} autoPlay playsInline muted
        className={`w-full h-full object-cover ${camOn || sharing ? '' : 'hidden'}`} />
      {!camOn && !sharing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-xl font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
        <span className="text-xs bg-black/60 px-1.5 py-0.5 rounded truncate">{name} (you)</span>
        {!micOn && <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PeerTile({ participant, compact }: { participant: Participant; compact?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && participant.stream) ref.current.srcObject = participant.stream;
  }, [participant.stream]);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-slate-800 border border-slate-700 ${
      compact ? 'w-40 shrink-0 aspect-video' : 'aspect-video'
    }`}>
      <video ref={ref} autoPlay playsInline
        className={`w-full h-full object-cover ${participant.videoEnabled || participant.isScreenSharing ? '' : 'hidden'}`} />
      {!participant.videoEnabled && !participant.isScreenSharing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-slate-600 flex items-center justify-center text-xl font-semibold">
            {participant.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
        <span className="text-xs bg-black/60 px-1.5 py-0.5 rounded truncate">{participant.name}</span>
        {!participant.audioEnabled && <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
        {participant.isScreenSharing && <MonitorUp className="w-3.5 h-3.5 text-green-400 shrink-0" />}
      </div>
    </div>
  );
}

function PeoplePanel({ participants, selfId, isHost, onMute, onStopVideo, onMuteAll }: {
  participants: Participant[]; selfId: string; isHost: boolean;
  onMute: (id: string) => void; onStopVideo: (id: string) => void; onMuteAll: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <h2 className="text-sm font-semibold">In the room ({participants.length})</h2>
        {isHost && (
          <button onClick={onMuteAll} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
            Mute all
          </button>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {participants.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/50">
            <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-semibold shrink-0">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">
                {p.name}{p.id === selfId ? ' (you)' : ''}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {i === 0 ? 'Host · ' : ''}{p.role?.replace(/_/g, ' ')}
              </p>
            </div>
            {!p.audioEnabled && <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
            {isHost && p.id !== selfId && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onMute(p.id)} title="Mute"
                  className="p-1 rounded hover:bg-slate-600"><MicOff className="w-3.5 h-3.5" /></button>
                <button onClick={() => onStopVideo(p.id)} title="Turn off camera"
                  className="p-1 rounded hover:bg-slate-600"><VideoOff className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {isHost && (
        <p className="shrink-0 px-3 py-2 text-[11px] text-slate-400 border-t border-slate-700">
          Muting asks that person's app to mute them. They can turn it back on.
        </p>
      )}
    </div>
  );
}

function ChatPanel({ chat, draft, setDraft, onSend }: {
  chat: ChatLine[]; draft: string; setDraft: (v: string) => void; onSend: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 border-t border-slate-700">
      <h2 className="shrink-0 px-3 py-2 text-sm font-semibold border-b border-slate-700">Chat</h2>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {chat.map((m, i) => (
          <div key={`${m.timestamp}-${i}`} className="text-sm">
            <p className="text-[11px] text-slate-400">{m.senderName}</p>
            <p className="break-words">{m.content}</p>
          </div>
        ))}
        {chat.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No messages yet.</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="shrink-0 flex gap-1.5 p-2 border-t border-slate-700">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…"
          className="flex-1 min-w-0 bg-slate-700 rounded-lg px-2.5 py-1.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
        <button type="submit" disabled={!draft.trim()}
          className="p-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

/** Picks the case to put in front of the room. */
function CasePicker({ onPick, onClose }: {
  onPick: (p: ConferencePatient | null) => void; onClose: () => void;
}) {
  const [patients, setPatients] = useState<ConferencePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    preSurgicalConferenceService.getScheduledPatients()
      .then(setPatients)
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const shown = patients.filter((p) =>
    !query.trim()
    || p.full_name?.toLowerCase().includes(query.toLowerCase())
    || p.hospital_number?.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-green-600" /> Present a case
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="shrink-0 p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or hospital number…"
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading the list…</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {patients.length === 0
                ? 'No cases are booked for conference. Bookings close at 10:00 a.m. on Tuesday.'
                : 'No patient matches that search.'}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onPick(p)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors">
                    <p className="font-medium text-sm">{p.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {p.hospital_number}{p.ward ? ` · ${p.ward}` : ''}
                      {p.primary_diagnosis ? ` · ${p.primary_diagnosis}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
