import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, MessageSquare, User, Cpu } from 'lucide-react';
import useInterviewStore from '../store/interviewStore';
import { getSocket } from '../services/socketService';

const TranscriptBox = () => {
  const questionHistory = useInterviewStore((state) => state.questionHistory);
  const currentQuestion = useInterviewStore((state) => state.currentQuestion);
  const sessionId = useInterviewStore((state) => state.sessionId);
  const isProcessing = useInterviewStore((state) => state.isProcessing);
  const liveBuffer = useInterviewStore((state) => state.liveBuffer);
  const scrollRef = useRef(null);

  // Listen for live transcript events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.log('[TranscriptBox] No socket available');
      return;
    }

    console.log('[TranscriptBox] Socket connected:', socket.connected);

    const handleLiveTranscript = (data) => {
      console.log('[TranscriptBox] Received live_transcript_chunk:', data);
      if (data?.text) {
        // Update live buffer
        useInterviewStore.getState().updateLiveBuffer(data.text);
      }
    };

    socket.on('live_transcript_chunk', handleLiveTranscript);

    return () => {
      socket.off('live_transcript_chunk', handleLiveTranscript);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [questionHistory, isProcessing, liveBuffer]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#16171a] rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Conversation</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sessionId ? `${questionHistory.length} exchanges` : 'Waiting'}
            </p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${sessionId ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
          {sessionId ? '● Recording' : 'Idle'}
        </div>
      </div>

      {/* Transcript Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {/* Show current question if session is active but no history yet */}
          {sessionId && currentQuestion && questionHistory.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2.5"
            >
              {/* Current AI Question */}
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">AI Question</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                      CURRENT
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                    {currentQuestion}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Show conversation history */}
          {questionHistory.length === 0 && !sessionId ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  No Conversation Yet
                </p>
                <p className="text-xs text-slate-500 max-w-[220px]">
                  Start an interview to see questions and answers
                </p>
              </div>
            </motion.div>
          ) : (
            questionHistory.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2.5"
              >
                {/* AI Question */}
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">AI Question</span>
                      {item.topic && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          {item.topic}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                      {item.question}
                    </p>
                  </div>
                </div>

                {/* User Answer */}
                <div className="flex gap-2.5 pl-4">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5 block">Your Answer</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2.5 border border-emerald-200 dark:border-emerald-500/20">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}

          {/* Show current question after history if there are previous Q&As */}
          {sessionId && currentQuestion && questionHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2.5 border-t border-slate-200 dark:border-slate-700 pt-4"
            >
              {/* Current AI Question */}
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">AI Question</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                      CURRENT
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                    {currentQuestion}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Live Buffer */}
          {liveBuffer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Listening...</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                "{liveBuffer}"
              </p>
            </motion.div>
          )}

          {/* Processing */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-500"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">AI is processing...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TranscriptBox;
