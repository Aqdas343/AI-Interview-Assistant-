const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const { DeepgramClient } = require('@deepgram/sdk');
const config = require('../config');
const logger = require('../utils/logger');

// ─── Clients ─────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: config.openaiApiKey });
const genAI  = config.geminiApiKey  ? new GoogleGenerativeAI(config.geminiApiKey) : null;
const groq   = config.groqApiKey    ? new Groq({ apiKey: config.groqApiKey })     : null;
const deepgram = config.deepgramApiKey ? new DeepgramClient(config.deepgramApiKey) : null;

// ─── Helpers ──────────────────────────────────────────────────────
const removeFillers = (text) =>
  text
    .replace(/\b(um|uh|err|ah|hmm|like|you\s+know|i\s+mean|sort\s+of|kind\s+of)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

// ─── KEYWORD EXTRACTION ───────────────────────────────────────────
/**
 * Extracts important interview-related keywords from user messages.
 * Focuses on: name, skills, experience, company, role, projects, etc.
 */
const extractKeywords = (text) => {
  if (!text || text.length < 5) return [];
  
  const lower = text.toLowerCase();
  const keywords = [];
  
  // Patterns to detect important info
  const patterns = [
    // Name patterns
    { regex: /my name is (\w+)/i, type: 'name', extract: 1 },
    { regex: /i am (\w+)/i, type: 'name', extract: 1 },
    { regex: /i'm (\w+)/i, type: 'name', extract: 1 },
    // Company patterns
    { regex: /i work(?:ing)? at (\w+)/i, type: 'company', extract: 1 },
    { regex: /i work(?:ing)? for (\w+)/i, type: 'company', extract: 1 },
    { regex: /my company is (\w+)/i, type: 'company', extract: 1 },
    // Role patterns  
    { regex: /i am a (?:senior |junior |lead )?(\w+(?:\s+\w+)?)/i, type: 'role', extract: 1 },
    { regex: /i work as a (?:senior |junior |lead )?(\w+(?:\s+\w+)?)/i, type: 'role', extract: 1 },
    { regex: /my role is (\w+(?:\s+\w+)?)/i, type: 'role', extract: 1 },
    // Experience patterns
    { regex: /(\d+)\+? years? (?:of )?experience/i, type: 'experience', extract: 0 },
    { regex: /(\d+) years? (?:of )?exp/i, type: 'experience', extract: 0 },
    // Skills patterns
    { regex: /i know (\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
    { regex: /my skills? (?:are |include )?(\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
    { regex: /i specialize in (\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
    { regex: /i work with (\w+(?:,?\s*\w+)+)/i, type: 'skills', extract: 1 },
    // Project patterns
    { regex: /my project (?:is |called )?["']?(\w+(?:\s+\w+)?)["']?/i, type: 'project', extract: 1 },
    { regex: /i built (\w+(?:\s+\w+)?)/i, type: 'project', extract: 1 },
    // Education
    { regex: /i studied (\w+(?:\s+\w+)?)/i, type: 'education', extract: 1 },
    { regex: /i have a (?:degree |bachelor |master )?in (\w+(?:\s+\w+)?)/i, type: 'education', extract: 1 },
    // Tech stack
    { regex: /using (\w+(?:\s+\w+)?)/i, type: 'tech', extract: 1 },
    { regex: /tech stack[:\s]+(\w+(?:,?\s*\w+)+)/i, type: 'tech', extract: 1 },
  ];
  
  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      keywords.push({
        type: p.type,
        value: match[p.extract],
        original: text.slice(0, 100)
      });
    }
  }
  
  // Also extract tech skills from common keywords
  const techKeywords = ['javascript', 'python', 'java', 'react', 'node', 'angular', 'vue', 'sql', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes', 'git', 'typescript', 'golang', 'rust', 'php', 'ruby', 'c++', 'c#', 'html', 'css', 'rest', 'graphql', 'microservices', 'linux'];
  for (const tech of techKeywords) {
    if (lower.includes(tech) && !keywords.find(k => k.value.toLowerCase() === tech)) {
      keywords.push({ type: 'tech', value: tech, original: text.slice(0, 100) });
    }
  }
  
  return keywords;
};

// ─── 1. TRANSCRIPTION ─────────────────────────────────────────────
/**
 * Transcribes a raw audio ArrayBuffer/Buffer.
 * Uses Deepgram REST API (nova-2) → falls back to OpenAI Whisper.
 */
const transcribeAudio = async (audioBuffer, mimeType = 'audio/webm') => {
  if (!audioBuffer || audioBuffer.byteLength === 0) return '';

  const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);

  if (buffer.length < 1000) {
    logger.debug('[Transcription] Buffer too small, skipping');
    return '';
  }

  // Normalize mimeType — strip codec params for Content-Type header
  const contentType = (mimeType || 'audio/webm').split(';')[0].trim();

  // ── Deepgram REST API (primary) ─────────────────────────────────
  if (config.deepgramApiKey) {
    try {
      const url = `https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Token ${config.deepgramApiKey}`,
          'Content-Type': contentType,
        },
        body: buffer,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Deepgram HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const transcript =
        data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';

      if (transcript) {
        logger.info(`[Transcription] Deepgram: "${transcript}"`);
        return transcript;
      }
      logger.debug('[Transcription] Deepgram returned empty transcript (silence?)');
    } catch (err) {
      logger.warn(`[Transcription] Deepgram failed: ${err.message}`);
    }
  }

  // ── OpenAI Whisper (fallback) ───────────────────────────────────
  if (config.openaiApiKey) {
    const ext = contentType.includes('ogg') ? 'ogg' : 'webm';
    const tmpPath = path.join(__dirname, '../../uploads', `tmp_${Date.now()}.${ext}`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: 'whisper-1',
        language: 'en',
        response_format: 'text',
      });
      const transcript = (response || '').trim();
      if (transcript) {
        logger.info(`[Transcription] Whisper: "${transcript}"`);
        return transcript;
      }
    } catch (err) {
      logger.warn(`[Transcription] Whisper failed: ${err.message}`);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }

  logger.warn('[Transcription] All providers failed, returning empty string');
  return '';
};

// ─── 2. ANSWER GENERATION (STREAMING) ────────────────────────────
/**
 * Streams an AI answer for the given question.
 * Provider priority: groq → gemini → openai
 */
const generateLiveAnswerStream = async (question, context = '', options = {}, onChunk, memory = []) => {
  const { personality = 'professional', explanationMode = false } = options;
  
  // Build conversation history for context
  const conversationHistory = memory.slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  // Personality prompts
  const personalityPrompts = {
    professional: 'You are a professional AI interview assistant. Give clear, concise, business-focused answers in under 200 words. Be formal and direct.',
    friendly: 'You are a friendly AI interview assistant. Be warm, conversational, and encouraging. Give helpful answers in under 200 words.',
    technical: 'You are a technical AI interview assistant. Provide deep technical details, precise explanations, and code examples when relevant. Be thorough but concise.',
    mentor: 'You are a mentor AI interview assistant. Explain your reasoning, provide educational context, and help the user learn. Be encouraging and detailed.',
  };

  let systemContent = personalityPrompts[personality] || personalityPrompts.professional;
  
  // Add explanation mode
  if (explanationMode) {
    systemContent += ' After your main answer, add a brief explanation of your reasoning and key points to consider.';
  }
  
  systemContent += ' Reference previous questions and answers when relevant.';

  // Add keyword context if available
  if (options.keywordContext) {
    systemContent += options.keywordContext;
  }

  const systemMsg = {
    role: 'system',
    content: systemContent,
  };

  // ── Groq ────────────────────────────────────────────────────────
  if (groq) {
    try {
      // Include conversation history for context
      const messages = [systemMsg, ...conversationHistory, { role: 'user', content: question }];
      const stream = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        stream: true,
        max_tokens: 400,
        temperature: 0.7,
      });

      let full = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) { onChunk?.(text); full += text; }
      }
      logger.info(`[AI] Groq answered: "${question.slice(0, 60)}..."`);
      return full;
    } catch (err) {
      logger.warn(`[AI] Groq failed: ${err.message}, trying Gemini...`);
    }
  }

  // ── Gemini (fallback) ───────────────────────────────────────────
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `You are a helpful AI assistant. Answer concisely in under 200 words.\n\nQuestion: ${question}`;
      const result = await model.generateContentStream(prompt);

      let full = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) { onChunk?.(text); full += text; }
      }
      logger.info(`[AI] Gemini answered: "${question.slice(0, 60)}..."`);
      return full;
    } catch (err) {
      logger.warn(`[AI] Gemini failed: ${err.message}`);
    }
  }

  throw new Error('No AI provider available. Check GROQ_API_KEY or GEMINI_API_KEY.');
};

