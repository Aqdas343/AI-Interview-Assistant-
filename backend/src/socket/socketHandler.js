const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const { setCache } = require('../utils/redisCache');

// ─── Config ───────────────────────────────────────────────────────
const TRANSCRIPTION_INTERVAL_MS = 2500;
const TRIGGER_COOLDOWN_MS       = 1500; // reduced — allow faster follow-up questions
const MAX_TRIGGERS_PER_MIN      = 20;   // increased for interview use
const MIN_BUFFER_CHARS          = 15;
const MAX_BUFFER_CHARS          = 800;

// ─── In-memory session states ─────────────────────────────────────
const sessionStates = new Map();

const getState = (sessionId) => {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      buffer:                  '',
      lastNormalized:          '',
      lastTranscriptionAt:     0,
      lastTriggerAt:           0,
      triggersThisMinute:      0,
      minuteWindowStart:       Date.now(),
      streamId:                0,
      memory:                  [],
      keywords:                [], // Extracted important keywords
    });
  }
  return sessionStates.get(sessionId);
};

// ─── Helpers ──────────────────────────────────────────────────────
const normalize = (t) => t.toLowerCase().replace(/[^\w\s]/g, '').trim();

const cleanDupes = (text) => text.replace(/\b(\w+)\s+\1\b/gi, '$1');

const isRateLimited = (state) => {
  const now = Date.now();
  if (now - state.minuteWindowStart > 60_000) {
    state.triggersThisMinute = 0;
    state.minuteWindowStart  = now;
  }
  if (state.triggersThisMinute >= MAX_TRIGGERS_PER_MIN) return true;
  if (now - state.lastTriggerAt < TRIGGER_COOLDOWN_MS)   return true;
  return false;
};

