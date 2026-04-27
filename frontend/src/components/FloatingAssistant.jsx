import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Move } from 'lucide-react';
import { getSocket } from '../services/socketService';

const FloatingAssistant = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [pipWindow, setPipWindow] = useState(null);
  
  const [liveAnswer, setLiveAnswer] = useState({
    answer: '',
    isStreaming: false
  });

  const rawAnswerRef = useRef('');
  const networkCompleteRef = useRef(true);
  const typingIntervalRef = useRef(null);
  const pipContainerRef = useRef(null);

  const togglePiP = async (forceInPage = false) => {
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    // If already visible in-page, and we are toggling off
    if (isVisible && !pipWindow) {
        setIsVisible(false);
        return;
    }

    if (forceInPage || !window.documentPictureInPicture) {
      setIsVisible(true);
      return;
    }

    try {
      const pipW = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 400,
      });

      // Copy styles to the new window
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = pipW.document.createElement('style');
          style.textContent = cssRules;
          pipW.document.head.appendChild(style);
        } catch (e) {
          const link = pipW.document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media;
          link.href = styleSheet.href;
          pipW.document.head.appendChild(link);
        }
      });

      pipW.document.body.style.margin = '0';
      pipW.document.body.style.padding = '0';
      pipW.document.body.style.overflow = 'hidden';
      pipW.document.body.style.backgroundColor = '#0f172a'; // Match slate-900

      const container = pipW.document.createElement('div');
      container.id = 'pip-root';
      container.style.height = '100vh';
      container.style.width = '100vw';
      pipW.document.body.appendChild(container);
      pipContainerRef.current = container;

      pipW.addEventListener('pagehide', () => {
        setPipWindow(null);
        pipContainerRef.current = null;
        setIsVisible(false);
      });

      setPipWindow(pipW);
      setIsVisible(true);
    } catch (err) {
      console.error('Failed to enter Desktop Mode:', err);
      // Fallback to in-page if PiP fails (e.g. user denied or popup blocked)
      setIsVisible(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePiP();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pipWindow, isVisible]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const startTyping = () => {
      if (typingIntervalRef.current) return;
      typingIntervalRef.current = setInterval(() => {
        setLiveAnswer(prev => {
          const raw = rawAnswerRef.current;
          if (prev.answer.length < raw.length) {
            const diff = raw.length - prev.answer.length;
            const charsToAdd = Math.max(1, Math.ceil(diff / 5));
            const nextText = raw.substring(0, prev.answer.length + charsToAdd);
            return { ...prev, answer: nextText, isStreaming: true };
          } else {
            if (networkCompleteRef.current) {
              clearInterval(typingIntervalRef.current);
              typingIntervalRef.current = null;
              return { ...prev, isStreaming: false };
            }
            return prev;
          }
        });
      }, 15);
    };

    const handleAnswerChunk = (data) => {
      if (networkCompleteRef.current) {
         networkCompleteRef.current = false;
         rawAnswerRef.current = '';
         setLiveAnswer({ answer: '', isStreaming: true });
         
         // Only auto-show if not already visible
         if (!isVisible && !pipWindow) {
            // NOTE: Chrome might block auto-PiP without direct user gesture.
            // We'll show in-page as fallback for socket-triggered visibility.
            setIsVisible(true);
         }
      }
      rawAnswerRef.current += (data.chunk || '');
      startTyping();
    };

    const handleAnswerComplete = () => {
      networkCompleteRef.current = true;
      startTyping();
    };

    socket.on('answer_chunk', handleAnswerChunk);
    socket.on('answer_complete', handleAnswerComplete);

    return () => {
      socket.off('answer_chunk', handleAnswerChunk);
      socket.off('answer_complete', handleAnswerComplete);
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, [isVisible, pipWindow]); 

  const AssistantContent = ({ inPiP }) => (
    <motion.div
      drag={!inPiP}
      dragMomentum={false}
      initial={inPiP ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`${inPiP ? 'w-full h-full' : 'fixed bottom-10 right-10 z-[9999] w-80'} bg-slate-900/95 backdrop-blur-md ${!inPiP ? 'rounded-2xl border border-slate-700 shadow-2xl shadow-blue-900/20' : ''} flex flex-col overflow-hidden text-white`}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/50 ${!inPiP ? 'cursor-move' : ''}`} style={{ touchAction: 'none' }}>
        <div className="flex items-center gap-2">
          {!inPiP && <Move className="w-3.5 h-3.5 text-slate-500" />}
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
            Copilot Mini {inPiP && '(Always on Screen)'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {liveAnswer.isStreaming && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
            </span>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); pipWindow ? pipWindow.close() : setIsVisible(false); }}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto cursor-text">
        {!liveAnswer.answer && !liveAnswer.isStreaming ? (
           <p className="text-xs text-slate-500 text-center py-4 uppercase tracking-widest font-bold">
             Waiting for audio stream...
           </p>
        ) : (
           <div className="text-sm text-slate-300 leading-relaxed font-menu">
             {liveAnswer.answer}
             {liveAnswer.isStreaming && <span className="inline-block w-1.5 h-3 ml-1 bg-purple-500 animate-pulse align-middle" />}
           </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isVisible && !pipWindow && <AssistantContent inPiP={false} />}
      {pipWindow && pipContainerRef.current && createPortal(<AssistantContent inPiP={true} />, pipContainerRef.current)}
    </AnimatePresence>
  );
};

export default FloatingAssistant;