// ─── 3. QUESTION DETECTION ────────────────────────────────────────
/**
 * Pure regex-based question detection — no API calls, zero latency.
 */
const detectQuestion = (transcript) => {
  if (!transcript || transcript.trim().length < 8) {
    return { isQuestion: false, cleanQuestion: null, confidence: 0 };
  }

  const text  = transcript.trim();
  const lower = text.toLowerCase();

  let score = 0;
  if (/^(what|how|why|when|where|who|which|can you|could you|would you|do you|did you|have you|will you|are you|is there|are there)\b/i.test(lower)) score += 0.5;
  if (/\b(explain|describe|tell me|walk me through|give me|help me understand)\b/i.test(lower)) score += 0.3;
  if (lower.endsWith('?')) score += 0.3;
  if (/\b(difference between|best practice|advantage|disadvantage|pros and cons)\b/i.test(lower)) score += 0.2;
  if (text.length > 15) score += 0.1;

  const isQuestion = score >= 0.4;
  return {
    isQuestion,
    cleanQuestion: isQuestion ? removeFillers(text) : null,
    confidence: Math.min(Math.round(score * 100) / 100, 1),
  };
};

// ─── 4. GENERATE QUESTIONS ────────────────────────────────────────
const generateQuestions = async (topicOrRole, count = 5) => {
  try {
    if (groq) {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `Generate ${count} interview questions as JSON: {"questions": [...]}` },
          { role: 'user', content: topicOrRole },
        ],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(res.choices[0].message.content).questions || [];
    }

    if (genAI) {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(
        `Generate ${count} interview questions for: ${topicOrRole}. Return JSON: {"questions": [...]}`
      );
      const text = result.response.text();
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      return json ? JSON.parse(json).questions || [] : [];
    }
  } catch (err) {
    logger.error('[AI] generateQuestions failed:', err.message);
  }
  return [];
};

