import React, { useState } from 'react';
import { Mic, Square, Play, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useInterviewStore from '../store/interviewStore';
import useAuthStore from '../store/authStore';
import { getSocket } from '../services/socketService';
import AudioRecorder from './AudioRecorder';
import toast from 'react-hot-toast';

const AssistantPanel = () => {
  const { sessionId, currentQuestion, questionHistory, startSession, clearSession, isProcessing } = useInterviewStore();
  const { user } = useAuthStore();
  const isActive = !!sessionId;

  const handleStart = async () => {
    try {
      console.log('[AssistantPanel] Starting session...');
      const question = await startSession();
      console.log('[AssistantPanel] Got question:', question);
      toast.success('Interview session started!');
      
      // Trigger answer generation via socket - wait a bit for socket to be ready
      if (question) {
        const emitQuestion = () => {
          const socket = getSocket();
          console.log('[AssistantPanel] Socket check:', socket?.connected, socket?.id);
          if (socket && socket.connected) {
            console.log('[AssistantPanel] Emitting direct-question:', question);
            socket.emit('direct-question', { 
              question: question, 
              sessionId: sessionId || 'dashboard-session',
              userId: user?.id || 'dashboard-user'
            });
            console.log('[AssistantPanel] Emitted direct-question');
          } else {
            console.log('[AssistantPanel] Socket not connected, retrying in 1s...');
            setTimeout(emitQuestion, 1000);
          }
        };
        
        // Try immediately, then retry
        setTimeout(emitQuestion, 300);
      }
    } catch (err) {
      console.error('Start session error:', err);
      toast.error('Failed to start session: ' + err.message);
    }
  };

  const handleEnd = () => {
    clearSession();
    toast('Session ended. Check your Analytics for results!', { icon: '📊' });
  };

  return (
    <div className="bg-white dark:bg-[#16171a] rounded-lg h-full flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isActive 
              ? 'bg-blue-600' 
              : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            <Mic className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Interview Session</h3>
            <p className={`text-xs ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              {isActive ? '● Live' : 'Ready'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        <AnimatePresence mode="wait">
          {isActive && currentQuestion ? (
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 mb-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Current Question</span>
                {isProcessing && <Loader2 className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-spin ml-auto" />}
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {currentQuestion}
              </p>
            </motion.div>
          ) : !isActive ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Play className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ready to Practice
                </p>
                <p className="text-xs text-slate-500 max-w-[180px]">
                  Start your session to receive interview questions
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3"
          >
            <AudioRecorder />
          </motion.div>
        )}

        {isActive && questionHistory.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {questionHistory.length} question{questionHistory.length !== 1 ? 's' : ''} completed
            </span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Start Interview
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleEnd}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
            End Session
          </button>
        )}
      </div>
    </div>
  );
};

export default AssistantPanel;
