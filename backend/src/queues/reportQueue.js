const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const { isRedisActive } = require('../utils/redisCache');
const aiService = require('../services/aiService');
const db = require('../db');

/**
 * PRODUCTION-GRADE INTERVIEW REPORT QUEUE
 * Processes asynchronous AI evaluation after a session ends.
 */

let reportQueue;

if (isRedisActive()) {
  reportQueue = new Bull('interview-report-queue', config.redisUrl);

  reportQueue.process(async (job) => {
    const { sessionId } = job.data;
    logger.info(`[ReportQueue] Starting analysis for session ${sessionId}`);

    try {
      // 1. Fetch all events for the session to build context
      const eventsQuery = `SELECT * FROM interview_events WHERE session_id = $1 ORDER BY created_at ASC`;
      const { rows: events } = await db.query(eventsQuery, [sessionId]);

      if (events.length === 0) {
        throw new Error('No events found for session');
      }

      // 2. Rebuild the conversation transcript from events
      const transcript = events
        .map(e => {
          if (e.event_type === 'QUESTION_ASKED') return `Interviewer: ${e.payload.question}`;
          if (e.event_type === 'ANSWER_SUBMITTED') return `Candidate: ${e.payload.answer}`;
          if (e.event_type === 'AUDIO_RECORDED') return `Candidate (Audio): ${e.payload.transcript}`;
          return null;
        })
        .filter(t => t !== null)
        .join('\n\n');

      // 3. AI Analysis using proper generateReport method
      const reportData = await aiService.generateReport(transcript);

      // 4. Save to DB
      const insertQuery = `
        INSERT INTO interview_reports (session_id, candidate_score, summary, strengths, weaknesses, recommendations)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id) DO UPDATE SET
          candidate_score = EXCLUDED.candidate_score,
          summary = EXCLUDED.summary,
          strengths = EXCLUDED.strengths,
          weaknesses = EXCLUDED.weaknesses,
          recommendations = EXCLUDED.recommendations;
      `;
      await db.query(insertQuery, [
        sessionId,
        reportData.score,
        reportData.summary,
        JSON.stringify(reportData.strengths),
        JSON.stringify(reportData.weaknesses),
        reportData.recommendations
      ]);

      logger.info(`[ReportQueue] Report generated successfully for session ${sessionId}`);
      return { status: 'completed', sessionId };

    } catch (error) {
      logger.error(`[ReportQueue] Failed processing session ${sessionId}: ${error.message}`);
      throw error;
    }
  });

  reportQueue.on('failed', (job, err) => {
    logger.error(`[ReportQueue] Job ${job.id} failed: ${err.message}`);
  });
}

const addReportJob = async (sessionId) => {
  if (isRedisActive()) {
    logger.info(`[ReportQueue] Queuing report job for session ${sessionId}`);
    return await reportQueue.add({ sessionId }, { 
      attempts: 3, 
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true
    });
  } else {
    logger.warn(`[ReportQueue] Redis Offline: Async report generation skipped for session ${sessionId}`);
  }
};

module.exports = {
  addReportJob
};
