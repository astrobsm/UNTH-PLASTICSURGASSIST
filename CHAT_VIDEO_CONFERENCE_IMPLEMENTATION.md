# Chat and Video Conference Implementation

## Overview

This document describes the chat and video conference functionality added to the Plastic Surgeon Assistant application. These features enable real-time communication between medical staff for consultations, case discussions, and team collaboration.

## Features

### Video Conference
- **WebRTC-based peer-to-peer video calls**
- **Screen sharing** for presenting medical images, reports, or slides
- **Slide presentation mode** with annotation tools
- **Multi-participant support** up to 50 participants
- **Camera/microphone controls** with device switching
- **Fullscreen mode** for focused viewing
- **Chat integration** within video calls
- **Hand raise** functionality for orderly discussions

### Chat Messaging
- **Real-time messaging** using WebSockets
- **Group and direct conversations**
- **File and image sharing**
- **Typing indicators**
- **Read receipts**
- **Emoji reactions**
- **Message search**
- **Offline message queue**

## Architecture

### Frontend Services

#### videoConferenceService.ts
Handles WebRTC peer connections, media streams, and signaling:
- `getMediaDevices()` - Enumerate available cameras and microphones
- `requestMediaAccess()` - Request camera/mic permissions
- `startScreenShare()` - Start screen sharing
- `stopScreenShare()` - Stop screen sharing
- `createRoom()` - Create a new conference room
- `joinRoom()` - Join an existing conference
- `leaveRoom()` - Leave the current conference

#### chatService.ts
Handles real-time chat functionality:
- `initialize()` - Connect to WebSocket server
- `createRoom()` - Create a new chat room
- `joinRoom()` - Join a chat room
- `sendMessage()` - Send a text message
- `sendFile()` - Send a file/image
- `sendTyping()` - Send typing indicator
- `markAsRead()` - Mark messages as read
- `addReaction()` - Add emoji reaction

#### presentationService.ts
Handles slide presentations with interactive features:
- `createPresentation()` - Create from uploaded images
- `startPresentation()` - Begin presenting
- `nextSlide()` / `previousSlide()` - Navigate slides
- `setTool()` - Select annotation tool (pen, highlighter, pointer)
- `setColor()` - Set annotation color
- `clearAnnotations()` - Clear slide annotations
- `addQuestion()` - Add audience question

### Frontend Components

#### VideoConference.tsx (`/conference` and `/conference/:roomId`)
Full-screen video conference interface with:
- Video grid layout (automatic adjustment based on participants)
- Presentation view for screen shares
- Integrated chat panel
- Participants panel
- Settings modal for device selection
- Control bar with all media/sharing controls

#### ChatRooms.tsx (`/chat` and `/chat/:roomId`)
Full messaging interface with:
- Room list sidebar with search
- Message thread with date grouping
- Real-time typing indicators
- File upload support
- Emoji picker
- New room creation dialog

### Backend WebSocket Endpoints

#### `/ws/conference` - Video Conference Signaling
Handles WebRTC signaling for peer-to-peer connections:
- `create-room` - Create a new conference room
- `join-room` - Join an existing room
- `leave-room` - Leave a room
- `offer` / `answer` / `ice-candidate` - WebRTC signaling
- `raise-hand` / `lower-hand` - Hand raise functionality
- `screen-share-started` / `screen-share-stopped` - Screen share notifications

#### `/ws/chat` - Chat Messaging
Handles real-time chat operations:
- `auth` - Authenticate WebSocket connection
- `create-room` - Create a new chat room
- `join-room` - Join a chat room
- `leave-room` - Leave a chat room
- `message` - Send/receive messages
- `typing` - Typing indicators
- `read-receipt` - Read receipts
- `reaction` - Emoji reactions

## Usage

### Starting a Video Conference

1. Navigate to **Video Conference** from the sidebar
2. Click **Start Camera** to enable your camera/microphone
3. Enter a room name and click **Create Room**
4. Share the room link with participants
5. Use the control bar to:
   - Toggle camera/microphone
   - Share your screen
   - Upload presentation slides
   - Open chat panel
   - View participants
   - Raise your hand

### Joining a Video Conference

1. Click a shared conference link or enter the room ID
2. Allow camera/microphone permissions
3. Click **Join Room**

### Using Chat

1. Navigate to **Chat** from the sidebar
2. Select an existing conversation or click **+** to create a new one
3. Type messages in the input field and press Enter to send
4. Click the paperclip icon to attach files
5. Click the emoji icon for quick reactions

## ICE Servers (STUN/TURN)

Currently using Google's public STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`
- `stun:stun3.l.google.com:19302`
- `stun:stun4.l.google.com:19302`

**Note:** For production deployment with users behind strict NATs/firewalls, consider adding TURN servers for reliable connectivity.

## Dependencies

### Frontend
- WebRTC (native browser API)
- WebSocket (native browser API)
- MediaDevices API (camera/microphone access)
- Screen Capture API (screen sharing)

### Backend
- `ws` package - WebSocket server implementation

## Security Considerations

1. **Authentication**: All WebSocket connections require JWT token verification
2. **Room Access**: Users can only join rooms they're authorized for
3. **Media Permissions**: Browser prompts for camera/microphone access
4. **Encryption**: WebRTC uses DTLS/SRTP for encrypted media streams
5. **Signaling**: All signaling goes through authenticated WebSocket

## Future Enhancements

- [ ] Recording functionality
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Waiting room/lobby
- [ ] Calendar integration for scheduled meetings
- [ ] Meeting transcription
- [ ] AI-powered meeting summaries
- [ ] Integration with patient records for case discussions
