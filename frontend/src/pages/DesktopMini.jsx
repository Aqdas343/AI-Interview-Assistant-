import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Mic, MicOff, Bot, MessageCircle, Loader2, Send, Minimize2, Maximize2, Monitor, User, Trash2, Sparkles, BookOpen, BarChart3, Palette, ChevronDown, Lightbulb, Zap, Shield, Smile, Brain } from 'lucide-react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

// Session ID will be set based on user
let SESSION_ID = 'desktop-mini-session';
const BACKEND_URL  = 'http://localhost:5001';  // Fixed: Changed from 5000 to 5001
const DEEPGRAM_KEY = '336c908f693945015fbacf5b2f14ceb42bf76520';
const CHUNK_MS     = 5000;
const MODE_CHAT      = 'chat';
const MODE_INTERVIEW = 'interview';

// AI Personality definitions
const AI_PERSONALITIES = {
  professional: { name: 'Professional', icon: Zap, desc: 'Formal, concise, business-focused', color: 'indigo' },
  friendly: { name: 'Friendly', icon: Smile, desc: 'Warm, conversational, encouraging', color: 'emerald' },
  technical: { name: 'Technical', icon: Shield, desc: 'Deep technical details, precise', color: 'purple' },
  mentor: { name: 'Mentor', icon: Lightbulb, desc: 'Educational, explains reasoning', color: 'amber' },
};

// Question Bank
const QUESTION_BANK = {
  behavioral: [
    'Tell me about yourself',
    'What are your greatest strengths?',
    'What is your biggest weakness?',
    'Describe a challenging situation you faced',
    'Why do you want to work here?',
    'Where do you see yourself in 5 years?',
    'Tell me about a time you failed',
    'Describe your leadership experience',
  ],
  technical: [
    'Explain the difference between REST and GraphQL',
    'What is your approach to debugging?',
    'Describe your experience with version control',
    'How would you design a scalable system?',
    'What are the pros and cons of microservices?',
    'Explain database normalization',
    'How do you handle API security?',
    'Describe your testing strategy',
  ],
  situational: [
    'How would you handle a difficult teammate?',
    'What would you do if a deadline is unrealistic?',
    'How do you prioritize tasks?',
    'Describe your problem-solving process',
    'How do you stay updated with technology?',
  ],
};

// UI Themes
const UI_THEMES = {
  dark: { name: 'Dark', bg: 'slate-900', accent: 'indigo', text: 'white' },
  ocean: { name: 'Ocean', bg: 'blue-950', accent: 'cyan', text: 'white' },
  forest: { name: 'Forest', bg: 'green-950', accent: 'emerald', text: 'white' },
  sunset: { name: 'Sunset', bg: 'rose-950', accent: 'orange', text: 'white' },
  midnight: { name: 'Midnight', bg: 'violet-950', accent: 'purple', text: 'white' },
};

const ipc = (() => { try { return window.require?.('electron')?.ipcRenderer ?? null; } catch { return null; } })();
const sendIpc   = (ch, d) => { try { ipc?.send(ch, d); } catch (_) {} };
const invokeIpc = (ch, d) => { try { return ipc?.invoke(ch, d) ?? Promise.resolve(null); } catch { return Promise.resolve(null); } };