// ─── Main handler ─────────────────────────────────────────────────
const handleSocketEvents = (io) => {
  io.on('connection', (socket) => {
    logger.info(`[Socket] Connected: ${socket.id}`);

    // ── join_session ─────────────────────────────────────────────
    socket.on('join_session', (data) => {
      const { sessionId, userId } = data || {};
      if (!sessionId) return socket.emit('error', { message: 'sessionId required' });

      socket.join(sessionId);
      socket.sessionId = sessionId;
      logger.info(`[Socket] ${userId || 'anon'} joined session ${sessionId}`);
      socket.emit('session_joined', { sessionId });
    });

    // ── direct-question (from Web Speech API — no transcription needed) ──
    socket.on('direct-question', async (data) => {
      const { question, sessionId, userId, personality, explanationMode, customMemory = [], sessionMemory = [] } = data || {};
      if (!question || !sessionId) {
        logger.warn('[Socket] direct-question missing question or sessionId', data);
        return socket.emit('answer_error', { message: 'Missing question or sessionId' });
      }

      logger.info(`[Socket] 📥 Received direct-question: "${question}" (personality: ${personality || 'default'}, explanation: ${explanationMode}, customMemory: ${customMemory.length}, sessionMemory: ${sessionMemory.length})`);
      logger.info(`[Socket] 📥 Socket ID: ${socket.id}, Rooms:`, Array.from(socket.rooms));

      const state = getState(sessionId);
      const now   = Date.now();

      if (isRateLimited(state)) {
        logger.debug('[Socket] direct-question rate-limited');
        return;
      }

      const norm = normalize(question);
      if (norm === state.lastNormalized) {
        logger.debug('[Socket] Duplicate question, skipping');
        return;
      }

      state.lastNormalized    = norm;
      state.lastTriggerAt     = now;
      state.triggersThisMinute++;

      logger.info(`[Socket] ✅ Processing question: "${question}"`);

      // Emit live transcript so frontend shows what was heard
      socket.emit('live_transcript_chunk', { text: question });

      state.streamId++;
      const myStreamId = state.streamId;

      logger.info(`[Socket] 📤 Emitting answer_start for: "${question}" to room ${sessionId}`);
      // Emit to room only (socket is already in the room, so it will receive it)
      io.to(sessionId).emit('answer_start', { question });
      logger.info(`[Socket] ✅ answer_start emitted, socket rooms:`, Array.from(socket.rooms));

      // Extract keywords from the question for memory
      const extractedKeywords = aiService.extractKeywords(question);
      if (extractedKeywords.length > 0) {
        logger.info(`[Socket] 🔑 Extracted keywords:`, extractedKeywords.map(k => `${k.type}:${k.value}`));
        // Add keywords to state.keywords
        state.keywords = state.keywords || [];
        for (const kw of extractedKeywords) {
          if (!state.keywords.find(k => k.type === kw.type && k.value.toLowerCase() === kw.value.toLowerCase())) {
            state.keywords.push(kw);
          }
        }
        // Keep max 20 keywords
        if (state.keywords.length > 20) state.keywords = state.keywords.slice(-20);
      }

      logger.info(`[Socket] 🔄 Calling AI service...`);
      try {
        // Build keyword context string for AI
        const keywordContext = state.keywords?.length 
          ? `\n\nUser's profile (remember this): ${state.keywords.map(k => `${k.type}: ${k.value}`).join(', ')}`
          : '';

        // Combine: custom memory + session memory (from frontend localStorage) + keyword context
        const combinedMemory = [
          ...customMemory.map(m => ({ role: 'user', content: m.q })),
          ...customMemory.map(m => ({ role: 'assistant', content: m.a })),
          ...sessionMemory,
          ...state.memory
        ];

        logger.info(`[Socket] 🔄 Calling generateLiveAnswerStream with question: "${question.substring(0, 50)}..."`);
        
        // Pass memory, personality, and explanation mode to AI
        const fullAnswer = await aiService.generateLiveAnswerStream(
          question, '', { personality, explanationMode, keywordContext }, (chunk) => {
            if (state.streamId === myStreamId) {
              logger.info(`[Socket] 📤 Emitting answer_chunk, length: ${chunk?.length}, to room ${sessionId}`);
              // Emit to room only (socket is already in the room)
              io.to(sessionId).emit('answer_chunk', { chunk });
            }
          },
          combinedMemory // pass combined memory
        );

        logger.info(`[Socket] 🔄 AI returned answer, length: ${fullAnswer?.length}`);
        
        if (state.streamId === myStreamId) {
          logger.info(`[Socket] 📤 Emitting answer_end, answer length: ${fullAnswer?.length}, to room ${sessionId}`);
          // Emit to room only (socket is already in the room)
          io.to(sessionId).emit('answer_end', { question, answer: fullAnswer, timestamp: new Date() });
          state.memory.push({ role: 'user', content: question });
          state.memory.push({ role: 'assistant', content: fullAnswer });
          if (state.memory.length > 12) state.memory.splice(0, 2);
        }
      } catch (err) {
        logger.error('[Socket] direct-question AI error:', err.message);
        io.to(sessionId).emit('answer_error', { message: err.message || 'AI failed to respond. Please try again.' });
      }
    });

    // ── heartbeat ────────────────────────────────────────────────
    socket.on('heartbeat', async (data) => {
      const { userId, sessionId, deviceId } = data || {};
      if (!userId || !sessionId) return;
      try {
        await setCache(
          `presence:${sessionId}:${userId}`,
          { socketId: socket.id, deviceId: deviceId || 'unknown', lastActiveAt: new Date().toISOString() },
          60
        );
      } catch (_) {}
    });

    // ── clear-keywords ───────────────────────────────────────────
    socket.on('clear-keywords', (data) => {
      const { sessionId } = data || {};
      if (!sessionId) return;
      const state = getState(sessionId);
      state.keywords = [];
      logger.info(`[Socket] Cleared keywords for session ${sessionId}`);
    });

    // ── audio-chunk ──────────────────────────────────────────────
    socket.on('audio-chunk', async (data) => {
      const { audio, sessionId, userId, mimeType } = data || {};
      if (!audio || !sessionId) return;

      const state = getState(sessionId);
      const now   = Date.now();

      // ── Rate-limit transcription calls ──────────────────────
      if (now - state.lastTranscriptionAt < TRANSCRIPTION_INTERVAL_MS) return;

      // ── Minimum size check — skip silence/tiny chunks ────────
      const byteLength = audio.byteLength || audio.length || 0;
      if (byteLength < 5000) {
        logger.debug(`[Socket] Audio chunk too small (${byteLength} bytes), skipping`);
        return;
      }

      state.lastTranscriptionAt = now;

      // ── Transcribe ──────────────────────────────────────────
      let transcript = '';
      try {
        transcript = await aiService.transcribeAudio(audio, mimeType);
      } catch (err) {
        logger.error('[Socket] Transcription threw:', err.message);
        return;
      }

      if (!transcript || !transcript.trim()) return;

      transcript = cleanDupes(transcript.trim());
      logger.info(`[Socket] Transcript: "${transcript}"`);

      // ── Emit live transcript to frontend ────────────────────
      socket.emit('live_transcript_chunk', { text: transcript });

      // ── Accumulate buffer ───────────────────────────────────
      state.buffer = cleanDupes((state.buffer + ' ' + transcript).trim());
      if (state.buffer.length > MAX_BUFFER_CHARS) {
        state.buffer = state.buffer.slice(-Math.floor(MAX_BUFFER_CHARS * 0.7));
      }

      if (state.buffer.length < MIN_BUFFER_CHARS) return;

      // ── Question detection (sync, no API call) ───────────────
      const detection = aiService.detectQuestion(state.buffer);
      if (!detection.isQuestion) return;

      // ── Dedup ────────────────────────────────────────────────
      const norm = normalize(detection.cleanQuestion);
      if (norm === state.lastNormalized) return;

      // ── Rate limit AI triggers ───────────────────────────────
      if (isRateLimited(state)) {
        logger.debug('[Socket] AI trigger rate-limited');
        return;
      }

      // ── Fire AI pipeline ─────────────────────────────────────
      state.lastNormalized    = norm;
      state.lastTriggerAt     = now;
      state.triggersThisMinute++;
      state.buffer            = ''; // clear after trigger

      const question = detection.cleanQuestion;
      logger.info(`[Socket] Triggering AI for: "${question}"`);

      state.streamId++;
      const myStreamId = state.streamId;

      socket.emit('answer_start', { question });

      try {
        const fullAnswer = await aiService.generateLiveAnswerStream(
          question, '', {}, (chunk) => {
            if (state.streamId === myStreamId) {
              socket.emit('answer_chunk', { chunk });
            }
          }
        );

        if (state.streamId === myStreamId) {
          socket.emit('answer_end', { question, answer: fullAnswer, timestamp: new Date() });

          // Keep last 6 turns in memory
          state.memory.push({ role: 'user', content: question });
          state.memory.push({ role: 'assistant', content: fullAnswer });
          if (state.memory.length > 12) state.memory.splice(0, 2);
        }
      } catch (err) {
        logger.error('[Socket] AI pipeline error:', err.message);
        socket.emit('answer_error', { message: 'AI failed to respond. Please try again.' });
      }
    });

    // ── disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`[Socket] Disconnected: ${socket.id}`);
      const sid = socket.sessionId;
      if (sid) {
        setTimeout(() => {
          const room = io.sockets.adapter.rooms.get(sid);
          if (!room || room.size === 0) {
            sessionStates.delete(sid);
            logger.info(`[Socket] Cleaned up state for session ${sid}`);
          }
        }, 60_000);
      }
    });
  });
};

module.exports = handleSocketEvents;
