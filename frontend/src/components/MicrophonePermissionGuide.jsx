import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, AlertCircle, CheckCircle, Chrome, Globe, Lock } from 'lucide-react';

const MicrophonePermissionGuide = ({ onPermissionGranted, onClose }) => {
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt', 'granted', 'denied', 'checking'
  const [browserInfo, setBrowserInfo] = useState({ name: 'Browser', isSecure: false });

  useEffect(() => {
    // Detect browser
    const userAgent = navigator.userAgent;
    let browser = 'Browser';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Check if secure context
    const isSecure = window.isSecureContext || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

    setBrowserInfo({ name: browser, isSecure });

    // Check current permission state
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' })
        .then(result => {
          setPermissionState(result.state);
          result.onchange = () => setPermissionState(result.state);
        })
        .catch(() => setPermissionState('prompt'));
    }
  }, []);

  const requestPermission = async () => {
    setPermissionState('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      setTimeout(() => {
        onPermissionGranted?.();
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      } else {
        setPermissionState('error');
      }
    }
  };

  const getBrowserInstructions = () => {
    const { name } = browserInfo;
    switch (name) {
      case 'Chrome':
      case 'Edge':
        return (
          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
            <li>Click the <strong>camera/microphone icon</strong> in the address bar</li>
            <li>Select <strong>"Always allow"</strong> for microphone access</li>
            <li>Click <strong>"Done"</strong> and refresh the page</li>
          </ol>
        );
      case 'Firefox':
        return (
          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
            <li>Click the <strong>microphone icon</strong> in the address bar</li>
            <li>Select <strong>"Allow"</strong> and check "Remember this decision"</li>
            <li>Refresh the page</li>
          </ol>
        );
      case 'Safari':
        return (
          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
            <li>Go to <strong>Safari → Settings → Websites → Microphone</strong></li>
            <li>Find this website and select <strong>"Allow"</strong></li>
            <li>Refresh the page</li>
          </ol>
        );
      default:
        return (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Please check your browser settings to allow microphone access for this website.
          </p>
        );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8"
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {permissionState === 'granted' ? (
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            ) : permissionState === 'denied' ? (
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mic className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
            {permissionState === 'granted' ? 'Microphone Access Granted!' :
             permissionState === 'denied' ? 'Microphone Access Denied' :
             'Microphone Access Required'}
          </h2>

          {/* Description */}
          <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
            {permissionState === 'granted' ? 
              'You can now use voice recording features.' :
             permissionState === 'denied' ?
              'Please enable microphone access to use voice features.' :
              'We need access to your microphone for voice recording and transcription.'}
          </p>

          {/* Security Notice */}
          {!browserInfo.isSecure && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                  Secure Connection Required
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Microphone access requires HTTPS. Please use https:// or localhost.
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          {permissionState === 'denied' && (
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                How to Enable in {browserInfo.name}
              </h3>
              {getBrowserInstructions()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {permissionState === 'granted' ? (
              <button
                onClick={onClose}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Continue
              </button>
            ) : permissionState === 'denied' ? (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={requestPermission}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Try Again
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={requestPermission}
                  disabled={permissionState === 'checking' || !browserInfo.isSecure}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {permissionState === 'checking' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Allow Microphone
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-slate-500 dark:text-slate-500 mt-4">
            Your privacy is important. We only access your microphone when you're actively recording.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MicrophonePermissionGuide;
