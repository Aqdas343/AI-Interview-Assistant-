import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isElectron = !!(window.require && window.require('electron'));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { data } = await api.post('/auth/login', { email, password });
      
      setAuth({ username: data.username, id: data.userId, email: data.email, role: data.role }, data.token, data.refreshToken);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    
    console.log('[GOOGLE_LOGIN] Starting Google login...');
    console.log('[GOOGLE_LOGIN] Credential received:', !!credentialResponse.credential);
    
    try {
      console.log('[GOOGLE_LOGIN] Sending credential to backend...');
      const { data } = await api.post('/auth/social/google', { 
        credential: credentialResponse.credential 
      });
      
      console.log('[GOOGLE_LOGIN] Backend response received:', data);
      
      setAuth(
        { username: data.username, id: data.userId, email: data.email, role: data.role }, 
        data.token, 
        data.refreshToken
      );

      console.log('[GOOGLE_LOGIN] Login successful, redirecting...');
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      console.error('[GOOGLE_LOGIN_ERROR] Full error:', err);
      console.error('[GOOGLE_LOGIN_ERROR] Response:', err.response?.data);
      
      let errorMsg = 'Google authentication failed. Please try again.';
      
      // Handle specific error cases from backend
      if (err.response?.data?.message) {
        const backendMsg = err.response.data.message;
        
        if (backendMsg.includes('Google sign-in is temporarily unavailable due to network issues')) {
          errorMsg = 'Google sign-in is currently unavailable. Please use email login below.';
        } else if (backendMsg.includes('Unable to connect to Google services')) {
          errorMsg = 'Cannot connect to Google services. Please try email login below.';
        } else if (backendMsg.includes('network')) {
          errorMsg = 'Network connection issue. Please try email login below.';
        } else if (backendMsg.includes('token is invalid')) {
          errorMsg = 'Google authentication failed. Please try again or use email login.';
        } else if (backendMsg.includes('origin_mismatch')) {
          errorMsg = 'Origin Mismatch: Please ensure http://localhost:5174 is authorized in your Google Cloud Console.';
        } else {
          errorMsg = backendMsg;
        }
      } else if (err.message) {
        if (err.message.includes('Network Error')) {
          errorMsg = 'Network error. Please use email login below.';
        } else if (err.message.includes('timeout')) {
          errorMsg = 'Request timeout. Please try email login or try again later.';
        } else {
          errorMsg = err.message;
        }
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#fcfdfe] font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] bg-white rounded-3xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.02)]"
      >
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-bold text-[#0f172a] mb-2 tracking-tight">Welcome back</h1>
          <p className="text-[16px] text-[#64748b]">Sign in to continue your journey</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-10">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#0f172a] mb-2">Access Granted</h2>
            <p className="text-[#64748b]">Synchronizing your workspace...</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 text-red-600 text-[13px] font-medium border border-red-100 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#334155] ml-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-[#94a3b8] group-focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-[15px]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[14px] font-semibold text-[#334155]">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <Link to="/forgot-password" size="sm" className="text-[13px] font-bold text-indigo-600 hover:text-indigo-700">
                    Forgot?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[#94a3b8] group-focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-11 py-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-[15px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#94a3b8] hover:text-[#64748b]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:bg-indigo-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] text-[16px] mt-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e2e8f0]"></div>
              </div>
              <div className="relative flex justify-center text-[12px] uppercase">
                <span className="bg-white px-4 text-[#94a3b8] font-bold tracking-wider">or continue with</span>
              </div>
            </div>

            <div className="flex justify-center flex-col items-center">
               {isElectron ? (
                 <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[12px] text-amber-800 text-center">
                    Google Login is restricted in the desktop app for security. 
                    <strong> Please sign in through your web browser</strong> at 
                    <span className="block mt-1 font-mono text-indigo-600">http://localhost:5174</span>
                 </div>
               ) : (
                 <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={(error) => {
                      console.error('[GOOGLE_LOGIN] Google Login Error:', error);
                      setError('Google sign-in failed. Please use email login below or try again later.');
                    }}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    text="continue_with"
                    shape="pill"
                    width="380"
                  />
               )}
            </div>

            <div className="mt-10 text-center">
              <p className="text-[15px] text-[#64748b]">
                Don't have an account? {' '}
                <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-bold">
                  Sign up
                </Link>
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
