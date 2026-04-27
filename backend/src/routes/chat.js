const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/v1/chat
 * Chat endpoint that uses user-provided API key for multiple AI providers
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const userApiKey = req.headers['x-api-key'];
  const { 
    message, 
    provider = 'openai', // openai, groq, gemini
    model, 
    maxTokens = 150,
    temperature = 0.7 
  } = req.body;

  // Validate API key
  if (!userApiKey) {
    throw new AppError('API key required. Please provide your AI provider API key in the x-api-key header.', 400);
  }

  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError('Message is required and must be a non-empty string.', 400);
  }

  // Validate provider
  const supportedProviders = ['openai', 'groq', 'gemini'];
  if (!supportedProviders.includes(provider.toLowerCase())) {
    throw new AppError(`Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`, 400);
  }

  try {
    let aiResponse;
    let usedModel;
    let usage = null;

    const systemMessage = 'You are a helpful AI assistant. Provide clear, concise, and helpful responses.';
    
    switch (provider.toLowerCase()) {
      case 'openai':
        aiResponse = await handleOpenAI(userApiKey, message, systemMessage, model || 'gpt-3.5-turbo', maxTokens, temperature);
        usedModel = model || 'gpt-3.5-turbo';
        usage = aiResponse.usage;
        aiResponse = aiResponse.content;
        break;
        
      case 'groq':
        aiResponse = await handleGroq(userApiKey, message, systemMessage, model || 'llama-3.1-8b-instant', maxTokens, temperature);
        usedModel = model || 'llama-3.1-8b-instant';
        break;
        
      case 'gemini':
        aiResponse = await handleGemini(userApiKey, message, systemMessage, model || 'gemini-1.5-flash', maxTokens, temperature);
        usedModel = model || 'gemini-1.5-flash';
        break;
        
      default:
        throw new AppError('Provider implementation not found', 500);
    }

    logger.info(`[Chat] User ${req.user.userId} sent message via ${provider}, received response`);

    res.status(200).json({
      success: true,
      data: {
        message: aiResponse,
        provider: provider,
        model: usedModel,
        usage: usage
      }
    });

  } catch (error) {
    logger.error(`[Chat] ${provider} API Error:`, error);

    // Re-throw AppError as-is
    if (error instanceof AppError) throw error;

    const msg = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode || error.code;

    // Detect invalid / unauthorized key across all providers
    const isAuthError =
      status === 401 ||
      msg.includes('401') ||
      msg.includes('unauthorized') ||
      msg.includes('invalid api key') ||
      msg.includes('api_key_invalid') ||
      msg.includes('permission_denied') ||   // Gemini
      msg.includes('api key not valid');      // Gemini

    // Detect rate limits
    const isRateLimit =
      status === 429 ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('quota');

    if (isAuthError) {
      throw new AppError(`Invalid API key for ${provider}. Please check your API key and try again.`, 401);
    } else if (isRateLimit) {
      throw new AppError('Rate limit exceeded. Please try again later.', 429);
    } else if (status === 400 || msg.includes('400')) {
      throw new AppError('Invalid request. Please check your message and try again.', 400);
    } else {
      throw new AppError(`Failed to process chat request with ${provider}. Please try again.`, 500);
    }
  }
}));

// OpenAI Handler
async function handleOpenAI(apiKey, message, systemMessage, model, maxTokens, temperature) {
  const openai = new OpenAI({ apiKey });
  
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: message.trim() }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
  });

  return {
    content: response.choices[0]?.message?.content || 'No response generated.',
    usage: response.usage
  };
}

// Groq Handler
async function handleGroq(apiKey, message, systemMessage, model, maxTokens, temperature) {
  const groq = new Groq({ apiKey });
  
  const response = await groq.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: message.trim() }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
  });

  return response.choices[0]?.message?.content || 'No response generated.';
}

// Gemini Handler
async function handleGemini(apiKey, message, systemMessage, model, maxTokens, temperature) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ 
    model: model,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature,
    }
  });
  
  const prompt = `${systemMessage}\n\nUser: ${message.trim()}`;
  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  
  return response.text() || 'No response generated.';
}

module.exports = router;