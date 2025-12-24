/**
 * Video Conference Service
 * Handles WebRTC connections, screen sharing, and media management
 */

import { apiClient } from './apiClient';

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
  type: 'mdt' | 'consultation' | 'education' | 'general';
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

class VideoConferenceService {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private signalingSocket: WebSocket | null = null;
  private currentRoom: ConferenceRoom | null = null;
  private localParticipant: Participant | null = null;
  
  private eventListeners: Map<string, Set<Function>> = new Map();

  // ICE Servers configuration (STUN/TURN)
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Pre-initialize common event types
    ['participant-joined', 'participant-left', 'stream-added', 'stream-removed', 
     'screen-share-started', 'screen-share-stopped', 'message-received', 
     'presentation-started', 'presentation-stopped', 'room-closed'].forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Subscribe to conference events
   */
  on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.eventListeners.get(event)?.forEach(callback => callback(data));
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<{
    videoInputs: MediaDeviceInfo[];
    audioInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        videoInputs: devices.filter(d => d.kind === 'videoinput'),
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
      };
    } catch (error) {
      console.error('Error getting media devices:', error);
      return { videoInputs: [], audioInputs: [], audioOutputs: [] };
    }
  }

  /**
   * Request camera and microphone access
   */
  async requestMediaAccess(constraints: MediaConstraints = { video: true, audio: true }): Promise<MediaStream | null> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Unable to access camera/microphone. Please check permissions.');
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: true,
      });

      // Handle when user stops sharing via browser UI
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      this.emit('screen-share-started', { stream: this.screenStream });
      
      // Notify other participants
      this.broadcastMessage({
        type: 'screen-share-started',
        participantId: this.localParticipant?.id,
      });

      return this.screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }

  /**
   * Stop screen sharing
   */
  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.emit('screen-share-stopped');
      
      this.broadcastMessage({
        type: 'screen-share-stopped',
        participantId: this.localParticipant?.id,
      });
    }
  }

  /**
   * Create a new conference room
   */
  async createRoom(name: string, type: ConferenceRoom['type'], settings?: Partial<RoomSettings>): Promise<ConferenceRoom | null> {
    try {
      const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const room: ConferenceRoom = {
        id: roomId,
        name,
        hostId: this.localParticipant?.id || '',
        participants: [],
        isActive: true,
        createdAt: new Date(),
        type,
        settings: {
          allowScreenShare: true,
          allowRecording: false,
          allowChat: true,
          maxParticipants: 50,
          requireApproval: false,
          waitingRoomEnabled: false,
          ...settings,
        },
      };

      this.currentRoom = room;
      await this.connectToSignalingServer(roomId);
      
      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      return null;
    }
  }

  /**
   * Join an existing conference room
   */
  async joinRoom(roomId: string, participant: Omit<Participant, 'stream' | 'joinedAt'>): Promise<boolean> {
    try {
      this.localParticipant = {
        ...participant,
        joinedAt: new Date(),
      };

      await this.connectToSignalingServer(roomId);
      
      // Request local media
      await this.requestMediaAccess();
      
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      return false;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom() {
    // Close all peer connections
    this.peerConnections.forEach((pc, id) => {
      pc.close();
      this.peerConnections.delete(id);
    });

    // Close data channels
    this.dataChannels.forEach((dc, id) => {
      dc.close();
      this.dataChannels.delete(id);
    });

    // Stop local streams
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;

    this.stopScreenShare();

    // Disconnect from signaling server
    if (this.signalingSocket) {
      this.signalingSocket.close();
      this.signalingSocket = null;
    }

    this.currentRoom = null;
    this.localParticipant = null;
  }

  /**
   * Connect to WebSocket signaling server
   */
  private async connectToSignalingServer(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = import.meta.env.PROD 
        ? `wss://${window.location.host}/ws/conference/${roomId}`
        : `ws://localhost:3001/ws/conference/${roomId}`;

      this.signalingSocket = new WebSocket(wsUrl);

      this.signalingSocket.onopen = () => {
        console.log('Connected to signaling server');
        this.signalingSocket?.send(JSON.stringify({
          type: 'join',
          participant: this.localParticipant,
          roomId,
        }));
        resolve();
      };

      this.signalingSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      };

      this.signalingSocket.onerror = (error) => {
        console.error('Signaling server error:', error);
        reject(error);
      };

      this.signalingSocket.onclose = () => {
        console.log('Disconnected from signaling server');
      };
    });
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalingMessage(message: any) {
    switch (message.type) {
      case 'participant-joined':
        this.emit('participant-joined', message.participant);
        await this.createPeerConnection(message.participant.id);
        break;

      case 'participant-left':
        this.emit('participant-left', message.participantId);
        this.closePeerConnection(message.participantId);
        break;

      case 'offer':
        await this.handleOffer(message.from, message.offer);
        break;

      case 'answer':
        await this.handleAnswer(message.from, message.answer);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(message.from, message.candidate);
        break;

      case 'chat-message':
        this.emit('message-received', message);
        break;

      case 'presentation-started':
        this.emit('presentation-started', message);
        break;

      case 'presentation-stopped':
        this.emit('presentation-stopped', message);
        break;

      case 'room-closed':
        this.emit('room-closed', message);
        await this.leaveRoom();
        break;
    }
  }

  /**
   * Create a peer connection for a participant
   */
  private async createPeerConnection(participantId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(participantId, pc);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      this.emit('stream-added', {
        participantId,
        stream: event.streams[0],
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          to: participantId,
          candidate: event.candidate,
        });
      }
    };

    // Create data channel for chat
    const dataChannel = pc.createDataChannel('chat');
    this.setupDataChannel(dataChannel, participantId);

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.sendSignalingMessage({
      type: 'offer',
      to: participantId,
      offer: pc.localDescription,
    });

    return pc;
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(from, pc);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      this.emit('stream-added', {
        participantId: from,
        stream: event.streams[0],
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          to: from,
          candidate: event.candidate,
        });
      }
    };

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, from);
    };

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      to: from,
      answer: pc.localDescription,
    });
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(from);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(from);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  }

  /**
   * Setup data channel for messaging
   */
  private setupDataChannel(channel: RTCDataChannel, participantId: string) {
    this.dataChannels.set(participantId, channel);

    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.emit('message-received', {
        ...message,
        from: participantId,
      });
    };

    channel.onclose = () => {
      this.dataChannels.delete(participantId);
    };
  }

  /**
   * Close a peer connection
   */
  private closePeerConnection(participantId: string) {
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(participantId);
    }

    const dc = this.dataChannels.get(participantId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(participantId);
    }

    this.emit('stream-removed', { participantId });
  }

  /**
   * Send message via signaling server
   */
  private sendSignalingMessage(message: any) {
    if (this.signalingSocket?.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify({
        ...message,
        from: this.localParticipant?.id,
      }));
    }
  }

  /**
   * Broadcast message to all participants
   */
  broadcastMessage(message: any) {
    this.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(content: string, type: 'text' | 'file' | 'reaction' = 'text') {
    const message = {
      id: `msg-${Date.now()}`,
      type: 'chat-message',
      content,
      messageType: type,
      sender: this.localParticipant,
      timestamp: new Date().toISOString(),
    };

    this.broadcastMessage(message);
    this.emit('message-received', { ...message, isSelf: true });
  }

  /**
   * Toggle local audio
   */
  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Toggle local video
   */
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get screen share stream
   */
  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  /**
   * Get current room
   */
  getCurrentRoom(): ConferenceRoom | null {
    return this.currentRoom;
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): Participant | null {
    return this.localParticipant;
  }
}

export const videoConferenceService = new VideoConferenceService();
export default videoConferenceService;