export default function DesktopMini() {
  const { user } = useAuthStore();

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  }, []);

  const [minimized,   setMinimized]   = useState(false);
  const [mode,        setMode]        = useState(MODE_CHAT);
  const [isActive,    setIsActive]    = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [chatHistory, setChatHistory]   = useState([]);   // Chat mode history
  const [interviewHistory, setInterviewHistory] = useState([]); // Interview mode history
  const [status,      setStatus]      = useState('Ready');
  const [error,       setError]       = useState('');
  const [textInput,   setTextInput]   = useState('');
  const [connected,   setConnected]   = useState(false);
  const [sources,     setSources]     = useState([]);
  const [showPicker,  setShowPicker]  = useState(false);
  
  // New feature states
  const [personality, setPersonality] = useState('professional');
  const [explanationMode, setExplanationMode] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [showSettings, setShowSettings] = useState(false);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [questionCategory, setQuestionCategory] = useState('behavioral');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [customMemory, setCustomMemory] = useState([]);
  const [editingMemory, setEditingMemory] = useState(null);
  const [newMemoryQ, setNewMemoryQ] = useState('');
  const [newMemoryA, setNewMemoryA] = useState('');
  
  // Session memory - stores extracted keywords (not full chat)
  const [sessionMemory, setSessionMemory] = useState([]);
  
  // Custom memory is now saved in the user-specific useEffect above
  
  // Session memory is now saved in the user-specific useEffect above

  // Analytics stats
  const [stats] = useState({
    totalQuestions: 0,
    totalAnswers: 0,
    avgAnswerLength: 0,
    sessionsToday: 1,
  });

  // Get current theme colors
  const currentTheme = UI_THEMES[theme];
  const accentColor = currentTheme.accent;

  const socketRef   = useRef(null);
  const recorderRef = useRef(null);
  const streamRef   = useRef(null);
  const chunksRef   = useRef([]);
  const intervalRef = useRef(null);
  const mimeRef     = useRef('audio/webm');
  const aiBufRef    = useRef('');
  const curQRef     = useRef('');
  const isActiveRef = useRef(false);
  const modeRef     = useRef(MODE_CHAT);
  const bottomRef   = useRef(null);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { sendIpc('resize-window', { width: 420, height: 600 }); }, []);

  // auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mode === MODE_CHAT ? chatHistory : interviewHistory]);

  // Update session ID when user changes, load user-specific data
  useEffect(() => {
    if (user?.id) {
      // Set user-specific session ID
      SESSION_ID = `desktop-mini-${user.id}`;
      
      // Load user-specific data from localStorage
      const userPrefix = `user-${user.id}`;
      const savedChat = localStorage.getItem(`${userPrefix}-chatHistory`);
      const savedInterview = localStorage.getItem(`${userPrefix}-interviewHistory`);
      const savedMemory = localStorage.getItem(`${userPrefix}-sessionMemory`);
      const savedCustomMemory = localStorage.getItem(`${userPrefix}-ai-memory`);
      
      if (savedChat) setChatHistory(JSON.parse(savedChat));
      if (savedInterview) setInterviewHistory(JSON.parse(savedInterview));
      if (savedMemory) setSessionMemory(JSON.parse(savedMemory));
      if (savedCustomMemory) setCustomMemory(JSON.parse(savedCustomMemory));
    }
  }, [user]);

  // Save user-specific data to localStorage
  useEffect(() => {
    if (user?.id) {
      const userPrefix = `user-${user.id}`;
      localStorage.setItem(`${userPrefix}-chatHistory`, JSON.stringify(chatHistory));
      localStorage.setItem(`${userPrefix}-interviewHistory`, JSON.stringify(interviewHistory));
      localStorage.setItem(`${userPrefix}-sessionMemory`, JSON.stringify(sessionMemory));
      localStorage.setItem(`${userPrefix}-ai-memory`, JSON.stringify(customMemory));
    }
  }, [user, chatHistory, interviewHistory, sessionMemory, customMemory]);

  // Get current history based on mode
  const currentHistory = mode === MODE_CHAT ? chatHistory : interviewHistory;
  const setCurrentHistory = mode === MODE_CHAT ? setChatHistory : setInterviewHistory;

  // ── Socket ────────────────────────────────────────────────────
  useEffect(() => {
    let socket = null;
    let healthCheckInterval = null;
    
    // Test backend connectivity first
    const testConnection = async () => {
      try {
        console.log('[DesktopMini] Testing backend connectivity...');
        const response = await fetch(`${BACKEND_URL}/api/v1/health`);
        if (response.ok) {
          console.log('[DesktopMini] ✅ Backend health check passed');
          setStatus('Backend Online');
          return true;
        } else {
          console.log('[DesktopMini] ⚠️ Backend health check failed:', response.status);
          setStatus('Backend Error');
          setError(`Backend returned ${response.status}`);
          return false;
        }
      } catch (err) {
        console.log('[DesktopMini] ❌ Backend health check error:', err.message);
        setStatus('Backend Offline');
        setError(`Cannot reach backend: ${err.message}`);
        return false;
      }
    };
    
    const initializeSocket = async () => {
      const isBackendOnline = await testConnection();
      if (!isBackendOnline) {
        // Retry health check every 5 seconds
        healthCheckInterval = setInterval(async () => {
          const online = await testConnection();
          if (online && !socket?.connected) {
            clearInterval(healthCheckInterval);
            initializeSocket();
          }
        }, 5000);
        return;
      }

      console.log('[DesktopMini] Initializing socket connection to:', BACKEND_URL);
      console.log('[DesktopMini] Socket.io version:', io.version);
      
      socket = io(BACKEND_URL, { 
        transports: ['websocket', 'polling'], 
        reconnection: true, 
        reconnectionDelay: 1000, 
        reconnectionAttempts: 10,
        timeout: 20000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false,
        autoConnect: true
      });
      socketRef.current = socket;

      // Log all socket events for debugging
      socket.onAny((eventName, ...args) => {
        console.log('[DesktopMini] 📥 Socket Event:', eventName, args);
      });

      socket.on('connect', () => {
        console.log('[DesktopMini] ✅ Connected to backend, Socket ID:', socket.id);
        console.log('[DesktopMini] Transport:', socket.io.engine.transport.name);
        console.log('[DesktopMini] Socket connected:', socket.connected);
        setConnected(true); 
        setError(''); 
        setStatus('Connected');
        
        // Join session immediately after connection
        console.log('[DesktopMini] Joining session:', SESSION_ID);
        socket.emit('join_session', { sessionId: SESSION_ID, userId: user?.id || 'desktop-user' });
      });
      
      socket.on('disconnect', (reason) => { 
        console.log('[DesktopMini] ❌ Disconnected, reason:', reason); 
        setConnected(false); 
        setStatus('Disconnected');
        setError(`Disconnected: ${reason}`);
      });
      
      socket.on('connect_error', (e) => { 
        console.log('[DesktopMini] ❌ Connect error:', e); 
        console.log('[DesktopMini] Error message:', e.message);
        console.log('[DesktopMini] Error type:', e.type);
        console.log('[DesktopMini] Error description:', e.description);
        setConnected(false); 
        setError(`Connection failed: ${e.message}`);
        setStatus('Connection Error');
        
        // Try to provide more specific error information
        if (e.message.includes('ECONNREFUSED')) {
          setError('Backend server is not running');
          setStatus('Server Offline');
        } else if (e.message.includes('CORS')) {
          setError('CORS policy error');
          setStatus('CORS Error');
        }
      });

      socket.on('session_joined', (data) => {
        console.log('[DesktopMini] ✅ Session joined:', data);
        setStatus('Session Active');
      });

      socket.on('answer_start', (d) => {
        console.log('[DesktopMini] 📥 answer_start received:', d);
        aiBufRef.current = '';
        const q = d?.question || curQRef.current;
        if (!q) {
          console.log('[DesktopMini] ⚠️ No question in answer_start!');
          return;
        }
        // Use current mode at the time of event
        const currentMode = modeRef.current;
        const setHistory = currentMode === MODE_CHAT ? setChatHistory : setInterviewHistory;
        setHistory(prev => [...prev, { id: Date.now(), q, a: '', pending: true }]);
        setIsThinking(true);
        setStatus('Answering...');
      });

      socket.on('answer_chunk', (d) => {
        if (!d?.chunk) return;
        console.log('[DesktopMini] 📥 answer_chunk:', d.chunk?.slice(0, 50));
        aiBufRef.current += d.chunk || '';
        const buf = aiBufRef.current;
        // Use current mode at the time of event
        const currentMode = modeRef.current;
        const setHistory = currentMode === MODE_CHAT ? setChatHistory : setInterviewHistory;
        setHistory(prev => {
          if (!prev.length) return prev;
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], a: buf };
          return copy;
        });
      });

      socket.on('answer_end', (d) => {
        console.log('[DesktopMini] 📥 answer_end received, answer:', d?.answer?.slice(0, 50));
        const final = d?.answer || aiBufRef.current;
        const question = d?.question || curQRef.current;
        
        // Use current mode at the time of event
        const currentMode = modeRef.current;
        const setHistory = currentMode === MODE_CHAT ? setChatHistory : setInterviewHistory;
        setHistory(prev => {
          if (!prev.length) return prev;
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], a: final, pending: false };
          return copy;
        });
        
        // Extract and save important keywords to session memory
        if (question) {
          const keywords = extractKeywordsFromText(question);
          if (keywords.length > 0) {
            setSessionMemory(prev => {
              const newMem = [...prev];
              for (const kw of keywords) {
                if (!newMem.find(k => k.type === kw.type && k.value.toLowerCase() === kw.value.toLowerCase())) {
                  newMem.push(kw);
                }
              }
              // Keep max 20 keywords
              if (newMem.length > 20) return newMem.slice(-20);
              return newMem;
            });
          }
        }
        
        setIsThinking(false);
        setStatus(isActiveRef.current ? 'Listening...' : 'Ready');
      });

      socket.on('answer_error', (d) => {
        console.log('[DesktopMini] 📥 answer_error:', d);
        const currentMode = modeRef.current;
        const setHistory = currentMode === MODE_CHAT ? setChatHistory : setInterviewHistory;
        setHistory(prev => {
          if (!prev.length) return prev;
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], a: '⚠ ' + (d?.message || 'AI error'), pending: false };
          return copy;
        });
        setIsThinking(false);
        setStatus('Error');
      });
    };

    initializeSocket();

    return () => { 
      console.log('[DesktopMini] Cleaning up socket and intervals'); 
      if (healthCheckInterval) clearInterval(healthCheckInterval);
      if (socket) {
        socket.disconnect(); 
        socket.removeAllListeners();
      }
    };
  }, [user]);

  // Helper to extract keywords (same as backend)
  const extractKeywordsFromText = (text) => {
    if (!text || text.length < 5) return [];
    const lower = text.toLowerCase();
    const keywords = [];
    
    const patterns = [
      { regex: /my name is (\w+)/i, type: 'name', extract: 1 },
      { regex: /i am (\w+)/i, type: 'name', extract: 1 },
      { regex: /i'm (\w+)/i, type: 'name', extract: 1 },
      { regex: /i work(?:ing)? at (\w+)/i, type: 'company', extract: 1 },
      { regex: /i work(?:ing)? for (\w+)/i, type: 'company', extract: 1 },
      { regex: /my company is (\w+)/i, type: 'company', extract: 1 },
      { regex: /i am a (?:senior |junior |lead )?(\w+(?:\s+\w+)?)/i, type: 'role', extract: 1 },
      { regex: /i work as a (?:senior |junior |lead )?(\w+(?:\s+\w+)?)/i, type: 'role', extract: 1 },
      { regex: /my role is (\w+(?:\s+\w+)?)/i, type: 'role', extract: 1 },
      { regex: /(\d+)\+? years? (?:of )?experience/i, type: 'experience', extract: 0 },
      { regex: /(\d+) years? (?:of )?exp/i, type: 'experience', extract: 0 },
      { regex: /i know (\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
      { regex: /my skills? (?:are |include )?(\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
      { regex: /i specialize in (\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
      { regex: /i work with (\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
      { regex: /my project (?:is |called )?["']?(\w+(?:\s+\w+)?)["']?/i, type: 'project', extract: 1 },
      { regex: /i built (\w+(?:\s+\w+)?)/i, type: 'project', extract: 1 },
      { regex: /i studied (\w+(?:\s+\w+)?)/i, type: 'education', extract: 1 },
      { regex: /i have a (?:degree |bachelor |master )?in (\w+(?:\s+\w+)?)/i, type: 'education', extract: 1 },
      { regex: /using (\w+(?:\s+\w+)?)/i, type: 'tech', extract: 1 },
      { regex: /tech stack[:\s]+(\w+(?:,?\s*\w+)+)/i, type: 'tech', extract: 1 },
    ];
    
    for (const p of patterns) {
      const match = text.match(p.regex);
      if (match) {
        keywords.push({ type: p.type, value: match[p.extract] });
      }
    }
    
    const techKeywords = ['javascript', 'python', 'java', 'react', 'node', 'angular', 'vue', 'sql', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes', 'git', 'typescript', 'golang', 'rust', 'php', 'ruby', 'c++', 'c#', 'html', 'css', 'rest', 'graphql', 'microservices', 'linux'];
    for (const tech of techKeywords) {
      if (lower.includes(tech) && !keywords.find(k => k.value.toLowerCase() === tech)) {
        keywords.push({ type: 'tech', value: tech });
      }
    }
    
    return keywords;
  };

  const sendQuestion = useCallback((q) => {
    if (!q?.trim()) {
      console.log('[DesktopMini] ❌ Empty question, skipping');
      return;
    }
    
    if (!socketRef.current) {
      console.log('[DesktopMini] ❌ No socket reference');
      setError('Socket not initialized');
      return;
    }
    
    if (!socketRef.current.connected) {
      console.log('[DesktopMini] ❌ Socket not connected');
      setError('Not connected to server');
      return;
    }
    
    const question = q.trim();
    curQRef.current = question;
    setError('');
    
    console.log('[DesktopMini] 📤 Sending question:', question);
    console.log('[DesktopMini] 📤 Socket connected:', socketRef.current.connected);
    console.log('[DesktopMini] 📤 Socket ID:', socketRef.current.id);
    console.log('[DesktopMini] 📤 Session ID:', SESSION_ID);
    
    const payload = { 
      question: question, 
      sessionId: SESSION_ID, 
      userId: user?.id || 'desktop-user',
      personality,
      explanationMode,
      customMemory,
      sessionMemory,
    };
    
    console.log('[DesktopMini] 📤 Payload:', payload);
    
    try {
      socketRef.current.emit('direct-question', payload);
      console.log('[DesktopMini] ✅ Question sent successfully');
      setStatus('Processing...');
    } catch (error) {
      console.log('[DesktopMini] ❌ Error sending question:', error);
      setError(`Failed to send question: ${error.message}`);
    }
  }, [user, personality, explanationMode, customMemory, sessionMemory]);

  const transcribeBlob = useCallback(async (blob, isInterview) => {
    if (blob.size < 1500) return;
    try {
      const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true', {
        method: 'POST',
        headers: { Authorization: `Token ${DEEPGRAM_KEY}`, 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      if (!res.ok) return;
      const data = await res.json();
      const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
      if (!text || text.length < 3) return;
      console.log(`[DG][${isInterview ? 'interview' : 'chat'}]`, text);
      setTranscript(text);
      sendQuestion(text);
      setTimeout(() => setTranscript(''), 8000);
    } catch (e) { console.error('[DG]', e.message); }
  }, [sendQuestion]);

  const buildRecorder = useCallback((stream, isInterview) => {
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    mimeRef.current = mime || 'audio/webm';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    recorderRef.current = rec; chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start(500);
    intervalRef.current = setInterval(async () => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
      recorderRef.current.stop();
      await new Promise(r => setTimeout(r, 80));
      const chunks = [...chunksRef.current]; chunksRef.current = [];
      if (chunks.length) transcribeBlob(new Blob(chunks, { type: mimeRef.current }), isInterview);
      if (isActiveRef.current && streamRef.current) {
        try {
          const nr = new MediaRecorder(streamRef.current, mimeRef.current ? { mimeType: mimeRef.current } : {});
          recorderRef.current = nr;
          nr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
          nr.start(500);
        } catch (_) {}
      }
    }, CHUNK_MS);
  }, [transcribeBlob]);

  const startChat = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      buildRecorder(stream, false);
      setIsListening(true); setStatus('Listening...'); setError('');
    } catch (e) { setError(e.name === 'NotAllowedError' ? 'Mic denied' : e.message); setIsListening(false); }
  }, [buildRecorder]);

  const startInterviewWithSource = useCallback(async (sourceId) => {
    setShowPicker(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxWidth: 1, maxHeight: 1, maxFrameRate: 1 } },
      });
      stream.getVideoTracks().forEach(t => t.stop());
      const tracks = stream.getAudioTracks();
      if (!tracks.length) { setError('No audio — try Entire Screen'); setIsActive(false); setIsListening(false); return; }
      streamRef.current = new MediaStream(tracks);
      buildRecorder(streamRef.current, true);
      setIsListening(true); setStatus('Listening to interviewer...'); setError('');
    } catch (e) { setError(`Capture failed: ${e.message}`); setIsActive(false); setIsListening(false); }
  }, [buildRecorder]);

  const openPicker = useCallback(async () => {
    setError(''); setStatus('Loading windows...');
    const list = await invokeIpc('get-audio-sources');
    if (!list?.length) { setError('No windows found'); setIsActive(false); return; }
    setSources(list); setShowPicker(true); setStatus('Pick meeting window');
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(intervalRef.current); intervalRef.current = null;
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; recorderRef.current = null; chunksRef.current = [];
    setIsListening(false);
  }, []);

  const toggleMic = useCallback(() => {
    if (!isActive) {
      setIsActive(true); setError(''); setTranscript('');
      if (modeRef.current === MODE_INTERVIEW) openPicker(); else startChat();
    } else {
      setIsActive(false); stopRecording(); setShowPicker(false);
      setStatus('Ready'); setTranscript('');
    }
  }, [isActive, startChat, openPicker, stopRecording]);

  const switchMode = useCallback((m) => {
    if (m === mode) return;
    if (isActive) { setIsActive(false); stopRecording(); setShowPicker(false); }
    setMode(m); 
    // Don't clear history - each mode keeps its own separate history
    setError(''); 
    setTranscript(''); 
    setStatus('Ready');
  }, [mode, isActive, stopRecording]);

  // ── PILL ─────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div style={{ background: 'transparent', width: 320, height: 64, WebkitAppRegion: 'no-drag' }}>
        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="w-full h-full bg-slate-900 border border-white/15 rounded-full flex items-center px-4 gap-3"
          style={{ WebkitAppRegion: 'drag', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}
        >
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isListening ? 'bg-red-500 animate-pulse' : isThinking ? 'bg-yellow-400 animate-pulse' : connected ? 'bg-green-400' : 'bg-slate-600'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-semibold truncate">
              {isThinking ? 'Answering...' : isListening ? (mode === MODE_INTERVIEW ? 'Listening to interviewer' : 'Listening...') : `AI Assistant · ${currentHistory.length} Q&A`}
            </p>
            {currentHistory.length > 0 && currentHistory[currentHistory.length-1].a && (
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{currentHistory[currentHistory.length-1].a.slice(0,50)}…</p>
            )}
          </div>
          <button onClick={() => { setMinimized(false); sendIpc('maximize-mini'); }}
            className="p-1.5 rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' }}>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </div>
    );
  }

  // ── FULL VIEW ─────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'transparent' }}>
      <div className="w-[420px] h-[600px] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden" 
         style={{ 
           backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : theme === 'ocean' ? 'rgba(23, 37, 84, 0.85)' : theme === 'forest' ? 'rgba(5, 46, 22, 0.85)' : theme === 'sunset' ? 'rgba(74, 13, 13, 0.85)' : 'rgba(46, 16, 101, 0.85)',
           backdropFilter: 'blur(20px)',
           boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
         }}
         onContextMenu={e => e.preventDefault()}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0`}
          style={{ 
            background: theme === 'dark' ? 'linear-gradient(to right, rgba(79, 70, 229, 0.2), rgba(147, 51, 234, 0.2))' 
                    : theme === 'ocean' ? 'linear-gradient(to right, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))'
                    : theme === 'forest' ? 'linear-gradient(to right, rgba(16, 185, 129, 0.2), rgba(20, 184, 166, 0.2))'
                    : theme === 'sunset' ? 'linear-gradient(to right, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.2))'
                    : 'linear-gradient(to right, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.2))'
          }}
          style={{ WebkitAppRegion: 'drag' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ 
              background: theme === 'dark' ? 'linear-gradient(to bottom right, #6366f1, #a855f7)' 
                      : theme === 'ocean' ? 'linear-gradient(to bottom right, #06b6d4, #3b82f6)'
                      : theme === 'forest' ? 'linear-gradient(to bottom right, #10b981, #14b8a6)'
                      : theme === 'sunset' ? 'linear-gradient(to bottom right, #f97316, #f59e0b)'
                      : 'linear-gradient(to bottom right, #8b5cf6, #a855f7)'
            }}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">AI Interview Assistant</h1>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <p className="text-[10px] text-slate-400">{connected ? 'Connected' : 'Disconnected'}</p>
                {currentHistory.length > 0 && (
                  <span className="text-[10px] text-slate-500">· {currentHistory.length} Q&A saved</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
            <button onClick={() => setShowQuestionBank(!showQuestionBank)} title="Question Bank"
              className={`p-1.5 rounded-lg transition-colors ${showQuestionBank ? 'bg-emerald-600/50 text-emerald-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowMemory(!showMemory)} title="Memory"
              className={`p-1.5 rounded-lg transition-colors ${showMemory ? 'bg-purple-600/50 text-purple-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
              <Brain className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowAnalytics(!showAnalytics)} title="Analytics"
              className={`p-1.5 rounded-lg transition-colors ${showAnalytics ? 'bg-amber-600/50 text-amber-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowSettings(!showSettings)} title="Settings"
              className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-indigo-600/50 text-indigo-400' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            {/* Debug connection button */}
            <button onClick={async () => {
              console.log('[DesktopMini] 🔍 Debug Info:');
              console.log('- Backend URL:', BACKEND_URL);
              console.log('- Socket connected:', socketRef.current?.connected);
              console.log('- Socket ID:', socketRef.current?.id);
              console.log('- Session ID:', SESSION_ID);
              console.log('- User:', user?.id || 'desktop-user');
              
              // Test backend health
              try {
                const response = await fetch(`${BACKEND_URL}/api/v1/health`);
                console.log('- Backend health:', response.ok ? 'OK' : 'FAILED');
                if (response.ok) {
                  const data = await response.json();
                  console.log('- Backend response:', data);
                }
              } catch (err) {
                console.log('- Backend health error:', err.message);
              }
              
              // Test socket connection
              if (socketRef.current) {
                console.log('- Socket transport:', socketRef.current.io?.engine?.transport?.name);
                console.log('- Socket rooms:', Array.from(socketRef.current.rooms || []));
                
                // Try to send a test message
                if (socketRef.current.connected) {
                  console.log('- Sending test question...');
                  sendQuestion('Hello, this is a test message');
                } else {
                  console.log('- Socket not connected, attempting reconnection...');
                  socketRef.current.connect();
                }
              } else {
                console.log('- No socket reference');
              }
            }} title="Debug Connection"
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
              🔍
            </button>
            {currentHistory.length > 0 && (
              <button onClick={() => { 
                setCurrentHistory([]); 
                setSessionMemory([]);
                if (user?.id) {
                  localStorage.removeItem(`user-${user.id}-chatHistory`);
                  localStorage.removeItem(`user-${user.id}-interviewHistory`);
                  localStorage.removeItem(`user-${user.id}-sessionMemory`);
                }
                socketRef.current?.emit('clear-keywords', { sessionId: SESSION_ID });
              }} title="Clear history"
                className="p-1.5 rounded-lg bg-slate-700/50 text-slate-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => { setMinimized(true); sendIpc('minimize-mini'); }}
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => sendIpc('close-mini')}
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex mx-4 mt-3 mb-2 bg-slate-800/60 rounded-xl p-1 gap-1 flex-shrink-0">
          <button onClick={() => switchMode(MODE_CHAT)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ 
              backgroundColor: mode === MODE_CHAT ? (theme === 'dark' ? '#4f46e5' : theme === 'ocean' ? '#0891b2' : theme === 'forest' ? '#059669' : theme === 'sunset' ? '#ea580c' : '#7c3aed') : 'transparent',
              color: mode === MODE_CHAT ? 'white' : '#94a3b8'
            }}>
            <User className="w-3.5 h-3.5" /> Chat Mode
          </button>
          <button onClick={() => switchMode(MODE_INTERVIEW)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ 
              backgroundColor: mode === MODE_INTERVIEW ? '#10b981' : 'transparent',
              color: mode === MODE_INTERVIEW ? 'white' : '#94a3b8'
            }}>
            <Monitor className="w-3.5 h-3.5" /> Interview Mode
          </button>
        </div>

        {/* Source picker */}
        {showPicker && (
          <div className="mx-4 mb-2 bg-slate-800 border border-emerald-700/40 rounded-xl overflow-hidden flex-shrink-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-400">Select your meeting window</p>
              <button onClick={() => { setShowPicker(false); setIsActive(false); setStatus('Ready'); }}
                className="text-slate-500 hover:text-white text-xs px-1">✕</button>
            </div>
            <div className="max-h-[150px] overflow-y-auto">
              {sources.map(src => (
                <button key={src.id} onClick={() => startInterviewWithSource(src.id)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-emerald-900/30 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
                  <Monitor className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{src.name}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 px-3 py-1.5">Pick the window playing meeting audio</p>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mx-4 mb-2 bg-slate-800 border border-white/10 rounded-xl overflow-hidden flex-shrink-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Settings
              </p>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white text-xs px-1">✕</button>
            </div>
            
            {/* AI Personality */}
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">AI Personality</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(AI_PERSONALITIES).map(([key, p]) => {
                  const Icon = p.icon;
                  return (
                    <button key={key} onClick={() => setPersonality(key)}
                      className={`p-2 rounded-lg text-left transition-all ${personality === key ? `bg-${p.color}-600/30 border border-${p.color}-500/50` : 'bg-slate-700/30 border border-transparent hover:bg-slate-700/50'}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon className={`w-3 h-3 text-${p.color}-400`} />
                        <span className="text-[10px] font-medium text-slate-200">{p.name}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-tight">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation Mode */}
            <div className="px-3 py-2 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-200 font-medium">AI Explanation Mode</p>
                  <p className="text-[9px] text-slate-500">AI explains its reasoning</p>
                </div>
                <button onClick={() => setExplanationMode(!explanationMode)}
                  className={`w-10 h-5 rounded-full transition-colors ${explanationMode ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${explanationMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* UI Theme */}
            <div className="px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">UI Theme</p>
              <div className="flex gap-1.5">
                {Object.entries(UI_THEMES).map(([key, t]) => (
                  <button key={key} onClick={() => setTheme(key)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-medium transition-all ${theme === key ? `bg-${t.accent}-600 text-white` : 'bg-slate-700/30 text-slate-400 hover:text-white'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Memory */}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Custom Memory</p>
                <span className="text-[9px] text-slate-600">{customMemory.length} items</span>
              </div>
              
              {/* Add new memory form */}
              {editingMemory === 'new' ? (
                <div className="bg-slate-700/30 rounded-lg p-2 mb-2 space-y-1.5">
                  <input type="text" value={newMemoryQ} onChange={e => setNewMemoryQ(e.target.value)}
                    placeholder="Question..." className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500" />
                  <input type="text" value={newMemoryA} onChange={e => setNewMemoryA(e.target.value)}
                    placeholder="Answer..." className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500" />
                  <div className="flex gap-1">
                    <button onClick={() => {
                      if (newMemoryQ.trim() && newMemoryA.trim()) {
                        setCustomMemory([...customMemory, { id: Date.now(), q: newMemoryQ.trim(), a: newMemoryA.trim() }]);
                        setNewMemoryQ(''); setNewMemoryA(''); setEditingMemory(null);
                      }
                    }} className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[9px] text-white">Save</button>
                    <button onClick={() => { setEditingMemory(null); setNewMemoryQ(''); setNewMemoryA(''); }} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-[9px] text-white">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditingMemory('new')} className="w-full py-1.5 mb-2 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg text-[10px] text-slate-400 hover:text-white transition-colors">
                  + Add Memory
                </button>
              )}

              {/* Memory list */}
              <div className="max-h-[100px] overflow-y-auto space-y-1">
                {customMemory.map((mem) => (
                  <div key={mem.id} className="bg-slate-700/20 rounded-lg p-1.5 text-[9px] group">
                    {editingMemory === mem.id ? (
                      <div className="space-y-1">
                        <input type="text" defaultValue={mem.q} id={`mem-q-${mem.id}`}
                          className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-1.5 py-0.5 text-[9px] text-white" />
                        <input type="text" defaultValue={mem.a} id={`mem-a-${mem.id}`}
                          className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-1.5 py-0.5 text-[9px] text-white" />
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => {
                            const q = document.getElementById(`mem-q-${mem.id}`).value;
                            const a = document.getElementById(`mem-a-${mem.id}`).value;
                            setCustomMemory(customMemory.map(m => m.id === mem.id ? { ...m, q, a } : m));
                            setEditingMemory(null);
                          }} className="flex-1 py-0.5 bg-emerald-600 rounded text-[8px] text-white">Save</button>
                          <button onClick={() => setEditingMemory(null)} className="px-2 py-0.5 bg-slate-600 rounded text-[8px] text-white">Cancel</button>
                          <button onClick={() => { setCustomMemory(customMemory.filter(m => m.id !== mem.id)); setEditingMemory(null); }} className="px-2 py-0.5 bg-red-600 rounded text-[8px] text-white">Delete</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 font-medium truncate">{mem.q}</p>
                          <p className="text-slate-500 truncate">{mem.a}</p>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingMemory(mem.id)} className="p-0.5 bg-slate-600 hover:bg-slate-500 rounded text-slate-300">✎</button>
                          <button onClick={() => setCustomMemory(customMemory.filter(m => m.id !== mem.id))} className="p-0.5 bg-slate-600 hover:bg-red-600 rounded text-slate-300">✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {customMemory.length === 0 && !editingMemory && (
                  <p className="text-[9px] text-slate-600 text-center py-2">No custom memory yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Question Bank */}
        {showQuestionBank && (
          <div className="mx-4 mb-2 bg-slate-800 border border-emerald-700/40 rounded-xl overflow-hidden flex-shrink-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Question Bank
              </p>
              <button onClick={() => setShowQuestionBank(false)} className="text-slate-500 hover:text-white text-xs px-1">✕</button>
            </div>
            <div className="flex gap-1 px-2 py-1.5 border-b border-white/5">
              {Object.keys(QUESTION_BANK).map(cat => (
                <button key={cat} onClick={() => setQuestionCategory(cat)}
                  className={`flex-1 py-1 rounded-lg text-[9px] font-medium capitalize transition-all ${questionCategory === cat ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="max-h-[120px] overflow-y-auto">
              {QUESTION_BANK[questionCategory].map((q, i) => (
                <button key={i} onClick={() => { sendQuestion(q); setShowQuestionBank(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-emerald-900/30 hover:text-white transition-colors border-b border-white/5 last:border-0">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="mx-4 mb-2 bg-slate-800 border border-amber-700/40 rounded-xl overflow-hidden flex-shrink-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Analytics
              </p>
              <button onClick={() => setShowAnalytics(false)} className="text-slate-500 hover:text-white text-xs px-1">✕</button>
            </div>
            <div className="px-3 py-2 grid grid-cols-2 gap-2">
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{currentHistory.length}</p>
                <p className="text-[9px] text-slate-500">Questions</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{currentHistory.filter(h => h.a).length}</p>
                <p className="text-[9px] text-slate-500">Answers</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{mode}</p>
                <p className="text-[9px] text-slate-500">Mode</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{connected ? '✓' : '✗'}</p>
                <p className="text-[9px] text-slate-500">Status</p>
              </div>
            </div>
          </div>
        )}

        {/* Memory Panel (standalone) */}
        {showMemory && (
          <div className="mx-4 mb-2 bg-slate-800 border border-purple-700/40 rounded-xl overflow-hidden flex-shrink-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Memory
              </p>
              <button onClick={() => setShowMemory(false)} className="text-slate-500 hover:text-white text-xs px-1">✕</button>
            </div>
            
            {/* Session Memory (auto-learned keywords) */}
            {sessionMemory.length > 0 && (
              <div className="px-3 py-2 border-b border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-cyan-400 uppercase tracking-wider">Remembered Keywords</p>
                  <button onClick={() => { 
                  setSessionMemory([]);
                  if (user?.id) {
                    localStorage.removeItem(`user-${user.id}-sessionMemory`);
                  }
                  socketRef.current?.emit('clear-keywords', { sessionId: SESSION_ID });
                }} className="text-[9px] text-red-400 hover:text-red-300">Clear</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sessionMemory.map((kw, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                      kw.type === 'name' ? 'bg-pink-600/30 text-pink-300' :
                      kw.type === 'company' ? 'bg-blue-600/30 text-blue-300' :
                      kw.type === 'role' ? 'bg-purple-600/30 text-purple-300' :
                      kw.type === 'skills' ? 'bg-green-600/30 text-green-300' :
                      kw.type === 'tech' ? 'bg-amber-600/30 text-amber-300' :
                      kw.type === 'experience' ? 'bg-cyan-600/30 text-cyan-300' :
                      'bg-slate-600/30 text-slate-300'
                    }`}>
                      {kw.type}: {kw.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add new memory */}
            {editingMemory === 'new' ? (
              <div className="px-3 py-2 bg-slate-700/30 space-y-1.5">
                <input type="text" value={newMemoryQ} onChange={e => setNewMemoryQ(e.target.value)}
                  placeholder="Question..." className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500" />
                <input type="text" value={newMemoryA} onChange={e => setNewMemoryA(e.target.value)}
                  placeholder="Answer..." className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500" />
                <div className="flex gap-1">
                  <button onClick={() => {
                    if (newMemoryQ.trim() && newMemoryA.trim()) {
                      setCustomMemory([...customMemory, { id: Date.now(), q: newMemoryQ.trim(), a: newMemoryA.trim() }]);
                      setNewMemoryQ(''); setNewMemoryA(''); setEditingMemory(null);
                    }
                  }} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white font-medium">Save</button>
                  <button onClick={() => { setEditingMemory(null); setNewMemoryQ(''); setNewMemoryA(''); }} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-xs text-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2">
                <button onClick={() => setEditingMemory('new')} className="w-full py-2 bg-purple-700/30 hover:bg-purple-700/50 rounded-lg text-xs text-purple-300 hover:text-white transition-colors font-medium">
                  + Add New Memory
                </button>
              </div>
            )}

            {/* Memory list */}
            <div className="max-h-[150px] overflow-y-auto px-3 pb-2 space-y-1.5">
              {customMemory.map((mem) => (
                <div key={mem.id} className="bg-slate-700/20 rounded-lg p-2 text-[10px] group">
                  {editingMemory === mem.id ? (
                    <div className="space-y-1">
                      <input type="text" defaultValue={mem.q} id={`mem-q-${mem.id}`}
                        className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-2 py-1 text-[9px] text-white" />
                      <input type="text" defaultValue={mem.a} id={`mem-a-${mem.id}`}
                        className="w-full bg-slate-800/50 border border-slate-600/30 rounded px-2 py-1 text-[9px] text-white" />
                      <div className="flex gap-1 mt-1.5">
                        <button onClick={() => {
                          const q = document.getElementById(`mem-q-${mem.id}`).value;
                          const a = document.getElementById(`mem-a-${mem.id}`).value;
                          setCustomMemory(customMemory.map(m => m.id === mem.id ? { ...m, q, a } : m));
                          setEditingMemory(null);
                        }} className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[9px] text-white font-medium">Save</button>
                        <button onClick={() => setEditingMemory(null)} className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-[9px] text-white">Cancel</button>
                        <button onClick={() => { setCustomMemory(customMemory.filter(m => m.id !== mem.id)); setEditingMemory(null); }} className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-[9px] text-white">Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 font-medium">{mem.q}</p>
                        <p className="text-slate-500 mt-0.5">{mem.a}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => setEditingMemory(mem.id)} className="p-1 bg-slate-600 hover:bg-slate-500 rounded text-slate-300" title="Edit">✎</button>
                        <button onClick={() => setCustomMemory(customMemory.filter(m => m.id !== mem.id))} className="p-1 bg-slate-600 hover:bg-red-600 rounded text-slate-300" title="Delete">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {customMemory.length === 0 && !editingMemory && (
                <p className="text-[10px] text-slate-600 text-center py-4">No custom memory yet. Add Q&A pairs to help AI remember context.</p>
              )}
            </div>
          </div>
        )}

        {/* ── CHAT HISTORY — scrollable, grows with content ── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">

          {/* Empty state */}
          {currentHistory.length === 0 && !showPicker && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              {mode === MODE_INTERVIEW ? (
                <>
                  <Monitor className="w-10 h-10 text-emerald-800" />
                  <p className="text-slate-400 text-sm font-medium">Interview Mode</p>
                  <p className="text-slate-600 text-xs max-w-[240px]">Press start → pick your meeting window → AI answers every interviewer question automatically</p>
                </>
              ) : (
                <>
                  <MessageCircle className="w-10 h-10 text-slate-700" />
                  <p className="text-slate-400 text-sm font-medium">Chat Mode</p>
                  <p className="text-slate-600 text-xs">Press mic or type — all Q&A saved for the session</p>
                </>
              )}
            </div>
          )}

          {/* All Q&A pairs — never removed, always scrollable */}
          <div className="space-y-4 pb-2">
            {currentHistory.map((item, idx) => (
              <div key={item.id} className="space-y-1.5">

                {/* Index badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-600 font-mono">#{idx + 1}</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* Question — right */}
                <div className="flex justify-end">
                  <div className={`max-w-[88%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed ${
                    mode === MODE_INTERVIEW
                      ? 'bg-emerald-900/60 border border-emerald-700/30 text-emerald-100'
                      : 'bg-indigo-900/60 border border-indigo-700/30 text-indigo-100'
                  }`}>
                    <p className="text-[9px] opacity-50 uppercase tracking-wider mb-1">
                      {mode === MODE_INTERVIEW ? '🎤 Interviewer' : '👤 You'}
                    </p>
                    <p>{item.q}</p>
                  </div>
                </div>

                {/* Answer — left */}
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-tl-sm px-3 py-2.5 text-xs leading-relaxed bg-slate-800 border border-slate-700/40">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Bot className="w-3 h-3 text-indigo-400" />
                      <span className="text-[9px] text-indigo-400 uppercase tracking-wider font-semibold">AI Answer</span>
                      {item.pending && idx === currentHistory.length - 1 && (
                        <Loader2 className="w-3 h-3 text-slate-400 animate-spin ml-1" />
                      )}
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap">
                      {item.a || (item.pending ? '' : '—')}
                      {item.pending && idx === currentHistory.length - 1 && (
                        <span className="inline-block w-0.5 h-3 ml-0.5 bg-indigo-400 animate-pulse align-middle" />
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Listening pulse at bottom */}
            {isActive && !showPicker && isListening && !isThinking && (
              <div className="flex items-center gap-2 py-1 px-1">
                {[0,1,2].map(i => (
                  <motion.div key={i}
                    className={`w-1.5 h-1.5 rounded-full ${mode === MODE_INTERVIEW ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    animate={{ scale: [1, 1.8, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }}
                  />
                ))}
                <span className="text-[10px] text-slate-500">
                  {mode === MODE_INTERVIEW ? 'Listening to interviewer...' : 'Listening...'}
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Transcript badge */}
        {transcript && (
          <div className="mx-4 mb-1 px-3 py-1.5 bg-slate-800/50 border border-slate-700/30 rounded-lg flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <p className="text-[10px] text-slate-400 truncate italic">"{transcript}"</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 text-center px-4 mb-1 flex-shrink-0">{error}</p>
        )}

        {/* Controls */}
        <div className="px-4 pb-3 pt-1 flex-shrink-0 space-y-2 border-t border-white/5">
          {!showPicker && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {mode === MODE_CHAT && (
                  <form onSubmit={(e) => { e.preventDefault(); if (!textInput.trim()) return; sendQuestion(textInput); setTextInput(''); }} className="flex gap-2">
                    <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
                      placeholder="Type a question..."
                      className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50" />
                    <button type="submit" disabled={!textInput.trim() || !connected}
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors">
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </form>
                )}
                {mode === MODE_INTERVIEW && !isActive && (
                  <p className="text-[10px] text-slate-500 text-center">Press start → pick meeting window → AI answers automatically</p>
                )}
                {mode === MODE_INTERVIEW && isActive && (
                  <p className="text-[10px] text-emerald-500 text-center animate-pulse">● Capturing interviewer audio</p>
                )}
              </div>
              <motion.button onClick={toggleMic} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl flex-shrink-0 transition-all ${
                  isActive ? 'bg-red-500 ring-4 ring-red-500/30'
                  : mode === MODE_INTERVIEW ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  : `bg-gradient-to-br ${theme === 'dark' ? 'from-indigo-500 to-purple-600' : theme === 'ocean' ? 'from-cyan-500 to-blue-600' : theme === 'forest' ? 'from-emerald-500 to-teal-600' : theme === 'sunset' ? 'from-orange-500 to-amber-600' : 'from-purple-500 to-violet-600'}`
                }`}
                style={{
                  background: isActive ? '#ef4444' 
                    : mode === MODE_INTERVIEW ? 'linear-gradient(to bottom right, #10b981, #0d9488)'
                    : theme === 'dark' ? 'linear-gradient(to bottom right, #6366f1, #a855f7)' 
                    : theme === 'ocean' ? 'linear-gradient(to bottom right, #06b6d4, #3b82f6)'
                    : theme === 'forest' ? 'linear-gradient(to bottom right, #10b981, #14b8a6)'
                    : theme === 'sunset' ? 'linear-gradient(to bottom right, #f97316, #f59e0b)'
                    : 'linear-gradient(to bottom right, #8b5cf6, #a855f7)'
                }}>
                {isActive ? <MicOff className="w-5 h-5 text-white" />
                  : mode === MODE_INTERVIEW ? <Monitor className="w-5 h-5 text-white" />
                  : <Mic className="w-5 h-5 text-white" />}
              </motion.button>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="px-4 py-1.5 border-t border-white/5 bg-slate-950/50 flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              isListening ? 'bg-red-500 animate-pulse' :
              isThinking  ? 'bg-yellow-400 animate-pulse' :
              isActive    ? 'bg-green-500' : 'bg-slate-600'
            }`} />
            <span className="text-[10px] text-slate-500">{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}




