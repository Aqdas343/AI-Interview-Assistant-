import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Clock, 
  MessageSquare, 
  Terminal, 
  Users, 
  Video, 
  AlertCircle,
  Play,
  Square
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useInterviewStore from '../store/interviewStore';
import { initSocket, disconnectSocket } from '../services/socketService';

/**
 * 🛰 INTERVIEW MONITOR (INTERVIEWER VIEW)
 * A professional control center to monitor live AI interviews.
 * Rehydrates state from the backend event log.
 */
const InterviewMonitor = () => {
  const { id: sessionId } = useParams();
  
  const {
    status,
    events,
    currentIndex,
    participants,
    transcriptHistory,
    resumeInterview
  } = useInterviewStore();

  useEffect(() => {
    if (sessionId) {
      resumeInterview(sessionId);
      initSocket(sessionId);
    }
    return () => disconnectSocket();
  }, [sessionId]);

  // Mock Sentiment Data (derived from events in a real scenario)
  const sentimentData = [
    { time: '10:00', score: 80 },
    { time: '10:05', score: 85 },
    { time: '10:10', score: 70 },
    { time: '10:15', score: 90 },
    { time: '10:20', score: 88 },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-300 font-inter font-mediumSelection">
      
      {/* 🚀 Header: Advanced Telemetry */}
      <header className="h-20 border-b border-white/5 bg-[#161b22] px-8 flex items-center justify-between sticky top-0 z-50">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
               </div>
               <div>
                  <h1 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Live Monitor</h1>
                  <p className="text-[11px] font-mono text-slate-500">ID: {sessionId}</p>
               </div>
            </div>

            <div className="h-8 w-px bg-white/5" />

            <div className="flex gap-4">
               <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none mb-1">Presence</span>
                  <div className="flex items-center gap-2">
                     <Users className="w-3.5 h-3.5 text-blue-400" />
                     <span className="text-xs font-bold text-white">{Object.keys(participants).length} Connected</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
              status === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            }`}>
               {status}
            </div>
            <button className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20">
               Terminate Session
            </button>
         </div>
      </header>

      <main className="p-6 grid grid-cols-12 gap-6 h-[calc(100vh-80px)] overflow-hidden">
         
         {/* 📽 Left Panel: Metadata & Candidate Pulse */}
         <div className="col-span-3 space-y-6 flex flex-col min-h-0">
            <div className="bg-[#161b22] border border-white/5 rounded-3xl p-6 space-y-4">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Candidate Profile</h3>
               <div className="space-y-3">
                  <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse" />
                     <div>
                        <p className="text-sm font-bold text-white">Anonymized Candidate</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Candidate UI Connected</p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 bg-[#161b22] border border-white/5 rounded-3xl p-6 flex flex-col">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Live Sentiment</h3>
               <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={sentimentData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#161b22', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '10px' }}
                           itemStyle={{ color: '#3b82f6' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#3b82f6" 
                          strokeWidth={3} 
                          dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                     </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* 📜 Center Panel: THE LIVE EVENT TIMELINE */}
         <div className="col-span-5 flex flex-col min-h-0">
            <div className="flex-1 bg-[#161b22] border border-white/5 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
               <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1c2128]">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                     <Terminal className="w-4 h-4 text-blue-500" /> Event Stream
                  </h3>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-400">
                    {events.length} TOTAL EVENTS
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  <AnimatePresence initial={false}>
                     {events.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                           <MessageSquare className="w-12 h-12 mb-4" />
                           <p className="text-sm font-bold">Waiting for events...</p>
                        </div>
                     )}
                     
                     {[...events].reverse().map((event, idx) => (
                        <motion.div 
                          key={event.id || idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex gap-4 group"
                        >
                           <div className="flex flex-col items-center pt-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500 group-first:animate-ping" />
                              <div className="w-px flex-1 bg-white/5 my-2" />
                           </div>
                           <div className="flex-1 bg-white/[0.02] border border-white/5 p-4 rounded-2xl hover:bg-white/[0.04] transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                 <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{event.type}</span>
                                 <span className="text-[9px] font-mono text-slate-600">{new Date(event.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="text-xs text-slate-300 leading-relaxed font-medium">
                                 {event.type === 'QUESTION_ASKED' && (
                                    <p className="border-l-2 border-blue-500/30 pl-3 py-1">{event.payload.text}</p>
                                 )}
                                 {event.type === 'TRANSCRIPT_PROCESSED' && (
                                    <p className="text-slate-400">"{event.payload.text}"</p>
                                 )}
                                 {event.type === 'SESSION_STARTED' && (
                                    <p className="text-emerald-500 font-bold">Interview engine initialized.</p>
                                 )}
                                 {!['QUESTION_ASKED', 'TRANSCRIPT_PROCESSED', 'SESSION_STARTED'].includes(event.type) && (
                                    <pre className="text-[10px] bg-black/20 p-2 rounded-lg mt-2 overflow-x-auto">
                                       {JSON.stringify(event.payload, null, 2)}
                                    </pre>
                                 )}
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </AnimatePresence>
               </div>
            </div>
         </div>

         {/* 🕵️‍♂️ Right Panel: Control & Direct Notes */}
         <div className="col-span-4 space-y-6 flex flex-col min-h-0">
            <div className="flex-1 bg-[#161b22] border border-white/5 rounded-3xl p-6 flex flex-col overflow-hidden">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Live Session Transcript</h3>
               <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {transcriptHistory.map((line, idx) => (
                     <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-400">
                        {line}
                     </div>
                  ))}
               </div>
            </div>

            <div className="h-[200px] shrink-0 bg-blue-600 rounded-3xl p-6 flex flex-col justify-between shadow-2xl shadow-blue-600/20">
               <div>
                  <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-2">Next Stage</h3>
                  <p className="text-lg font-bold text-white leading-tight">Proceed to Technical Deep-Dive on React Hooks?</p>
               </div>
               <button className="w-full py-3 bg-white text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <Play className="w-4 h-4 fill-current" /> Next Question
               </button>
            </div>
         </div>
      </main>
    </div>
  );
};

export default InterviewMonitor;
