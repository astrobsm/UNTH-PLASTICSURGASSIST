/**
 * Chat Service
 * Handles real-time messaging, file sharing, and chat persistence
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';

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

class ChatService {
  private socket: WebSocket | null = null;
  private currentUserId: string = '';
  private currentUserName: string = '';
  private currentUserRole: string = '';
  private eventListeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageQueue: ChatMessage[] = [];

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
   * Initialize chat service with user info
   */
  async initialize(userId: string, userName: string, userRole: string): Promise<void> {
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.currentUserRole = userRole;
    
    // Skip WebSocket connection on Vercel (serverless doesn't support WebSockets)
    if (this.isServerless()) {
      console.log('Chat: WebSocket disabled on serverless platform (using offline mode)');
      this.emit('connection-status', { connected: false, reason: 'serverless' });
      return;
    }
    
    await this.connect();
  }

  /**
   * Check if running on serverless platform (Vercel)
   */
  private isServerless(): boolean {
    // Vercel production URLs contain 'vercel.app' or custom domains without WebSocket support
    return import.meta.env.PROD && (
      window.location.host.includes('vercel.app') ||
      !window.location.host.includes('localhost')
    );
  }

  /**
   * Connect to WebSocket server
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = import.meta.env.PROD
        ? `wss://${window.location.host}/ws/chat`
        : `ws://localhost:3001/ws/chat`;

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
        this.connect().catch(console.error);
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
  private async saveMessageLocally(message: ChatMessage) {
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

      this.send({
        type: 'create-room',
        room,
        participantIds,
      });

      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      return null;
    }
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId: string): Promise<boolean> {
    try {
      this.send({
        type: 'join-room',
        roomId,
      });
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      return false;
    }
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
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }

    return message;
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

      this.send({
        type: 'message',
        message,
      });

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
  }

  /**
   * Get chat rooms for current user
   */
  async getRooms(): Promise<ChatRoom[]> {
    try {
      const response = await fetch('/api/chat/rooms', {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch rooms');
      return await response.json();
    } catch (error) {
      console.error('Error fetching rooms:', error);
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

      const response = await fetch(`/api/chat/rooms/${roomId}/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Search messages
   */
  async searchMessages(query: string, roomId?: string): Promise<ChatMessage[]> {
    try {
      const params = new URLSearchParams({ q: query });
      if (roomId) params.append('roomId', roomId);

      const response = await fetch(`/api/chat/messages/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to search messages');
      return await response.json();
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
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
