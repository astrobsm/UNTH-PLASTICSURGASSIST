import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  Monitor, 
  MonitorOff,
  MessageSquare, 
  Users, 
  Settings, 
  Maximize2, 
  Minimize2,
  Grid,
  LayoutGrid,
  Hand,
  MoreVertical,
  Copy,
  Share2,
  X,
  Camera,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  FileUp,
  Pencil
} from 'lucide-react';
import videoConferenceService, { Participant, ConferenceRoom } from '../services/videoConferenceService';
import chatService, { ChatMessage } from '../services/chatService';
import presentationService, { Slide, Annotation } from '../services/presentationService';
import { useAuthStore } from '../store/authStore';

type ViewMode = 'grid' | 'speaker' | 'presentation';

const VideoConference: React.FC = () => {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();

  // Conference state
  const [room, setRoom] = useState<ConferenceRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Media controls
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Presentation state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isPresenting, setIsPresenting] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<Annotation['type']>('pen');
  const [annotationColor, setAnnotationColor] = useState('#FF0000');

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const presentationCanvasRef = useRef<HTMLCanvasElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Room creation/joining
  const [showJoinDialog, setShowJoinDialog] = useState(!urlRoomId);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Initialize services
  useEffect(() => {
    const initializeConference = async () => {
      try {
        // Get available devices
        const deviceInfo = await videoConferenceService.getMediaDevices();
        setAvailableDevices([
          ...deviceInfo.videoInputs,
          ...deviceInfo.audioInputs,
          ...deviceInfo.audioOutputs
        ]);

        // Set up event listeners
        videoConferenceService.on('participant-joined', handleParticipantJoined);
        videoConferenceService.on('participant-left', handleParticipantLeft);
        videoConferenceService.on('stream-added', handleStreamAdded);
        videoConferenceService.on('message-received', handleChatMessage);

        // Initialize chat
        if (user) {
          await chatService.initialize(user.id.toString(), user.name, user.role);
          chatService.on('message-received', handleChatMessage);
        }

        // If room ID in URL, try to join
        if (urlRoomId) {
          await joinRoom(urlRoomId);
        }
      } catch (error) {
        console.error('Failed to initialize conference:', error);
      }
    };

    initializeConference();

    return () => {
      cleanup();
    };
  }, [urlRoomId, user]);

  // Handle local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle screen share stream
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isFullscreen) {
          setShowControls(false);
        }
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isFullscreen]);

  // Set up presentation canvas
  useEffect(() => {
    if (presentationCanvasRef.current && showPresentation) {
      presentationService.setCanvas(presentationCanvasRef.current);
    }
  }, [showPresentation]);

  // Event handlers
  const handleParticipantJoined = useCallback((participant: Participant) => {
    setParticipants(prev => [...prev, participant]);
  }, []);

  const handleParticipantLeft = useCallback((participantId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  }, []);

  const handleStreamAdded = useCallback((data: { participantId: string; stream: MediaStream }) => {
    setParticipants(prev => prev.map(p => 
      p.id === data.participantId ? { ...p, stream: data.stream } : p
    ));
  }, []);

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
    // Scroll to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [showChat]);

  // Room management
  const createRoom = async () => {
    if (!roomName.trim()) return;
    
    setIsCreatingRoom(true);
    try {
      const stream = await videoConferenceService.requestMediaAccess({ video: true, audio: true });
      if (stream) setLocalStream(stream);
      
      const newRoom = await videoConferenceService.createRoom(roomName, 'general', {
        maxParticipants: 50,
        allowScreenShare: true,
        allowChat: true,
        allowRecording: false,
        waitingRoomEnabled: false,
      });

      if (newRoom) {
        setRoom(newRoom);
        setShowJoinDialog(false);
        setIsConnected(true);
        navigate(`/conference/${newRoom.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = async (roomIdToJoin: string) => {
    setIsConnecting(true);
    try {
      const stream = await videoConferenceService.requestMediaAccess({ video: true, audio: true });
      if (stream) setLocalStream(stream);
      
      const participant = {
        id: user?.id.toString() || 'guest',
        name: user?.name || 'Guest',
        role: user?.role || 'guest',
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        isPresenting: false,
      };
      
      const success = await videoConferenceService.joinRoom(roomIdToJoin, participant);
      if (success) {
        setRoom({ id: roomIdToJoin } as ConferenceRoom);
        setShowJoinDialog(false);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to join room:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const leaveRoom = async () => {
    await videoConferenceService.leaveRoom();
    cleanup();
    navigate('/');
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    chatService.disconnect();
    presentationService.cleanup();
  };

  // Media controls
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await videoConferenceService.stopScreenShare();
      setScreenStream(null);
      setIsScreenSharing(false);
      if (viewMode === 'presentation') {
        setViewMode('grid');
      }
    } else {
      const stream = await videoConferenceService.startScreenShare();
      if (stream) {
        setScreenStream(stream);
        setIsScreenSharing(true);
        setViewMode('presentation');
        
        // Handle screen share stop
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
          setViewMode('grid');
        };
      }
    }
  };

  const switchCamera = async () => {
    const cameras = availableDevices.filter(d => d.kind === 'videoinput');
    const currentIndex = cameras.findIndex(c => c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    
    if (nextCamera) {
      try {
        // Get new stream with selected camera
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextCamera.deviceId } },
          audio: true
        });
        
        // Stop old tracks
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        setLocalStream(newStream);
        setSelectedCamera(nextCamera.deviceId);
      } catch (error) {
        console.error('Failed to switch camera:', error);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleHandRaise = () => {
    setIsHandRaised(!isHandRaised);
    // Hand raise functionality can be added via signaling
  };

  // Chat
  const sendMessage = () => {
    if (!newMessage.trim() || !room) return;
    
    const message = chatService.sendMessage(room.id, newMessage.trim());
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  // Presentation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    const presentation = await presentationService.createPresentation(
      'Conference Presentation',
      Array.from(files),
      user.id.toString(),
      user.name
    );

    setSlides(presentation.slides);
    setShowPresentation(true);
    setIsPresenting(true);
    presentationService.startPresentation(presentation);
  };

  const copyRoomLink = () => {
    if (room) {
      const link = `${window.location.origin}/conference/${room.id}`;
      navigator.clipboard.writeText(link);
    }
  };

  // Render video grid
  const renderParticipantVideo = (participant: Participant, isLarge: boolean = false) => (
    <div
      key={participant.id}
      className={`relative bg-gray-800 rounded-lg overflow-hidden ${
        isLarge ? 'col-span-2 row-span-2' : ''
      } ${activeSpeaker === participant.id ? 'ring-2 ring-green-500' : ''}`}
    >
      {participant.stream ? (
        <video
          autoPlay
          playsInline
          muted={participant.id === 'local'}
          ref={(el) => {
            if (el && participant.stream) {
              el.srcObject = participant.stream;
            }
          }}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {participant.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
      
      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {participant.name} {participant.id === 'local' && '(You)'}
          </span>
          <div className="flex items-center gap-1">
            {!participant.audioEnabled && (
              <MicOff className="w-4 h-4 text-red-500" />
            )}
            {!participant.videoEnabled && (
              <VideoOff className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Join/Create Room Dialog
  if (showJoinDialog) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">
            Video Conference
          </h1>

          {/* Preview */}
          <div className="relative mb-6 bg-gray-700 rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="w-12 h-12 text-gray-500" />
              </div>
            )}
          </div>

          {/* Start Camera Button */}
          {!localStream && (
            <button
              onClick={async () => {
                const stream = await videoConferenceService.requestMediaAccess({ video: true, audio: true });
                if (stream) setLocalStream(stream);
              }}
              className="w-full mb-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" />
              Start Camera
            </button>
          )}

          {/* Create Room */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-2">Create New Room</h3>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
            />
            <button
              onClick={createRoom}
              disabled={!roomName.trim() || isCreatingRoom}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isCreatingRoom ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-gray-800 text-gray-400 text-sm">or</span>
            </div>
          </div>

          {/* Join Room */}
          <div>
            <h3 className="text-white font-medium mb-2">Join Existing Room</h3>
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="Enter room ID or link"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
            />
            <button
              onClick={() => joinRoom(joinRoomId)}
              disabled={!joinRoomId.trim() || isConnecting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isConnecting ? 'Joining...' : 'Join Room'}
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full mt-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className={`flex items-center justify-between px-4 py-2 bg-gray-800/90 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <h1 className="text-white font-medium">{room?.name || 'Video Conference'}</h1>
          <span className="text-gray-400 text-sm">
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyRoomLink}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Copy room link"
          >
            <Copy className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className={`flex-1 p-4 ${showChat || showParticipants ? 'w-2/3' : 'w-full'}`}>
          {viewMode === 'presentation' && (screenStream || showPresentation) ? (
            // Presentation view
            <div className="h-full flex flex-col">
              <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden relative">
                {screenStream ? (
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : showPresentation && slides.length > 0 ? (
                  <div className="relative w-full h-full">
                    {slides[currentSlide]?.type === 'image' && (
                      <img
                        src={slides[currentSlide].content}
                        alt={slides[currentSlide].title}
                        className="w-full h-full object-contain"
                      />
                    )}
                    <canvas
                      ref={presentationCanvasRef}
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                ) : null}

                {/* Presentation controls */}
                {showPresentation && isPresenting && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-lg px-4 py-2">
                    <button
                      onClick={() => {
                        setCurrentSlide(Math.max(0, currentSlide - 1));
                        presentationService.previousSlide();
                      }}
                      disabled={currentSlide === 0}
                      className="p-2 text-white hover:bg-white/20 rounded disabled:opacity-50"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <span className="text-white text-sm px-2">
                      {currentSlide + 1} / {slides.length}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1));
                        presentationService.nextSlide();
                      }}
                      disabled={currentSlide === slides.length - 1}
                      className="p-2 text-white hover:bg-white/20 rounded disabled:opacity-50"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    
                    {/* Annotation tools */}
                    <div className="ml-4 flex items-center gap-1 border-l border-white/30 pl-4">
                      <button
                        onClick={() => setAnnotationTool('pen')}
                        className={`p-2 rounded ${annotationTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/20'}`}
                      >
                        <Pencil className="w-4 h-4 text-white" />
                      </button>
                      <input
                        type="color"
                        value={annotationColor}
                        onChange={(e) => {
                          setAnnotationColor(e.target.value);
                          presentationService.setColor(e.target.value);
                        }}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <button
                        onClick={() => presentationService.clearAnnotations()}
                        className="p-2 text-white hover:bg-white/20 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Participant strip */}
              <div className="h-24 mt-2 flex gap-2 overflow-x-auto">
                {/* Local video */}
                <div className="w-32 h-full flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  <span className="absolute bottom-1 left-1 text-white text-xs bg-black/50 px-1 rounded">
                    You
                  </span>
                </div>
                
                {participants.map(p => (
                  <div key={p.id} className="w-32 h-full flex-shrink-0">
                    {renderParticipantVideo(p)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Grid view
            <div className={`h-full grid gap-2 ${
              participants.length === 0 ? 'grid-cols-1' :
              participants.length <= 1 ? 'grid-cols-2' :
              participants.length <= 3 ? 'grid-cols-2 grid-rows-2' :
              participants.length <= 5 ? 'grid-cols-3 grid-rows-2' :
              'grid-cols-4 grid-rows-3'
            }`}>
              {/* Local video */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">You</span>
                    <div className="flex items-center gap-1">
                      {!isAudioEnabled && <MicOff className="w-4 h-4 text-red-500" />}
                      {!isVideoEnabled && <VideoOff className="w-4 h-4 text-red-500" />}
                      {isHandRaised && <Hand className="w-4 h-4 text-yellow-500" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Remote participants */}
              {participants.map(p => renderParticipantVideo(p))}
            </div>
          )}
        </div>

        {/* Side panels */}
        {(showChat || showParticipants) && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            {/* Panel tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => { setShowChat(true); setShowParticipants(false); }}
                className={`flex-1 py-3 text-sm font-medium ${showChat ? 'text-white border-b-2 border-green-500' : 'text-gray-400'}`}
              >
                Chat {unreadCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
              </button>
              <button
                onClick={() => { setShowParticipants(true); setShowChat(false); }}
                className={`flex-1 py-3 text-sm font-medium ${showParticipants ? 'text-white border-b-2 border-green-500' : 'text-gray-400'}`}
              >
                Participants ({participants.length + 1})
              </button>
            </div>

            {/* Chat panel */}
            {showChat && (
              <>
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                  onClick={() => setUnreadCount(0)}
                >
                  {messages.map((msg) => (
                    <div key={msg.id} className={`${msg.senderId === user?.id.toString() ? 'text-right' : ''}`}>
                      <div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg ${
                        msg.senderId === user?.id.toString() 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-700 text-white'
                      }`}>
                        {msg.senderId !== user?.id.toString() && (
                          <div className="text-xs text-gray-300 mb-1">{msg.senderName}</div>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        <div className="text-xs opacity-60 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                    </div>
                  )}
                </div>

                {/* Chat input */}
                <div className="p-4 border-t border-gray-700">
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* Participants panel */}
            {showParticipants && (
              <div className="flex-1 overflow-y-auto p-4">
                {/* You */}
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                    <span className="text-white font-medium">{user?.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{user?.name} (You)</div>
                    <div className="text-gray-400 text-xs">{user?.role}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isAudioEnabled && <MicOff className="w-4 h-4 text-red-500" />}
                    {!isVideoEnabled && <VideoOff className="w-4 h-4 text-red-500" />}
                  </div>
                </div>

                {/* Other participants */}
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-medium">{p.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{p.name}</div>
                      <div className="text-gray-400 text-xs">{p.role}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!p.audioEnabled && <MicOff className="w-4 h-4 text-red-500" />}
                      {!p.videoEnabled && <VideoOff className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className={`flex items-center justify-center gap-2 p-4 bg-gray-800/90 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Media controls */}
        <div className="flex items-center gap-2 bg-gray-700/50 rounded-full px-4 py-2">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-red-600 text-white hover:bg-red-700'}`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-red-600 text-white hover:bg-red-700'}`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={switchCamera}
            className="p-3 rounded-full bg-gray-600 text-white hover:bg-gray-500 transition-colors"
            title="Switch camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Screen share & presentation */}
        <div className="flex items-center gap-2 bg-gray-700/50 rounded-full px-4 py-2">
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-green-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          <label className="p-3 rounded-full bg-gray-600 text-white hover:bg-gray-500 transition-colors cursor-pointer" title="Present slides">
            <FileUp className="w-5 h-5" />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Additional controls */}
        <div className="flex items-center gap-2 bg-gray-700/50 rounded-full px-4 py-2">
          <button
            onClick={toggleHandRaise}
            className={`p-3 rounded-full transition-colors ${isHandRaised ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>

          <button
            onClick={() => { setShowChat(!showChat); setShowParticipants(false); }}
            className={`p-3 rounded-full transition-colors relative ${showChat ? 'bg-green-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && !showChat && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
            className={`p-3 rounded-full transition-colors ${showParticipants ? 'bg-green-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
            title="Participants"
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'speaker' : 'grid')}
            className="p-3 rounded-full bg-gray-600 text-white hover:bg-gray-500 transition-colors"
            title="Change layout"
          >
            {viewMode === 'grid' ? <LayoutGrid className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-full bg-gray-600 text-white hover:bg-gray-500 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Leave call */}
        <button
          onClick={leaveRoom}
          className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
          title="Leave call"
        >
          <Phone className="w-5 h-5 rotate-[135deg]" />
        </button>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Camera selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Camera</label>
                <select
                  value={selectedCamera}
                  onChange={async (e) => {
                    setSelectedCamera(e.target.value);
                    try {
                      const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: e.target.value } },
                        audio: true
                      });
                      if (localStream) {
                        localStream.getTracks().forEach(track => track.stop());
                      }
                      setLocalStream(newStream);
                    } catch (error) {
                      console.error('Failed to switch camera:', error);
                    }
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {availableDevices.filter(d => d.kind === 'videoinput').map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Microphone selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {availableDevices.filter(d => d.kind === 'audioinput').map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};

export default VideoConference;
