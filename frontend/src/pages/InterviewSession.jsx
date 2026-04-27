import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import useInterviewStore from '../store/interviewStore';
import { initSocket, disconnectSocket } from '../services/socketService';

/**
 * 🎙 INTERVIEW SESSION (CANDIDATE VIEW)
 * A premium, neural interface for real-time AI interviews.
 * Consumes the event-sourced store as the single source of truth.
 */
const InterviewSession = () => {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  
  const {
    status,
    currentQuestion,
    currentIndex,
    liveBuffer,
    transcriptHistory,
    isProcessing,
    error,
    participants,
    resumeInterview,
    startInterview,
    resetStore
  } = useInterviewStore();

  // 1. Lifecycle Sync
  useEffect(() => {
    if (sessionId) {
      resumeInterview(sessionId);
      initSocket(sessionId);
    } else {
      // Fallback: If no ID, we might want to start one or redirect
      navigate('/dashboard');
    }

    return () => {
      disconnectSocket();
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] text-white p-6">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold">Session Sync Failed</h1>
          <p className="text-slate-400 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-500 rounded-full text-sm font-bold">Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 font-inter selection:bg-blue-500/30 overflow-hidden relative">
      {/* 🎭 Neural Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[100px]"
        />
      </div>

      <div className="relative z-10 flex flex-col h-screen max-w-5xl mx-auto px-6 py-8">
        
        {/* 🛰 Header: System Status */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Session ID</p>
                <p className="text-xs font-mono text-slate-300">{sessionId?.substring(0, 8)}...</p>
             </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{status}</span>
             </div>
             <div className="w-px h-3 bg-white/10" />
             <div className="flex -space-x-2">
                {Object.keys(participants).map(p => (
                   <div key={p} className="w-5 h-5 rounded-full bg-slate-700 border border-[#0a0c10] flex items-center justify-center text-[8px] font-bold" title="Active Participant">
                      {p.substring(0, 2).toUpperCase()}
                   </div>
                ))}
             </div>
          </div>
        </header>

        {/* 💬 Main Stage: The Question */}
        <main className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
           <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-3xl"
              >
                 <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                    Question {currentIndex + 1}
                 </span>
                 <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                    {currentQuestion || "Initializing the next question..."}
                 </h1>
              </motion.div>
           </AnimatePresence>
        </main>

        {/* 🌊 Experience Layer: Live Transcript & Interaction */}
        <footer className="mt-auto space-y-8 pb-8">
           {/* Transitioning Live Text */}
           <div className="max-w-2xl mx-auto min-h-[60px] text-center">
              {liveBuffer ? (
                 <motion.p 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="text-lg font-medium text-slate-300 italic leading-relaxed"
                 >
                    “{liveBuffer}”
                    <motion.span 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="inline-block w-1.5 h-5 bg-blue-500 ml-1 translate-y-1"
                    />
                 </motion.p>
              ) : (
                 <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">
                    {isProcessing ? "AI is processing your response..." : "Listening for your answer..."}
                 </p>
              )}
           </div>

           {/* Central Control Unit */}
           <div className="flex items-center justify-center gap-8">
              <div className="group relative">
                 <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition-all duration-500" />
                 <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl shadow-blue-500/20 z-10"
                 >
                    <div className="absolute inset-0 rounded-full border border-blue-500/10 animate-[ping_2s_infinite]" />
                    <Mic className="w-8 h-8 text-blue-600" />
                 </motion.button>
              </div>
           </div>

           {/* Mini History Breadcrumbs */}
           <div className="flex justify-center gap-2 overflow-x-auto py-2">
              {transcriptHistory.slice(-5).map((t, idx) => (
                 <div key={idx} className="w-1.5 h-1.5 rounded-full bg-slate-700 mx-0.5" />
              ))}
           </div>
        </footer>

        {/* 📋 Resume Modal Overlay (If State Out of Sync) */}
        <AnimatePresence>
          {status === 'IDLE' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-[#0a0c10]/80 backdrop-blur-xl flex items-center justify-center"
            >
               <div className="text-center space-y-6">
                  <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-8 animate-bounce">
                     <Info className="w-8 h-8 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Syncing Experience</h2>
                  <p className="text-slate-400 text-sm max-w-xs">Connecting to the live interview event stream...</p>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InterviewSession;
