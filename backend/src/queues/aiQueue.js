const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const { isRedisActive } = require('../utils/redisCache');
const aiService = require('../services/aiService');
const db = require('../db');
// Provide the socket instances where required to push data directly

let aiQueue;

if (isRedisActive()) {
  aiQueue = new Bull('ai-feedback-queue', config.redisUrl);

  // Process AI evaluation jobs
  aiQueue.process(async (job) => {
    const { sessionId, question, answer } = job.data;
    
    logger.info(`[Queue] Processing AI feedback for session ${sessionId}`);
    
    try {
      const aiResult = await aiService.generateFeedback(question, answer);
      
      const feedbackData = {
        score: aiResult.score,
        strengths: aiResult.strengths,
        weaknesses: aiResult.weaknesses,
        suggestion: aiResult.suggestion
      };
      
      // Store in DB
      const result = await db.query(
        'INSERT INTO answers (session_id, question, answer, ai_feedback, score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [sessionId, question, answer, JSON.stringify(feedbackData), aiResult.score]
      );
      
      logger.info(`[Queue] AI feedback stored successfully for session ${sessionId}`);
      
      // We can hook up to socket server if needed here to emit events
      // e.g. socketio.to(sessionId).emit('answer-evaluated', result.rows[0])
      
      return { status: 'processed', result: result.rows[0] };
    } catch (error) {
      logger.error(`[Queue] Failed to process AI feedback: ${error.message}`);
      throw error;
    }
  });

  aiQueue.on('failed', (job, err) => {
    logger.error(`[Queue] AI Job ${job.id} failed: ${err.message}`);
  });
}

/**
 * Resilient AI Job Producer
 */
const addAiFeedbackJob = async (data) => {
  if (isRedisActive()) {
    logger.info(`[Queue] Adding AI feedback to background queue for session: ${data.sessionId}`);
    return await aiQueue.add(data);
  } else {
    logger.warn(`[Queue] Redis Offline: Executing AI feedback immediately for session: ${data.sessionId}`);
    // Inline processing exactly like earlier
    const aiResult = await aiService.generateFeedback(data.question, data.answer);
    
    const feedbackData = {
      score: aiResult.score,
      strengths: aiResult.strengths,
      weaknesses: aiResult.weaknesses,
      suggestion: aiResult.suggestion
    };
    
    const result = await db.query(
      'INSERT INTO answers (session_id, question, answer, ai_feedback, score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [data.sessionId, data.question, data.answer, JSON.stringify(feedbackData), aiResult.score]
    );

    return { status: 'completed-immediately', data: result.rows[0] };
  }
};

module.exports = {
  addAiFeedbackJob
};
