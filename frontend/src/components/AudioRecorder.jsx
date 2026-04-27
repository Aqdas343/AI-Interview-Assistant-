import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import useInterviewStore from '../store/interviewStore';
import toast from 'react-hot-toast';
import { getSocket } from '../services/socketService';
import useAuthStore from '../store/authStore';

const AudioRecorder = () => {
  const { isRecording, setIsRecording, submitAnswer, isProcessing, currentQuestion, candidateProfile, answerMode } = useInterviewStore();
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Your browser does not support audio recording. Please use Chrome, Firefox, or Edge.');
        return;
      }

      // Check if we're on HTTPS or localhost
      const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isSecureContext) {
        toast.error('Microphone access requires HTTPS. Please use https:// or localhost.');
        return;
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Audio level analyser
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 128);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          
          const socket = getSocket();
          if (socket) {
            const buffer = await e.data.arrayBuffer();
            socket.emit('audio-chunk', { 
               audioBuffer: buffer, 
               context: currentQuestion,
               profile: candidateProfile,
               answerMode: answerMode
            });
          }
        }
      };
      
      // Stream audio every 500ms for low latency processing
      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      
      // Provide specific error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.', {
          duration: 5000
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        toast.error('Microphone is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        toast.error('Microphone constraints not supported. Trying basic settings...');
        // Retry with basic settings
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          // Continue with the rest of the setup...
          const ctx = new AudioContext();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const tick = () => {
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setAudioLevel(avg / 128);
            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();

          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          chunksRef.current = [];
          recorder.ondataavailable = async (e) => {
            if (e.data && e.data.size > 0) {
              chunksRef.current.push(e.data);
              
              const socket = getSocket();
              if (socket) {
                const buffer = await e.data.arrayBuffer();
                socket.emit('audio-chunk', { 
                   audioBuffer: buffer, 
                   context: currentQuestion,
                   profile: candidateProfile,
                   answerMode: answerMode
                });
              }
            }
          };
          
          recorder.start(500);
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
          toast.success('Recording started with basic settings.');
        } catch (retryErr) {
          toast.error('Failed to start recording. Please check your microphone.');
        }
      } else if (err.name === 'SecurityError') {
        toast.error('Security error: Please ensure you are using HTTPS or localhost.');
      } else {
        toast.error(`Microphone error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      toast.success('Recording stopped.');
    };
    mediaRecorderRef.current.stop();
  };

  const handleSubmit = async () => {
    const store = useInterviewStore.getState();
    const answerText = transcript.trim() || store.liveBuffer.trim();
    
    if (!answerText) {
      toast.error('Please provide an answer first');
      return;
    }
    
    try {
      const nextQuestion = await submitAnswer(answerText);
      setTranscript('');
      // Clear live buffer
      store.updateLiveBuffer('');
      toast.success('Answer submitted!');
      
      // Trigger AI answer generation for the next question
      if (nextQuestion) {
        const socket = getSocket();
        if (socket && socket.connected) {
          console.log('[AudioRecorder] Emitting next question for AI answer:', nextQuestion);
          
          // Add a small delay to ensure socket is properly joined to session
          setTimeout(() => {
            const currentSocket = getSocket();
            if (currentSocket && currentSocket.connected) {
              console.log('[AudioRecorder] Socket ready, emitting direct-question');
              currentSocket.emit('direct-question', { 
                question: nextQuestion, 
                sessionId: store.sessionId || 'dashboard-session',
                userId: useAuthStore.getState().user?.id || 'dashboard-user'
              });
            } else {
              console.warn('[AudioRecorder] Socket not ready for direct-question');
            }
          }, 100);
        } else {
          console.warn('[AudioRecorder] Socket not connected, cannot emit direct-question');
        }
      }
    } catch (err) {
      console.error('Submit answer error:', err);
      toast.error('Failed to submit answer.');
    }
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const bars = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="flex flex-col gap-4">
      {/* Waveform Visualizer */}
      <div className="flex items-center justify-center gap-[3px] h-10">
        {bars.map((i) => (
          <motion.div
            key={i}
            className={`w-1 rounded-full ${isRecording ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
            animate={{
              height: isRecording
                ? `${Math.max(4, Math.random() * audioLevel * 36 + 4)}px`
                : '4px'
            }}
            transition={{ duration: 0.1, delay: i * 0.01 }}
          />
        ))}
      </div>

      {/* Record / Stop Button */}
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all ${
            isRecording
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {isRecording ? (
            <>
              <MicOff className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              {isProcessing ? 'Processing...' : 'Start Recording'}
            </>
          )}
        </motion.button>
        
        {/* Submit Answer Button */}
        {!isRecording && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const store = useInterviewStore.getState();
              if (store.liveBuffer && store.liveBuffer.trim()) {
                handleSubmit();
              } else {
                toast.error('Please record your answer first');
              }
            }}
            disabled={isProcessing}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Submit
          </motion.button>
        )}
      </div>

      {/* Transcript Box */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative"
          >
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full h-24 text-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="Transcription will appear here..."
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={isProcessing || !transcript.trim()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-50 transition-all"
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {isProcessing ? 'Submitting...' : 'Submit'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AudioRecorder;
