/**
 * Chat Service
 * Handles real-time messaging, file sharing, and chat persistence
 */

import { apiClient } from './apiClient';
import { logger } from '../utils/logger';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'system' | 'reaction';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: string;
  reactions?: { [emoji: string]: string[] };
  timestamp: Date;
  isRead: boolean;
  isEdited: boolean;
  editedAt?: Date;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'conference' | 'patient';
  participants: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  patientId?: string;
  isActive: boolean;
}

export interface ChatParticipant {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  isTyping: boolean;
}

/**
 * A chat event listener.
 *
 * Named rather than `Function`, which accepts class declarations and anything
 * else callable and so promises nothing about how it may be invoked. Every
 * event here is emitted with a single payload.
 */
type ChatEventListener = (data?: any) => void;

class ChatService {
  private socket: WebSocket | null = null;
  private currentUserId: string = '';
  private currentUserName: string = '';
  private currentUserRole: string = '';
  private eventListeners: Map<string, Set<ChatEventListener>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageQueue: ChatMessage[] = [];
  private apiAvailable: boolean = true; // Track if API endpoints exist
  private apiChecked: boolean = false;  // Track if we've checked API availability
  /** Object URLs for attachments already fetched, keyed by their server path. */
  private attachmentUrls: Map<string, string> = new Map();

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    ['message-received', 'typing-started', 'typing-stopped', 'user-online', 
     'user-offline', 'room-created', 'room-updated', 'message-read',
     'connection-status', 'error'].forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Subscribe to chat events
   */
  on(event: string, callback: ChatEventListener): () => void {
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
   * Initialize chat service with user info
   */
  async initialize(userId: string, userName: string, userRole: string): Promise<void> {
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.currentUserRole = userRole;
    
    // HTTP is the transport. The socket is an optional accelerator and is only
    // attempted when a URL is configured for it.
    //
    // It used to be attempted whenever the app was not on Vercel, which meant
    // every development run and every test dialled ws://localhost:3005/ws/chat
    // — an endpoint local-server.js does not serve. The connection failed, the
    // reconnect logic retried it five times with backoff, and each attempt
    // raised an unhandled error event. Nothing was gained by any of it: chat
    // now reads and writes over the API in every environment.
    const wsUrl = this.socketUrl();
    if (!wsUrl) {
      logger.log('Chat: using HTTP transport (no chat socket configured)');
      this.emit('connection-status', { connected: false, reason: 'http' });
      return;
    }

    await this.connect(wsUrl);
  }

  /**
   * The chat socket to use, or null when there is none.
   *
   * Opt-in via VITE_CHAT_WS_URL. Serverless cannot hold a connection open, so
   * on this deployment there is nothing to connect to and the answer is null.
   */
  private socketUrl(): string | null {
    const configured = (import.meta as any).env?.VITE_CHAT_WS_URL;
    return typeof configured === 'string' && configured.trim() ? configured.trim() : null;
  }

  /**
   * Connect to WebSocket server
   */
  private async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('Chat connected');
        this.reconnectAttempts = 0;
        this.emit('connection-status', { connected: true });
        
        // Authenticate
        this.socket?.send(JSON.stringify({
          type: 'auth',
          userId: this.currentUserId,
          userName: this.currentUserName,
          userRole: this.currentUserRole,
          token: apiClient.getToken(),
        }));

        // Process queued messages
        this.processMessageQueue();
        resolve();
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.socket.onerror = (error) => {
        console.error('Chat error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.socket.onclose = () => {
        console.log('Chat disconnected');
        this.emit('connection-status', { connected: false });
        this.attemptReconnect();
      };
    });
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        const wsUrl = this.socketUrl();
        // Nothing to reconnect to if the socket was never configured; the HTTP
        // transport is already carrying the conversation.
        if (wsUrl) this.connect(wsUrl).catch(console.error);
      }, delay);
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any) {
    switch (data.type) {
      case 'message':
        this.emit('message-received', data.message);
        this.saveMessageLocally(data.message);
        break;

      case 'typing':
        if (data.isTyping) {
          this.emit('typing-started', data);
        } else {
          this.emit('typing-stopped', data);
        }
        break;

      case 'presence':
        if (data.isOnline) {
          this.emit('user-online', data);
        } else {
          this.emit('user-offline', data);
        }
        break;

      case 'read-receipt':
        this.emit('message-read', data);
        break;

      case 'room-update':
        this.emit('room-updated', data.room);
        break;
    }
  }

  /**
   * Process queued messages when reconnected
   */
  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message.roomId, message.content, message.type);
      }
    }
  }

  /**
   * Save message to local database
   */
  private async saveMessageLocally(_message: ChatMessage) {
    try {
      // Store in IndexedDB for offline access
      // This would use a chat_messages table
    } catch (error) {
      console.error('Error saving message locally:', error);
    }
  }

  /**
   * Create a new chat room
   */
  async createRoom(
    name: string,
    type: ChatRoom['type'],
    participantIds: string[],
    patientId?: string
  ): Promise<ChatRoom | null> {
    try {
      const room: ChatRoom = {
        id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type,
        participants: [],
        unreadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        patientId,
        isActive: true,
      };

      // Awaited, unlike sending a message: the caller navigates into the room
      // it gets back, and a room that only exists on this client would show an
      // empty history and refuse every message posted into it.
      const saved = await apiClient.post<ChatRoom>('/chat/rooms', {
        id: room.id,
        name: room.name,
        type: room.type,
        participantIds,
        patientId,
      });
      this.apiAvailable = true;
      this.apiChecked = true;
      return saved || room;
    } catch (error) {
      logger.warn('Chat: room could not be created', error);
      this.emit('error', {
        scope: 'create-room',
        message: (error as any)?.message || 'Room could not be created',
      });
      return null;
    }
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId: string): Promise<boolean> {
    // Membership is decided when the room is created, and the server checks it
    // on every read and write. There is no socket subscription to open, so
    // opening a room is just the history fetch the caller does next. Kept as a
    // method because the page calls it and a room it cannot see would fail on
    // that fetch with a 403, which is the honest place for it to fail.
    this.send({ type: 'join-room', roomId });
    return true;
  }

  /**
   * Leave a chat room
   */
  async leaveRoom(roomId: string): Promise<boolean> {
    try {
      this.send({
        type: 'leave-room',
        roomId,
      });
      return true;
    } catch (error) {
      console.error('Error leaving room:', error);
      return false;
    }
  }

  /**
   * Send a message
   */
  sendMessage(
    roomId: string,
    content: string,
    type: ChatMessage['type'] = 'text',
    replyTo?: string
  ): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId: this.currentUserId,
      senderName: this.currentUserName,
      senderRole: this.currentUserRole,
      content,
      type,
      replyTo,
      reactions: {},
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'message',
        message,
      });
    } else {
      // No socket — which on this platform means always. POST it instead.
      //
      // Deliberately not awaited: the caller uses the returned message to show
      // it immediately, and blocking that on a round trip would make the ward's
      // connection visible in the compose box. The id is minted here and the
      // endpoint upserts on it, so a retry cannot double-post.
      void this.postMessage(message);
    }

    return message;
  }

  /**
   * Put a message on the server, and say so if it did not land.
   *
   * A failure here has to be visible. The interface has already drawn the
   * message, so a silent failure leaves the sender believing a clinical
   * instruction was delivered when nothing was stored.
   */
  private async postMessage(message: ChatMessage): Promise<void> {
    try {
      await apiClient.post(`/chat/rooms/${message.roomId}/messages`, {
        id: message.id,
        content: message.content,
        type: message.type,
        fileName: message.fileName,
        fileSize: message.fileSize,
        replyTo: message.replyTo,
      });
      this.apiAvailable = true;
      this.apiChecked = true;
    } catch (error: any) {
      logger.warn('Chat: message could not be sent', error);
      this.emit('error', {
        scope: 'send',
        messageId: message.id,
        roomId: message.roomId,
        message: error?.message || 'Message could not be sent',
      });
    }
  }

  /**
   * Send file message
   */
  async sendFile(roomId: string, file: File): Promise<ChatMessage | null> {
    try {
      // Convert file to base64 for transmission
      const base64 = await this.fileToBase64(file);
      
      const message: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        roomId,
        senderId: this.currentUserId,
        senderName: this.currentUserName,
        senderRole: this.currentUserRole,
        content: base64,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        fileName: file.name,
        fileSize: file.size,
        reactions: {},
        timestamp: new Date(),
        isRead: false,
        isEdited: false,
      };

      // The base64 travels in `content`; the endpoint moves the bytes into
      // chat_attachments and leaves the message holding a reference, so reading
      // a room's history does not drag every attachment along with it.
      await this.postMessage(message);
      return message;
    } catch (error) {
      console.error('Error sending file:', error);
      return null;
    }
  }

  /**
   * Convert file to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }

  /**
   * Add reaction to message
   */
  addReaction(roomId: string, messageId: string, emoji: string) {
    this.send({
      type: 'reaction',
      roomId,
      messageId,
      emoji,
      userId: this.currentUserId,
    });
  }

  /**
   * Remove reaction from message
   */
  removeReaction(roomId: string, messageId: string, emoji: string) {
    this.send({
      type: 'remove-reaction',
      roomId,
      messageId,
      emoji,
      userId: this.currentUserId,
    });
  }

  /**
   * Edit a message
   */
  editMessage(roomId: string, messageId: string, newContent: string) {
    this.send({
      type: 'edit-message',
      roomId,
      messageId,
      content: newContent,
    });
  }

  /**
   * Delete a message
   */
  deleteMessage(roomId: string, messageId: string) {
    this.send({
      type: 'delete-message',
      roomId,
      messageId,
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(roomId: string, isTyping: boolean) {
    this.send({
      type: 'typing',
      roomId,
      isTyping,
      userId: this.currentUserId,
    });
  }

  /**
   * Mark messages as read
   */
  markAsRead(roomId: string, messageIds: string[]) {
    this.send({
      type: 'read-receipt',
      roomId,
      messageIds,
      userId: this.currentUserId,
    });
    // The server tracks a read watermark per participant rather than per
    // message, so the ids are not needed — what matters is that the unread
    // count on the next room list reflects that this room has been opened.
    void apiClient.post(`/chat/rooms/${roomId}/read`, {}).catch(() => {
      /* A missed read receipt costs an incorrect badge, nothing more. */
    });
  }

  /**
   * Get chat rooms for current user
   */
  async getRooms(): Promise<ChatRoom[]> {
    // The permanent "API unavailable" latch that used to guard this is gone.
    // It existed because /chat/* had no handler at all, so one 404 was proof
    // the feature did not exist and retrying only produced noise. Now that the
    // endpoints are real, a failure means a dropped request on hospital Wi-Fi —
    // and latching chat off for the rest of the session over one of those would
    // turn a blip into an outage that only a page reload clears.
    try {
      const rooms = await apiClient.get<ChatRoom[]>('/chat/rooms');
      this.apiAvailable = true;
      this.apiChecked = true;
      return rooms || [];
    } catch (error: any) {
      logger.warn('Chat: could not load rooms', error);
      return [];
    }
  }

  /**
   * Get messages for a room
   */
  async getMessages(roomId: string, limit: number = 50, before?: string): Promise<ChatMessage[]> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (before) params.append('before', before);

      const messages = await apiClient.get<ChatMessage[]>(`/chat/rooms/${roomId}/messages?${params}`);
      this.apiAvailable = true;
      this.apiChecked = true;
      return messages || [];
    } catch (error) {
      logger.warn('Chat: could not load messages', error);
      return [];
    }
  }

  /**
   * A displayable URL for a shared image or file.
   *
   * The bytes are not in the message. Keeping them there would mean every fetch
   * of a room's history carried every attachment ever posted to it, so the
   * endpoint stores them separately and the message holds a path. That path
   * cannot be used as an `<img src>` directly — it needs the bearer token, and
   * it answers with JSON rather than image bytes — so it is fetched through the
   * API client and turned into an object URL here.
   *
   * Cached per path: a room polls every few seconds, and re-downloading its
   * photographs on every tick would be its own kind of broken.
   */
  async getAttachmentUrl(fileUrl: string): Promise<string | null> {
    if (!fileUrl) return null;

    const cached = this.attachmentUrls.get(fileUrl);
    if (cached) return cached;

    try {
      const row = await apiClient.get<{ mimeType: string; dataBase64: string }>(fileUrl);
      if (!row?.dataBase64) return null;

      const binary = atob(row.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const url = URL.createObjectURL(
        new Blob([bytes], { type: row.mimeType || 'application/octet-stream' })
      );
      this.attachmentUrls.set(fileUrl, url);
      return url;
    } catch (error) {
      logger.warn('Chat: attachment could not be fetched', error);
      return null;
    }
  }

  /**
   * Search messages
   */
  async searchMessages(query: string, roomId?: string): Promise<ChatMessage[]> {
    if (!query.trim()) return [];
    try {
      const params = new URLSearchParams({ q: query });
      if (roomId) params.append('roomId', roomId);

      return (await apiClient.get<ChatMessage[]>(`/chat/messages/search?${params}`)) || [];
    } catch (error) {
      logger.warn('Chat: search failed', error);
      return [];
    }
  }

  /**
   * Watch a room for messages other people send.
   *
   * There is no socket on this platform, so "real time" is a poll. It runs only
   * while a room is open and stops when the tab is hidden, which keeps a chat
   * left open on a ward machine from making a request every few seconds all
   * night. New messages are matched by id — the send path mints ids on the
   * client, so a poll that returns the sender's own message recognises it as
   * one it already has rather than drawing it twice.
   */
  watchRoom(roomId: string, seenIds: Set<string>, intervalMs = 5000): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) return;
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        try {
          const latest = await this.getMessages(roomId, 30);
          for (const m of latest) {
            if (seenIds.has(m.id)) continue;
            seenIds.add(m.id);
            this.emit('message-received', m);
          }
        } catch {
          /* Already logged; the next tick tries again. */
        }
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    timer = setTimeout(tick, intervalMs);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  /**
   * Send data to WebSocket
   */
  private send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  /**
   * Disconnect from chat
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const chatService = new ChatService();
export default chatService;
