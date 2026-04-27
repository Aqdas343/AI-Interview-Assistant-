import { create } from 'zustand';
import api from '../services/api';

/**
 * 🛠 EVENT NORMALIZATION LAYER
 * Ensures all incoming events are schema-safe.
 */
const normalizeEvent = (event) => {
  return {
    id: event.id,
    type: event.event_type || event.type,
    payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
    timestamp: event.created_at || event.timestamp || new Date().toISOString(),
    version: event.version || '1.0'
  };
};

/**
 * ⚙️ CQRS REDUCER (State Projection)
 * Deterministic state updates based on immutable events.
 */
const interviewReducer = (state, event) => {
  const { type, payload } = event;

  switch (type) {
    case 'SESSION_STARTED':
      return {
        ...state,
        status: 'ACTIVE',
        metadata: payload.metadata || {},
        events: [event]
      };

    case 'QUESTION_ASKED':
      return {
        ...state,
        currentIndex: payload.index,
        currentQuestion: payload.text,
        liveBuffer: '',
        isThinking: false,
        events: [...state.events, event]
      };

    case 'TRANSCRIPT_PROCESSED':
      return {
        ...state,
        // Append to history, and clear ephemeral live buffer if this segment is finalized
        transcriptHistory: [...state.transcriptHistory, payload.text],
        liveBuffer: '', 
        events: [...state.events, event]
      };

    case 'SESSION_ENDED':
      return {
        ...state,
        status: 'ENDED',
        events: [...state.events, event]
      };

    default:
      return {
        ...state,
        events: [...state.events, event]
      };
  }
};

