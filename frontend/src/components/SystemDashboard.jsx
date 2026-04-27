import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Shield, Cpu, Clock, RefreshCw, TrendingUp, BarChart2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useInterviewStore from '../store/interviewStore';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-[10px] px-3 py-2 rounded-xl font-black shadow-lg">
        Score: {payload[0].value}
      </div>
    );
  }
  return null;
};

const SystemDashboard = () => {
  const { user, token, refreshToken: storedRefresh, setAuth, logout } = useAuthStore();
  const { candidateProfile, setCandidateProfile, answerMode, setAnswerMode } = useInterviewStore();
  const [status, setStatus] = useState(null);
  const [uptime, setUptime] = useState(0);
  const [tokenTtl, setTokenTtl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('system'); // 'system' | 'analytics'
  const uptimeRef = useRef(null);

  // Parse token expiry
  useEffect(() => {
    if (!token || !token.includes('.')) return;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return;
      
      // Safe base64 decoding for URL-safe JWT payloads
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')));

      const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);
      setTokenTtl(Math.max(0, ttlSeconds));
    } catch (e) {
      console.warn('[Dashboard] Token decoding failed', e);
      setTokenTtl(null);
    }
  }, [token]);

  // Countdown token TTL
  useEffect(() => {
    if (tokenTtl === null) return;
    const id = setInterval(() => setTokenTtl(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [tokenTtl]);

  // Uptime counter
  useEffect(() => {
    uptimeRef.current = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(uptimeRef.current);
  }, []);

  // Load health
  useEffect(() => {
    const load = async () => {
      try {
        const healthRes = await api.get('/health').catch(() => api.get('/v1/health'));
        setStatus(healthRes.data);
      } catch (e) {
        console.error('Health load error', e);
      }
    };
    load();
  }, []);

  // Load analytics
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get('/analytics/performance');
      setAnalytics(res.data.data);
    } catch (e) {
      console.error('Analytics load error', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab]);

  const handleRefreshToken = async () => {
    if (!storedRefresh) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken: storedRefresh });
      setAuth(user, data.token, data.refreshToken);
      
      // Safe re-parse
      const base64 = data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      setTokenTtl(Math.max(0, payload.exp - Math.floor(Date.now() / 1000)));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;
  const ttlPercent = tokenTtl !== null ? Math.round((tokenTtl / 900) * 100) : 0;
  const ttlColorClass = ttlPercent > 50 ? 'bg-emerald-500' : ttlPercent > 20 ? 'bg-amber-500' : 'bg-rose-500';
  const ttlTextClass = ttlPercent > 50 ? 'text-emerald-500' : ttlPercent > 20 ? 'text-amber-500' : 'text-rose-500';

  // Build recharts data
  const progressData = (analytics?.progress || []).map((v, i) => ({ q: `Q${i + 1}`, score: v }));
  const topicsData = Object.entries(analytics?.topics || {}).map(([name, score]) => ({ name, score }));
  const topicColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="bg-white dark:bg-[#16171a] rounded-lg border border-slate-200 dark:border-slate-800 h-full overflow-hidden flex flex-col"
    >
      {/* Tab Header */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'system'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Cpu className="w-3 h-3" /> System
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BarChart2 className="w-3 h-3" /> Analytics
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Shield className="w-3 h-3" /> Profile
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">

          {/* ── SYSTEM TAB ────────────────────────────── */}
          {activeTab === 'system' && (
            <motion.div key="system" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Cpu, label: 'Version', value: status?.version || 'v1.0', color: 'bg-blue-600' },
                  { icon: Clock, label: 'Session', value: formatTime(uptime), color: 'bg-slate-600' }
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</div>
                      <div className="text-slate-900 dark:text-white font-semibold text-sm">{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Token TTL */}
              {tokenTtl !== null && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-medium">Session TTL</span>
                    <span className={`text-xs font-medium ${ttlTextClass}`}>{formatTime(tokenTtl)} left</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${ttlPercent}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${ttlColorClass}`}
                    />
                  </div>
                  <button
                    onClick={handleRefreshToken}
                    disabled={loading || !storedRefresh}
                    className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Extend Session
                  </button>
                </div>
              )}

              {/* User Card */}
              <div className="px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold text-sm">{user?.username}</div>
                  <div className="text-slate-500 text-xs font-medium flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-emerald-500" />
                    Authenticated
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ANALYTICS TAB ────────────────────────── */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
                    <span className="text-xs text-slate-500 font-medium">Loading Analytics...</span>
                  </div>
                </div>
              ) : analytics ? (
                <>
                  {/* Average Score */}
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-center">
                    <div className="text-xs text-slate-500 font-medium mb-1">Average Score</div>
                    <div className="text-3xl font-bold text-blue-600">{analytics.averageScore}</div>
                    <div className="text-xs text-slate-500 font-medium mt-1 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      {analytics.improvement} improvement
                    </div>
                  </div>

                  {/* Progress Line Chart */}
                  {progressData.length > 1 && (
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-2">Score Progression</div>
                      <ResponsiveContainer width="100%" height={80}>
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="q" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={20} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 2, fill: '#3b82f6' }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Topic Bar Chart */}
                  {topicsData.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-2">Topic Breakdown</div>
                      <ResponsiveContainer width="100%" height={90}>
                        <BarChart data={topicsData} layout="vertical" barCategoryGap="20%">
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={50} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                            {topicsData.map((_, i) => (
                              <Cell key={i} fill={topicColors[i % topicColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <button
                    onClick={loadAnalytics}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <BarChart2 className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-500 font-medium max-w-[140px]">
                    Complete sessions to see analytics
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PROFILE TAB ──────────────────────────── */}
          {activeTab === 'profile' && (
             <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Candidate Context
                  </div>                 
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Target Role</label>
                    <input 
                      type="text" 
                      value={candidateProfile.role}
                      onChange={(e) => setCandidateProfile({ role: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. Frontend Developer"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Experience Level</label>
                    <input 
                      type="text" 
                      value={candidateProfile.experience}
                      onChange={(e) => setCandidateProfile({ experience: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. 3 years, Mid-Level"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Key Skills</label>
                    <textarea 
                      value={candidateProfile.skills}
                      onChange={(e) => setCandidateProfile({ skills: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white h-16 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. React, Node.js, GraphQL..."
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Job Description</label>
                    <textarea 
                      value={candidateProfile.jobDescription}
                      onChange={(e) => setCandidateProfile({ jobDescription: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white h-20 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Paste job description here..."
                    />
                  </div>

                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-200 dark:border-slate-600">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Answer Style</label>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-0.5">
                      <button
                        onClick={() => setAnswerMode('detailed')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${answerMode === 'detailed' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      >
                        Detailed
                      </button>
                      <button
                        onClick={() => setAnswerMode('short')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${answerMode === 'short' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      >
                        Short
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed pt-1">
                    ✓ Context is used to personalize AI answers in real-time
                  </p>
                </div>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default SystemDashboard;