// ─── 5. GENERATE REPORT ───────────────────────────────────────────
const generateReport = async (transcript) => {
  const systemPrompt = `Analyze this interview transcript. Return JSON:
{"score":number,"summary":"string","strengths":["..."],"weaknesses":["..."],"recommendations":"string"}`;

  try {
    if (groq) {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(res.choices[0].message.content);
    }

    if (genAI) {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(`${systemPrompt}\n\n${transcript}`);
      const text = result.response.text();
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      return json ? JSON.parse(json) : null;
    }
  } catch (err) {
    logger.error('[AI] generateReport failed:', err.message);
  }

  return {
    score: 75,
    summary: 'Analysis unavailable.',
    strengths: [],
    weaknesses: [],
    recommendations: 'Manual review required.',
  };
};

// ─── 6. ANSWER METRICS ────────────────────────────────────────────
const generateAnswerMetrics = async (question, answerText) => {
  try {
    const prompt = `Analyze this interview answer. Return JSON:
{"keyPoints":["..."],"example":"string","confidence":number}
Question: ${question}
Answer: ${answerText}`;

    if (groq) {
      const res = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(res.choices[0].message.content);
    }
  } catch (err) {
    logger.warn('[AI] generateAnswerMetrics failed:', err.message);
  }
  return { keyPoints: [], example: '', confidence: 0 };
};

// ─── 7. PROCESS TRANSCRIPT ───────────────────────────────────────
const processTranscript = async (transcript, context = '', options = {}, onChunk = null) => {
  const detection = detectQuestion(transcript);
  if (!detection.isQuestion) return null;

  const question  = detection.cleanQuestion || transcript;
  const answerText = await generateLiveAnswerStream(question, context, options, onChunk);
  const metrics   = await generateAnswerMetrics(question, answerText);

  return {
    transcript,
    question,
    answer: answerText,
    keyPoints: metrics.keyPoints,
    example: metrics.example,
    confidence: metrics.confidence || 95,
    topic: identifyTopic(question),
    model: groq ? 'Groq llama-3.1-8b-instant' : 'Gemini 1.5 Flash',
  };
};

const identifyTopic = (text = '') => {
  const t = text.toLowerCase();
  if (t.includes('design') || t.includes('architecture') || t.includes('scale')) return 'SYSTEM DESIGN';
  if (t.includes('react') || t.includes('frontend') || t.includes('css') || t.includes('dom')) return 'FRONTEND';
  if (t.includes('node') || t.includes('database') || t.includes('sql') || t.includes('api')) return 'BACKEND';
  if (t.includes('algorithm') || t.includes('data structure') || t.includes('complexity')) return 'ALGORITHMS';
  if (t.includes('team') || t.includes('conflict') || t.includes('experience') || t.includes('manage')) return 'BEHAVIORAL';
  return 'TECHNICAL';
};

// ─── Exports ──────────────────────────────────────────────────────
module.exports = {
  transcribeAudio,
  generateLiveAnswerStream,
  detectQuestion,
  generateQuestions,
  generateReport,
  generateAnswerMetrics,
  processTranscript,
  extractKeywords,
};