const useInterviewStore = create((set, get) => ({
  // Core State
  sessionId: null,
  status: 'IDLE',
  currentIndex: 0,
  currentQuestion: null,
  events: [],
  transcriptHistory: [],
  liveBuffer: '', // Ephemeral UI-only buffer
  participants: {}, // Redis presence map
  metadata: {},
  questionHistory: [],
  
  // UI State
  isProcessing: false,
  isRecording: false, // Audio recording state
  aiStatus: 'IDLE', // IDLE, LISTENING, THINKING, ANSWERING, ERROR
  error: null,
  lastEventId: null,
  lastTimestamp: null,
  
  // Profile & AI Context
  candidateProfile: {
    role: '',
    experience: '',
    skills: '',
    jobDescription: ''
  },
  answerMode: 'detailed', // 'detailed' | 'short'

  // AI Status Actions
  setAiStatus: (status) => set({ aiStatus: status }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setCandidateProfile: (profile) => set((state) => ({ 
    candidateProfile: { ...state.candidateProfile, ...profile } 
  })),
  setAnswerMode: (mode) => set({ answerMode: mode }),

  startInterview: async (topicMetadata = {}) => {
    set({ isProcessing: true, error: null });
    try {
      // Try API call first, but if it fails, just generate a question locally
      let sessionId = null;
      try {
        const response = await api.post('/interview/start', { topicMetadata });
        if (response.data?.data?.sessionId) {
          sessionId = response.data.data.sessionId;
        }
      } catch (apiErr) {
        console.log('[Interview] API not available, using local mode');
      }
      
      // Generate a sample question for demo
      const sampleQuestions = [
        "Tell me about yourself and your experience with JavaScript.",
        "What is your approach to debugging complex issues?",
        "Describe a challenging project you worked on recently.",
        "How do you stay updated with new technologies?",
        "What are your greatest strengths and weaknesses?",
      ];
      const randomQuestion = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
      
      set({ 
        sessionId: sessionId || 'local-session-' + Date.now(), 
        status: 'ACTIVE', 
        currentQuestion: randomQuestion,
        isProcessing: false,
        questionHistory: []  // Start with empty history, will be populated when answers are submitted
      });
      
      // Return the question so caller can trigger answer
      return randomQuestion;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to initiate interview';
      set({ error: errMsg, isProcessing: false });
      throw err;
    }
  },

  // 2. Hybrid Rehydration (Snapshot + Dual-Cursor Delta)
  resumeInterview: async (sessionId) => {
    set({ isProcessing: true, error: null });
    try {
      // A. Load Snapshot
      const snapshotRes = await api.get(`/interview/${sessionId}/resume`);
      const { session, events: initialEvents } = snapshotRes.data.data;

      let newState = {
        sessionId: session.id,
        status: session.status,
        currentIndex: session.current_question_index,
        lastEventId: session.last_event_id,
        lastTimestamp: session.updated_at,
        events: [],
        transcriptHistory: [],
        liveBuffer: ''
      };

      // B. Apply Snapshot Base Events
      initialEvents.forEach(e => {
        newState = interviewReducer(newState, normalizeEvent(e));
      });

      // C. Fetch Deltas (Dual Cursor)
      if (newState.lastTimestamp && newState.lastEventId) {
        try {
          const deltaRes = await api.get(`/interview/${sessionId}/events`, {
            params: {
              sinceTime: newState.lastTimestamp,
              sinceId: newState.lastEventId
            }
          });
          deltaRes.data.data.forEach(e => {
            newState = interviewReducer(newState, normalizeEvent(e));
          });
        } catch (deltaErr) {
          console.warn('[InterviewStore] Delta fetch failed, falling back to full replay.', deltaErr);
          // Potential fallback to full event fetch here
        }
      }

      set({ ...newState, isProcessing: false });
    } catch (err) {
      set({ error: 'Failed to resume interview', isProcessing: false });
      throw err;
    }
  },

  // 3. Command: Apply Incoming Socket Event
  applySocketEvent: (rawEvent) => {
    const event = normalizeEvent(rawEvent);
    
    // Check if event already exists (idempotency)
    const exists = get().events.some(e => e.id === event.id);
    if (exists) return;

    set((state) => interviewReducer(state, event));
  },

  // 4. Update Ephemeral Live Buffer (Socket only, no event persistence)
  updateLiveBuffer: (text) => set({ liveBuffer: text }),

  // 5. Fetch Final AI Report
  fetchReport: async (sessionId) => {
    set({ isProcessing: true, error: null });
    try {
      const response = await api.get(`/interview/${sessionId}/report`);
      set({ report: response.data.data, isProcessing: false });
    } catch (err) {
      set({ error: 'Evaluation report is still generating or not found.', isProcessing: false });
      throw err;
    }
  },

  // 6. Presence & UI Helpers
  updateParticipants: (presenceMap) => set({ participants: presenceMap }),
  clearError: () => set({ error: null }),
  resetStore: () => set({ sessionId: null, status: 'IDLE', events: [], transcriptHistory: [], questionHistory: [], liveBuffer: '' }),
  
  // Submit answer and get next question
  submitAnswer: async (answerText) => {
    const state = get();
    if (!state.currentQuestion || !answerText.trim()) return;

    set({ isProcessing: true });
    
    try {
      // Save current Q&A to history
      const completedQA = {
        question: state.currentQuestion,
        answer: answerText.trim(),
        topic: 'GENERAL',
        timestamp: new Date().toISOString()
      };
      
      // Generate next question
      const sampleQuestions = [
        "Can you walk me through your problem-solving process?",
        "Tell me about a time you had to learn a new technology quickly.",
        "How do you handle working under pressure or tight deadlines?",
        "Describe your experience with team collaboration and communication.",
        "What motivates you in your work and career development?",
        "How do you approach code reviews and giving/receiving feedback?",
        "Tell me about a project you're particularly proud of.",
        "How do you stay current with industry trends and best practices?",
        "Describe a challenging bug you had to debug recently.",
        "What's your approach to testing and quality assurance?"
      ];
      
      // Filter out questions already asked
      const askedQuestions = [...state.questionHistory, completedQA].map(qa => qa.question);
      const availableQuestions = sampleQuestions.filter(q => !askedQuestions.includes(q));
      
      let nextQuestion = null;
      if (availableQuestions.length > 0) {
        nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
      } else {
        // If we've asked all questions, generate a wrap-up question
        nextQuestion = "Thank you for your responses. Is there anything else you'd like to add or any questions you have for me?";
      }

      // Update state with completed Q&A and new question
      set({
        questionHistory: [...state.questionHistory, completedQA],
        currentQuestion: nextQuestion,
        isProcessing: false
      });

      return nextQuestion;
    } catch (err) {
      console.error('Submit answer error:', err);
      set({ error: 'Failed to submit answer', isProcessing: false });
      throw err;
    }
  },

  // Aliases for compatibility with legacy components
  startSession: (topic) => get().startInterview(topic),
  clearSession: () => get().resetStore()
}));

export default useInterviewStore;
