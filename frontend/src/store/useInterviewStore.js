import { create } from 'zustand';

const useInterviewStore = create((set) => ({
  status: 'idle', // 'idle', 'ongoing', 'paused', 'completed'
  transcript: [],
  hints: [],
  metrics: {
    score: 0,
    fluency: 0,
    technical: 0,
  },
  
  setStatus: (status) => set({ status }),
  
  addTranscript: (entry) => set((state) => ({ 
    transcript: [...state.transcript, { 
      id: Date.now(), 
      timestamp: new Date().toLocaleTimeString(),
      ...entry 
    }] 
  })),
  
  addHint: (hint) => set((state) => ({ 
    hints: [hint, ...state.hints].slice(0, 5) // Keep last 5 hints
  })),
  
  updateMetrics: (newMetrics) => set((state) => ({
    metrics: { ...state.metrics, ...newMetrics }
  })),

  resetInterview: () => set({
    status: 'idle',
    transcript: [],
    hints: [],
    metrics: { score: 0, fluency: 0, technical: 0 }
  })
}));

export default useInterviewStore;
