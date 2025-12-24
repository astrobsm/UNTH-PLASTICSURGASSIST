import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Video,
  Phone,
  MoreVertical,
  Send,
  Paperclip,
  Image,
  Smile,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  X,
  UserPlus,
  Settings,
  Trash2,
  Edit3,
  Reply,
  Forward,
  Copy
} from 'lucide-react';
import chatService, { ChatRoom, ChatMessage, ChatParticipant } from '../services/chatService';
import { useAuthStore } from '../store/authStore';
import Layout from '../components/Layout';

const ChatRooms: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();

  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ [roomId: string]: string[] }>({});
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // New room form
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'direct' | 'group'>('group');
  const [newRoomParticipants, setNewRoomParticipants] = useState<string[]>([]);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize chat service
  useEffect(() => {
    const initChat = async () => {
      if (user) {
        try {
          await chatService.initialize(user.id.toString(), user.name, user.role);
          
          // Set up event listeners
          chatService.on('message-received', handleNewMessage);
          chatService.on('typing-started', handleTypingStarted);
          chatService.on('typing-stopped', handleTypingStopped);
          chatService.on('user-online', handleUserOnline);
          chatService.on('user-offline', handleUserOffline);
          chatService.on('connection-status', handleConnectionStatus);

          // Load rooms
          await loadRooms();
        } catch (error) {
          console.error('Failed to initialize chat:', error);
        }
      }
    };

    initChat();

    return () => {
      chatService.disconnect();
    };
  }, [user]);

  // Load room from URL
  useEffect(() => {
    if (roomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        selectRoom(room);
      }
    }
  }, [roomId, rooms]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Event handlers
  const handleNewMessage = (message: ChatMessage) => {
    if (activeRoom && message.roomId === activeRoom.id) {
      setMessages(prev => [...prev, message]);
      chatService.markAsRead(activeRoom.id, [message.id]);
    }
    
    // Update room list with last message
    setRooms(prev => prev.map(room => {
      if (room.id === message.roomId) {
        return {
          ...room,
          lastMessage: message,
          unreadCount: activeRoom?.id === room.id ? 0 : room.unreadCount + 1,
          updatedAt: new Date(),
        };
      }
      return room;
    }));
  };

  const handleTypingStarted = (data: { roomId: string; userId: string; userName: string }) => {
    setTypingUsers(prev => ({
      ...prev,
      [data.roomId]: [...(prev[data.roomId] || []).filter(u => u !== data.userName), data.userName],
    }));
  };

  const handleTypingStopped = (data: { roomId: string; userId: string; userName: string }) => {
    setTypingUsers(prev => ({
      ...prev,
      [data.roomId]: (prev[data.roomId] || []).filter(u => u !== data.userName),
    }));
  };

  const handleUserOnline = (data: { userId: string }) => {
    // Update participant online status
  };

  const handleUserOffline = (data: { userId: string }) => {
    // Update participant online status
  };

  const handleConnectionStatus = (status: { connected: boolean }) => {
    setIsConnected(status.connected);
  };

  // Load rooms
  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const fetchedRooms = await chatService.getRooms();
      setRooms(fetchedRooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      // Mock data for development
      setRooms([
        {
          id: 'room-1',
          name: 'General Discussion',
          type: 'group',
          participants: [],
          unreadCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        },
        {
          id: 'room-2',
          name: 'Surgical Team',
          type: 'group',
          participants: [],
          unreadCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Select room
  const selectRoom = async (room: ChatRoom) => {
    setActiveRoom(room);
    navigate(`/chat/${room.id}`, { replace: true });
    
    // Join room
    await chatService.joinRoom(room.id);
    
    // Load messages
    const fetchedMessages = await chatService.getMessages(room.id);
    setMessages(fetchedMessages);
    
    // Mark as read
    if (fetchedMessages.length > 0) {
      chatService.markAsRead(room.id, fetchedMessages.map(m => m.id));
    }
    
    // Update unread count
    setRooms(prev => prev.map(r => 
      r.id === room.id ? { ...r, unreadCount: 0 } : r
    ));
  };

  // Send message
  const sendMessage = () => {
    if (!newMessage.trim() || !activeRoom) return;

    const message = chatService.sendMessage(
      activeRoom.id,
      newMessage.trim(),
      'text',
      replyingTo?.id
    );

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    setReplyingTo(null);
    
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;

    const message = await chatService.sendFile(activeRoom.id, file);
    if (message) {
      setMessages(prev => [...prev, message]);
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (activeRoom) {
      chatService.sendTyping(activeRoom.id, true);
      
      // Stop typing after 2 seconds of inactivity
      setTimeout(() => {
        if (activeRoom) {
          chatService.sendTyping(activeRoom.id, false);
        }
      }, 2000);
    }
  };

  // Create new room
  const createRoom = async () => {
    if (!newRoomName.trim()) return;

    const room = await chatService.createRoom(
      newRoomName,
      newRoomType,
      newRoomParticipants
    );

    if (room) {
      setRooms(prev => [room, ...prev]);
      selectRoom(room);
      setShowNewRoomDialog(false);
      setNewRoomName('');
      setNewRoomParticipants([]);
    }
  };

  // Start video call
  const startVideoCall = () => {
    if (activeRoom) {
      navigate(`/conference/${activeRoom.id}`);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Format time
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date for grouping
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages: { [date: string]: ChatMessage[] } = messages.reduce((groups: { [date: string]: ChatMessage[] }, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});

  // Filter rooms by search
  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Common emojis
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '🎉'];

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] flex bg-white dark:bg-gray-900">
        {/* Rooms sidebar */}
        <div className={`w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h1>
              <button
                onClick={() => setShowNewRoomDialog(true)}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Room list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <button
                  onClick={() => setShowNewRoomDialog(true)}
                  className="mt-4 text-green-600 hover:text-green-700 font-medium"
                >
                  Start a conversation
                </button>
              </div>
            ) : (
              filteredRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => selectRoom(room)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    activeRoom?.id === room.id ? 'bg-green-50 dark:bg-green-900/30' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      room.type === 'group' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-green-100 dark:bg-green-900'
                    }`}>
                      {room.type === 'group' ? (
                        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <span className="text-lg font-medium text-green-600 dark:text-green-400">
                          {room.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Online indicator */}
                    {room.type === 'direct' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {room.name}
                      </h3>
                      {room.lastMessage && (
                        <span className="text-xs text-gray-500">
                          {formatTime(room.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-500 truncate">
                        {typingUsers[room.id]?.length > 0 ? (
                          <span className="text-green-600 italic">
                            {typingUsers[room.id].join(', ')} typing...
                          </span>
                        ) : room.lastMessage ? (
                          room.lastMessage.content
                        ) : (
                          'No messages yet'
                        )}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="ml-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        {activeRoom ? (
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setActiveRoom(null); navigate('/chat'); }}
                  className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activeRoom.type === 'group' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-green-100 dark:bg-green-900'
                }`}>
                  {activeRoom.type === 'group' ? (
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {activeRoom.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="font-medium text-gray-900 dark:text-white">{activeRoom.name}</h2>
                  <p className="text-sm text-gray-500">
                    {typingUsers[activeRoom.id]?.length > 0 
                      ? `${typingUsers[activeRoom.id].join(', ')} typing...`
                      : `${activeRoom.participants.length} participants`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={startVideoCall}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Video call"
                >
                  <Video className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setShowRoomInfo(!showRoomInfo)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-500">
                      {date}
                    </div>
                  </div>

                  {/* Messages for this date */}
                  {msgs.map((message, index) => {
                    const isOwn = message.senderId === user?.id.toString();
                    const showAvatar = index === 0 || msgs[index - 1]?.senderId !== message.senderId;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                          !showAvatar ? 'mt-1' : 'mt-4'
                        }`}
                      >
                        {!isOwn && showAvatar && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-2 flex-shrink-0">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {message.senderName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        
                        <div className={`max-w-[70%] ${!isOwn && !showAvatar ? 'ml-10' : ''}`}>
                          {!isOwn && showAvatar && (
                            <div className="text-xs text-gray-500 mb-1">{message.senderName}</div>
                          )}
                          
                          {/* Reply indicator */}
                          {message.replyTo && (
                            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-t-lg border-l-2 border-green-500 text-sm text-gray-500 mb-1">
                              <Reply className="w-3 h-3 inline mr-1" />
                              Replying to a message
                            </div>
                          )}

                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isOwn
                                ? 'bg-green-600 text-white rounded-tr-none'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-none'
                            } ${message.type === 'image' ? 'p-1' : ''}`}
                          >
                            {message.type === 'image' ? (
                              <img
                                src={message.content}
                                alt="Shared image"
                                className="max-w-full rounded-lg cursor-pointer"
                                onClick={() => window.open(message.content, '_blank')}
                              />
                            ) : message.type === 'file' ? (
                              <a
                                href={message.content}
                                download={message.fileName}
                                className="flex items-center gap-2 hover:underline"
                              >
                                <Paperclip className="w-4 h-4" />
                                <span>{message.fileName}</span>
                                <span className="text-xs opacity-70">
                                  ({Math.round((message.fileSize || 0) / 1024)}KB)
                                </span>
                              </a>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            )}
                          </div>

                          {/* Reactions */}
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {Object.entries(message.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => chatService.addReaction(activeRoom.id, message.id, emoji)}
                                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className={`flex items-center gap-2 mt-1 text-xs ${isOwn ? 'justify-end' : ''}`}>
                            <span className="text-gray-400">{formatTime(message.timestamp)}</span>
                            {isOwn && (
                              message.isRead ? (
                                <CheckCheck className="w-4 h-4 text-blue-500" />
                              ) : (
                                <Check className="w-4 h-4 text-gray-400" />
                              )
                            )}
                            {message.isEdited && (
                              <span className="text-gray-400 italic">edited</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Reply className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Replying to {replyingTo.senderName}
                  </span>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Message input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex-1 relative">
                  <textarea
                    ref={messageInputRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>

                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {/* Quick emoji picker */}
              {showEmojiPicker && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex gap-1">
                  {commonEmojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setNewMessage(prev => prev + emoji);
                        setShowEmojiPicker(false);
                        messageInputRef.current?.focus();
                      }}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No room selected */
          <div className="flex-1 hidden md:flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h2 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
                Select a conversation
              </h2>
              <p className="text-gray-500 dark:text-gray-500 mb-4">
                Choose from your existing conversations or start a new one
              </p>
              <button
                onClick={() => setShowNewRoomDialog(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                New Conversation
              </button>
            </div>
          </div>
        )}

        {/* New Room Dialog */}
        {showNewRoomDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Conversation</h2>
                <button
                  onClick={() => setShowNewRoomDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Conversation Name
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Enter name..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setNewRoomType('direct')}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                        newRoomType === 'direct'
                          ? 'border-green-600 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <MessageSquare className="w-6 h-6 mx-auto mb-1 text-green-600" />
                      <span className="text-sm text-gray-900 dark:text-white">Direct</span>
                    </button>
                    <button
                      onClick={() => setNewRoomType('group')}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                        newRoomType === 'group'
                          ? 'border-green-600 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <Users className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                      <span className="text-sm text-gray-900 dark:text-white">Group</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewRoomDialog(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ChatRooms;
