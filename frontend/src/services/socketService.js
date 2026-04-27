import { io } from 'socket.io-client';
import useInterviewStore from '../store/interviewStore';
import useAuthStore from '../store/authStore';
import { toast } from 'react-hot-toast';

const SOCKET_URL = 'http://localhost:5001';
let socket;
let heartbeatInterval;

const getDeviceId = () => {
  let id = localStorage.getItem('ai_interview_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ai_interview_device_id', id);
  }
  return id;
};

export const initSocket = (sessionId) => {
  if (socket) {
    console.log('[Socket] Disconnecting existing socket');
    socket.disconnect();
  }
  
  console.log('[Socket] Initializing socket, sessionId:', sessionId);
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,        // Increased from 5
    reconnectionDelay: 2000,         // Increased from 1000ms
    reconnectionDelayMax: 10000,     // Max delay between reconnection attempts
    timeout: 30000,                  // Connection timeout (30 seconds)
    forceNew: false,                 // Reuse existing connection if possible
    // Match backend ping settings
    pingTimeout: 120000,             // 2 minutes to match backend
    pingInterval: 60000              // 1 minute to match backend
  });
  const deviceId = getDeviceId();
  const userId = useAuthStore.getState().user?.id;

  socket.on('connect', () => {
    console.log('[Socket] ✅ Transport Active:', socket.id, 'Session:', sessionId);
    window.dispatchEvent(new CustomEvent('socket-connected', { detail: { socketId: socket.id } }));
    
    if (sessionId) {
      // 1. Join specialized session room
      console.log('[Socket] Joining session:', sessionId);
      socket.emit('join_session', { sessionId, userId, deviceId });
    }
  });
  
  // Listen for session_joined confirmation
  socket.on('session_joined', (data) => {
    console.log('[Socket] ✅ Successfully joined session:', data.sessionId);
    
    const userId = useAuthStore.getState().user?.id;
    const deviceId = getDeviceId();
    
    // 2. Start Heartbeat Loop (TTL compliance) AFTER joining
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('heartbeat', { sessionId: data.sessionId, userId, deviceId });
        console.log('[Socket] Heartbeat sent for session:', data.sessionId);
      } else {
        console.warn('[Socket] Skipping heartbeat - socket not connected');
      }
    }, 45000); // 45s heartbeat (shorter than ping interval for safety)
    
    // Dispatch event to notify components that session is ready
    window.dispatchEvent(new CustomEvent('socket-session-ready', { detail: { sessionId: data.sessionId } }));
  });
  
  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    toast.error('Connection issue - trying to reconnect...', { duration: 3000 });
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    toast.success('Connection restored!', { duration: 2000 });
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[Socket] Reconnection attempt', attemptNumber);
  });
  
  socket.on('reconnect_error', (err) => {
    console.error('[Socket] Reconnection error:', err.message);
  });
  
  socket.on('reconnect_failed', () => {
    console.error('[Socket] Reconnection failed - all attempts exhausted');
    toast.error('Connection lost. Please refresh the page.', { duration: 0 });
  });
  
  socket.on('ping', () => {
    console.log('[Socket] Ping received from server');
  });
  
  socket.on('pong', (latency) => {
    console.log('[Socket] Pong received, latency:', latency, 'ms');
  });
  
  socket.on('error', (err) => {
    console.error('[Socket] Socket error:', err);
    if (err.message && err.message.includes('ping timeout')) {
      toast.error('Connection timeout - reconnecting...', { duration: 3000 });
    }
  });

  // 3. HARDENED EVENT ROUTING
  
  // Real-time ephemeral buffer (low latency)
  socket.on('live_transcript_chunk', (data) => {
    if (data.text) {
      useInterviewStore.getState().updateLiveBuffer(data.text);
    }
  });

  // Handle completed transcript (when user stops speaking)
  socket.on('transcript_complete', (data) => {
    console.log('[Socket] Transcript complete:', data);
    if (data.text && data.text.trim()) {
      // Auto-submit the completed transcript as an answer
      const store = useInterviewStore.getState();
      if (store.currentQuestion) {
        console.log('[Socket] Auto-submitting transcript as answer');
        store.submitAnswer(data.text.trim()).then((nextQuestion) => {
          if (nextQuestion) {
            // Trigger AI answer for next question
            socket.emit('direct-question', { 
              question: nextQuestion, 
              sessionId: store.sessionId || 'dashboard-session',
              userId: useAuthStore.getState().user?.id || 'dashboard-user'
            });
          }
        }).catch(err => {
          console.error('[Socket] Auto-submit failed:', err);
        });
      }
    }
  });

  // Finalized Immutable Events (Source of Truth)
  socket.on('interview_event', (event) => {
    useInterviewStore.getState().applySocketEvent(event);
  });

  socket.on('user_joined', (data) => {
    toast(`Someone joined the interview`, { icon: '👋' });
  });

  socket.on('error', (data) => {
    toast.error(data.message || 'Websocket error occurred');
  });

  socket.on('disconnect', () => {
    console.warn('[Socket] Transport Disconnected');
    window.dispatchEvent(new CustomEvent('socket-disconnected'));
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) socket.disconnect();
  if (heartbeatInterval) clearInterval(heartbeatInterval);
};

export const getSocket = () => socket;

export const isSocketConnected = () => {
  return socket && socket.connected;
};

export const getConnectionStatus = () => {
  if (!socket) return 'not_initialized';
  if (socket.connected) return 'connected';
  if (socket.disconnected) return 'disconnected';
  return 'connecting';
};

// Function to manually trigger reconnection if needed
export const forceReconnect = () => {
  if (socket) {
    console.log('[Socket] Forcing reconnection...');
    socket.disconnect();
    socket.connect();
  }
};
