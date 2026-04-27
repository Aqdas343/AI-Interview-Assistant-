import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantPanel from '../components/AssistantPanel';
import TranscriptBox from '../components/TranscriptBox';
import LiveAnswerBox from '../components/LiveAnswerBox';
import SystemDashboard from '../components/SystemDashboard';
import { LogOut, Brain, Settings, User, ChevronDown, Play, MessageCircle, BarChart3, HelpCircle, X, Activity, Wifi, WifiOff } from 'lucide-react';
import { initSocket, disconnectSocket, getConnectionStatus } from '../services/socketService';
import useAuthStore from '../store/authStore';
import useInterviewStore from '../store/interviewStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuthStore();
  const { sessionId, questionHistory } = useInterviewStore();
  const { t, i18n } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    try {
      // Initialize socket with a default session for dashboard
      initSocket('dashboard-session');
    } catch (e) {
      console.error("Socket Error", e);
    }
    
    // Monitor connection status
    const checkConnection = () => {
      setConnectionStatus(getConnectionStatus());
    };
    
    // Check connection status every 5 seconds
    const statusInterval = setInterval(checkConnection, 5000);
    
    // Listen for socket events
    const handleConnect = () => setConnectionStatus('connected');
    const handleDisconnect = () => setConnectionStatus('disconnected');
    
    window.addEventListener('socket-connected', handleConnect);
    window.addEventListener('socket-disconnected', handleDisconnect);
    
    return () => {
      disconnectSocket();
      clearInterval(statusInterval);
      window.removeEventListener('socket-connected', handleConnect);
      window.removeEventListener('socket-disconnected', handleDisconnect);
    };
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#111111] border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">Interview Coach</span>
          </Link>
          
          {/* Session Status */}
          {sessionId && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Session Active</span>
            </div>
          )}
          
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            connectionStatus === 'connected' 
              ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' 
              : connectionStatus === 'connecting'
              ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20'
              : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
          }`}>
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            ) : connectionStatus === 'connecting' ? (
              <Wifi className="w-3 h-3 text-yellow-600 dark:text-yellow-400 animate-pulse" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-600 dark:text-red-400" />
            )}
            <span className={`text-xs font-medium ${
              connectionStatus === 'connected' 
                ? 'text-blue-700 dark:text-blue-400' 
                : connectionStatus === 'connecting'
                ? 'text-yellow-700 dark:text-yellow-400'
                : 'text-red-700 dark:text-red-400'
            }`}>
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            to="/chat"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:block">Chat</span>
          </Link>
          
          <button 
            onClick={toggleLanguage}
            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {i18n.language === 'en' ? 'EN' : 'ES'}
          </button>

          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-sm font-semibold text-white">{user?.username?.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium hidden sm:block">{user?.username}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 top-full mt-2 w-48 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50"
                >
                  <button 
                    onClick={() => { setShowSettings(true); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button 
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Help
                  </button>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left: Session Control + System */}
          <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
            <div className="flex-1 min-h-0">
              <AssistantPanel />
            </div>
            <div className="h-[280px] shrink-0">
              <SystemDashboard />
            </div>
          </div>

          {/* Center: Transcript */}
          <div className="lg:col-span-5 min-h-0">
            <TranscriptBox />
          </div>

          {/* Right: AI Answers */}
          <div className="lg:col-span-4 min-h-0">
            <LiveAnswerBox />
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 m-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Language</p>
                      <p className="text-sm text-gray-500">Choose your preferred language</p>
                    </div>
                    <button 
                      onClick={toggleLanguage}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
                    >
                      {i18n.language === 'en' ? 'Español' : 'English'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-sm text-gray-500">Receive interview reminders</p>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-emerald-600 relative">
                      <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Sound Effects</p>
                      <p className="text-sm text-gray-500">Play sounds for notifications</p>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-slate-600 relative">
                      <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                <button 
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;