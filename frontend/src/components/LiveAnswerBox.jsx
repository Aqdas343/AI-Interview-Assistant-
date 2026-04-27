import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageCircle, CheckCircle, Lightbulb, Cpu, Loader2, Mic, Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '../services/socketService';
import useInterviewStore from '../store/interviewStore';

const UI_STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  ANSWERING: 'ANSWERING',
  ERROR: 'ERROR'
};

const LiveAnswerBox = () => {
  const [uiState, setUiState] = useState(UI_STATES.IDLE);
  const [stealthMode, setStealthMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [liveAnswer, setLiveAnswer] = useState({
    question: '',
    answer: '',
    keyPoints: [],
    example: '',
    confidence: null,
    model: '',
    topic: '',
  });

  const rawAnswerRef = useRef(''); 
  const networkCompleteRef = useRef(true); 
  const typingIntervalRef = useRef(null);
  const idleTimerRef = useRef(null);

  const setUiStatus = (status) => {
    setUiState(status);
    useInterviewStore.getState().setAiStatus(status);
  };

  // Keyboard shortcut: Ctrl+K toggles stealth mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setStealthMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Socket event handlers
  const handleLiveTranscript = (data) => {
    setUiStatus(UI_STATES.LISTENING);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setUiStatus(UI_STATES.IDLE);
    }, 2000);
  };

  const handleAnswerStart = (data) => {
    console.log('[LiveAnswerBox] ✅ answer_start received:', data);
    setUiStatus(UI_STATES.THINKING);
    networkCompleteRef.current = false;
    rawAnswerRef.current = '';
    
    setLiveAnswer({
      question: data?.question || 'Thinking...',
      answer: '', 
      keyPoints: [],
      example: '',
      confidence: null,
      model: '',
      topic: '',
    });
    
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  };

  const handleAnswerChunk = (data) => {
    console.log('[LiveAnswerBox] ✅ answer_chunk received:', data);
    if (data?.chunk) {
      rawAnswerRef.current += data.chunk;
      console.log('[LiveAnswerBox] Total answer length:', rawAnswerRef.current.length);
      
      // Update UI immediately (no typing animation for now)
      setUiStatus(UI_STATES.ANSWERING);
      setLiveAnswer(prev => ({
        ...prev,
        answer: rawAnswerRef.current
      }));
    }
  };

  const handleAnswerEnd = (data) => {
    console.log('[LiveAnswerBox] ✅ answer_end received:', data);
    networkCompleteRef.current = true;
    
    setLiveAnswer(prev => ({
      ...prev,
      question: data?.question || prev.question,
      keyPoints: data?.keyPoints || [],
      example: data?.example || '',
      confidence: data?.confidence || null,
      model: data?.model || 'AI',
      topic: data?.topic || 'GENERAL',
    }));
    
    startTyping();
    setTimeout(() => setUiStatus(UI_STATES.IDLE), 5000);
  };

  const handleAnswerError = (data) => {
    console.log('[LiveAnswerBox] answer_error:', data);
    setUiStatus(UI_STATES.ERROR);
    setTimeout(() => setUiStatus(UI_STATES.IDLE), 3000);
  };

  const startTyping = () => {
    if (typingIntervalRef.current) return;

    console.log('[LiveAnswerBox] Starting typing animation, raw length:', rawAnswerRef.current.length);
    
    typingIntervalRef.current = setInterval(() => {
      setLiveAnswer(prev => {
        const raw = rawAnswerRef.current;
        if (prev.answer.length < raw.length) {
          setUiStatus(UI_STATES.ANSWERING);
          const diff = raw.length - prev.answer.length;
          const charsToAdd = Math.max(1, Math.ceil(diff / 3)); 
          const nextText = raw.substring(0, prev.answer.length + charsToAdd);
          
          console.log('[LiveAnswerBox] Typing progress:', nextText.length, '/', raw.length);
          return { ...prev, answer: nextText };
        } else {
          if (networkCompleteRef.current) {
            console.log('[LiveAnswerBox] Typing complete!');
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            return prev;
          }
          return prev;
        }
      });
    }, 20);
  };

  // Setup socket listeners - MUST run after socket is initialized and session is joined
  useEffect(() => {
    console.log('[LiveAnswerBox] 🔧 Setting up socket listeners...');
    
    const setupListeners = () => {
      const socket = getSocket();
      
      if (!socket) {
        console.log('[LiveAnswerBox] ⏳ Socket not available yet, waiting...');
        setTimeout(setupListeners, 500);
        return;
      }
      
      console.log('[LiveAnswerBox] ✅ Socket available:', socket.id);
      
      // Remove existing listeners to prevent duplicates
      socket.off('answer_start');
      socket.off('answer_chunk');
      socket.off('answer_end');
      socket.off('answer_error');
      socket.off('live_transcript_chunk');
      
      // Add listeners
      socket.on('answer_start', (data) => {
        console.log('[LiveAnswerBox] 🎯 answer_start EVENT:', data);
        setUiStatus(UI_STATES.THINKING);
        networkCompleteRef.current = false;
        rawAnswerRef.current = '';
        setLiveAnswer({
          question: data?.question || 'Thinking...',
          answer: '', 
          keyPoints: [],
          example: '',
          confidence: null,
          model: '',
          topic: '',
        });
      });
      
      socket.on('answer_chunk', (data) => {
        console.log('[LiveAnswerBox] 🎯 answer_chunk EVENT:', data?.chunk?.substring(0, 50) + '...');
        if (data?.chunk) {
          rawAnswerRef.current += data.chunk;
          setUiStatus(UI_STATES.ANSWERING);
          setLiveAnswer(prev => ({
            ...prev,
            answer: rawAnswerRef.current
          }));
        }
      });
      
      socket.on('answer_end', (data) => {
        console.log('[LiveAnswerBox] 🎯 answer_end EVENT');
        networkCompleteRef.current = true;
        setTimeout(() => setUiStatus(UI_STATES.IDLE), 3000);
      });
      
      socket.on('answer_error', (data) => {
        console.log('[LiveAnswerBox] ❌ answer_error EVENT:', data);
        setUiStatus(UI_STATES.ERROR);
        setTimeout(() => setUiStatus(UI_STATES.IDLE), 3000);
      });
      
      socket.on('live_transcript_chunk', (data) => {
        setUiStatus(UI_STATES.LISTENING);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          setUiStatus(UI_STATES.IDLE);
        }, 2000);
      });
      
      // Listen for socket connection events
      const handleConnect = () => {
        console.log('[LiveAnswerBox] Socket connected:', socket.id);
        setIsConnected(true);
      };
      
      const handleDisconnect = () => {
        console.log('[LiveAnswerBox] Socket disconnected');
        setIsConnected(false);
      };
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      
      // Set initial connection status
      setIsConnected(socket.connected);
      
      console.log('[LiveAnswerBox] ✅ All listeners registered successfully');
    };
    
    // Listen for session ready event
    const handleSessionReady = (event) => {
      console.log('[LiveAnswerBox] 🎉 Session ready:', event.detail.sessionId);
      setupListeners();
    };
    
    // Start setup immediately and also listen for session ready
    setupListeners();
    window.addEventListener('socket-session-ready', handleSessionReady);
    
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('answer_start');
        socket.off('answer_chunk');
        socket.off('answer_end');
        socket.off('answer_error');
        socket.off('live_transcript_chunk');
        socket.off('connect');
        socket.off('disconnect');
      }
      window.removeEventListener('socket-session-ready', handleSessionReady);
    };
  }, []);

  const setupListeners = (socket) => {
    console.log('[LiveAnswerBox] Setting up socket listeners');
    socket.on('live_transcript_chunk', handleLiveTranscript);
    socket.on('answer_start', handleAnswerStart);
    socket.on('answer_chunk', handleAnswerChunk);
    socket.on('answer_end', handleAnswerEnd);
    socket.on('answer_error', handleAnswerError);
  };

  // Show connection status
  const showConnectionStatus = !isConnected;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#16171a] rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Stealth Mode Overlay */}
      {stealthMode && (
        <div className="absolute inset-0 z-10 bg-white/95 dark:bg-[#16171a]/95 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <button 
            onClick={() => setStealthMode(false)}
            className="flex flex-col items-center gap-3 p-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Eye className="w-10 h-10 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to show answers</span>
            <span className="text-xs text-slate-400">(Ctrl+K)</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 ${stealthMode ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">AI Answers</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setStealthMode(!stealthMode)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Stealth Mode (Ctrl+K)"
        >
          {stealthMode ? <Eye className="w-4 h-4 text-slate-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-4 ${stealthMode ? 'opacity-30 pointer-events-none' : ''}`}>
        {uiState === UI_STATES.IDLE && !liveAnswer.answer && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Waiting for Questions
              </p>
              <p className="text-xs text-slate-500 max-w-[200px]">
                AI answers will appear here in real-time
              </p>
            </div>
          </div>
        )}

        {/* Thinking State */}
        {uiState === UI_STATES.THINKING && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="w-8 h-8 text-purple-500" />
            </motion.div>
            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Generating answer...</p>
          </div>
        )}

        {/* Answer Display */}
        {(liveAnswer.answer || uiState === UI_STATES.ANSWERING) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Question */}
            {liveAnswer.question && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Question</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {liveAnswer.question}
                </p>
              </div>
            )}

            {/* Answer */}
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">AI Answer</span>
                {uiState === UI_STATES.ANSWERING && (
                  <Loader2 className="w-3 h-3 text-purple-600 dark:text-purple-400 animate-spin ml-auto" />
                )}
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {liveAnswer.answer}
                {uiState === UI_STATES.ANSWERING && (
                  <span className="inline-block w-0.5 h-4 ml-1 bg-purple-500 animate-pulse align-middle" />
                )}
              </div>
            </div>

            {/* Metadata */}
            {liveAnswer.confidence && (
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {liveAnswer.confidence}% Confidence
                  </span>
                </div>
                {liveAnswer.topic && (
                  <div className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {liveAnswer.topic}
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Error State */}
        {uiState === UI_STATES.ERROR && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Something went wrong</p>
              <p className="text-xs text-slate-500">Please try again</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveAnswerBox;