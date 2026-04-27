import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  MessageSquare, 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Award,
  Clock
} from 'lucide-react';
import useInterviewStore from '../store/interviewStore';

/**
 * 📊 EVALUATION REPORT (POST-INTERVIEW ANALYTICS)
 * A professional review of the candidate performance.
 * Visualizes the AI evaluation results and session history.
 */
const EvaluationReport = () => {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  
  const {
    report,
    events,
    fetchReport,
    isProcessing,
    error
  } = useInterviewStore();

  useEffect(() => {
    if (sessionId) {
      fetchReport(sessionId);
    }
  }, [sessionId]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center space-y-4">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
           <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analyzing Results...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
           <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto">
              <TrendingDown className="w-10 h-10 text-amber-600" />
           </div>
           <h1 className="text-2xl font-black text-slate-900">Report Pending</h1>
           <p className="text-slate-500 text-sm">Our AI is still finalizing the evaluation. Please check back in a few moments.</p>
           <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-inter text-slate-800 pb-20">
      
      {/* 🏔 Navigation Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-50">
         <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
               <ArrowLeft className="w-4 h-4" />
               <span className="text-sm font-bold uppercase tracking-widest">Dashboard</span>
            </button>
            <div className="text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Interview Report</p>
               <h2 className="text-sm font-bold text-slate-900">Session ID: {sessionId?.substring(0, 12)}...</h2>
            </div>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
               Share Report
            </button>
         </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-10 space-y-12">
         
         {/* 🏆 Result Summary Header */}
         <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="lg:col-span-4 flex flex-col items-center justify-center border-r border-slate-100 pr-10">
               <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                     <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                     <motion.circle 
                        cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="8" 
                        strokeDasharray="282.7"
                        initial={{ strokeDashoffset: 282.7 }}
                        animate={{ strokeDashoffset: 282.7 - (282.7 * report.candidate_score) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                     />
                  </svg>
                  <div className="text-center">
                     <span className="text-5xl font-black text-slate-900 tracking-tighter">{report.candidate_score}</span>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mastery Score</p>
                  </div>
               </div>
               <div className="mt-8 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Award className="w-3.5 h-3.5" /> Highly Recommended
               </div>
            </div>

            <div className="lg:col-span-8 flex flex-col justify-center gap-6">
               <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Evaluation Summary</h3>
               <p className="text-slate-600 text-lg leading-relaxed font-medium">
                  {report.summary}
               </p>
               <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Core Verdict</h4>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                     <p className="text-slate-800 font-bold leading-relaxed">{report.recommendations}</p>
                  </div>
               </div>
            </div>
         </section>

         {/* 🧠 Core Insights (Strengths & Weaknesses) */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-lg shadow-slate-200/50"
            >
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                     <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Key Strengths</h3>
               </div>
               <div className="space-y-4">
                  {report.strengths.map((s, idx) => (
                     <div key={idx} className="flex items-start gap-3 group">
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-slate-700 font-medium group-hover:text-slate-950 transition-colors uppercase tracking-tight text-sm font-black">{s}</p>
                     </div>
                  ))}
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               whileInView={{ opacity: 1, x: 0 }}
               className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-lg shadow-slate-200/50"
            >
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                     <TrendingDown className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Focus Areas</h3>
               </div>
               <div className="space-y-4">
                  {report.weaknesses.map((w, idx) => (
                     <div key={idx} className="flex items-start gap-3 group">
                        <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                        <p className="text-slate-700 font-medium group-hover:text-slate-950 transition-colors uppercase tracking-tight text-sm font-black">{w}</p>
                     </div>
                  ))}
               </div>
            </motion.div>
         </div>

         {/* ⏳ Timeline Analysis */}
         <section className="bg-slate-900 p-10 md:p-14 rounded-[4rem] text-white shadow-2xl shadow-blue-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 space-y-12">
               <div className="flex items-center justify-between">
                  <div>
                     <h3 className="text-3xl font-black tracking-tight mb-2">Chronological Journey</h3>
                     <p className="text-slate-400 font-medium tracking-wide">Event-by-event analysis of the session logic.</p>
                  </div>
                  <Clock className="w-12 h-12 text-slate-700" />
               </div>

               <div className="space-y-8 relative">
                  <div className="absolute left-[27px] top-6 bottom-6 w-px bg-slate-800" />
                  
                  {events && events.length > 0 ? events.filter(e => ['QUESTION_ASKED', 'ANSWER_SUBMITTED'].includes(e.type)).map((e, idx) => (
                     <div key={idx} className="relative flex gap-10 items-start">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 ${e.type === 'QUESTION_ASKED' ? 'bg-blue-600 shadow-xl shadow-blue-600/20' : 'bg-slate-800 border border-slate-700'}`}>
                           {e.type === 'QUESTION_ASKED' ? <MessageSquare className="w-6 h-6 text-white" /> : <ChevronRight className="w-6 h-6 text-slate-400" />}
                        </div>
                        <div className="flex-1 space-y-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {e.type === 'QUESTION_ASKED' ? 'The Prompt' : 'The Candidate Response'}
                           </p>
                           <p className={`text-lg font-bold leading-relaxed ${e.type === 'QUESTION_ASKED' ? 'text-white' : 'text-slate-400'}`}>
                              {e.type === 'QUESTION_ASKED' ? e.payload.text : e.payload.answer}
                           </p>
                        </div>
                     </div>
                  )) : (
                     <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-center py-20">Event history not available in report view.</p>
                  )}
               </div>
            </div>
         </section>
      </main>
    </div>
  );
};

export default EvaluationReport;
