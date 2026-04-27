const interviewEventService = require('../services/interviewEventService');
const aiService = require('../services/aiService');
const { addReportJob } = require('../queues/reportQueue');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const db = require('../db');

/**
 * PRODUCTION-GRADE INTERVIEW LIFECYCLE CONTROLLER
 * Uses Event Sourcing for scalability and auditability.
 */

const startSession = async (req, res) => {
  const { topicMetadata = {} } = req.body;
  const userId = req.user.userId;

  const session = await interviewEventService.startInterview(userId, topicMetadata);

  res.status(201).json({
    success: true,
    data: {
      sessionId: session.id,
      status: session.status,
      startedAt: session.started_at
    }
  });
};

const resumeSession = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user.userId;

  const state = await interviewEventService.getSessionState(sessionId);

  if (!state) {
    throw new AppError('Interview session not found', 404);
  }

  if (state.session.user_id !== userId) {
    throw new AppError('Unauthorized access to this session', 403);
  }

  // Record Resume Event
  await interviewEventService.recordEvent(userId, sessionId, interviewEventService.EVENT_TYPES.SESSION_RESUMED);

  res.status(200).json({
    success: true,
    data: {
      session: state.session,
      events: state.events
    }
  });
};

const submitAnswer = async (req, res) => {
  const { id: sessionId } = req.params;
  const { question, answer } = req.body;
  const userId = req.user.userId;

  if (!question || !answer) {
    throw new AppError('Question and Answer are required', 400);
  }

  // 1. Record Answer Event (Immediate Ack)
  const event = await interviewEventService.recordEvent(userId, sessionId, interviewEventService.EVENT_TYPES.ANSWER_SUBMITTED, {
    question,
    answer
  });

  // 2. Async UI Flow (Optional: We could return here, but for now we follow the existing pattern of returning quickly)
  res.status(202).json({
    success: true,
    message: 'Answer ingested and event persisted.',
    eventId: event.eventId
  });
  
  // Note: AI analysis could be triggered here or via a DB trigger/queue.
  // For consistency with current pattern, we'd add to the Bull queue.
};

const endSession = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user.userId;

  // Use critical transition locking (SELECT ... FOR UPDATE)
  await db.query('SELECT 1 FROM interview_sessions WHERE id = $1 FOR UPDATE', [sessionId]);

  const event = await interviewEventService.recordEvent(userId, sessionId, interviewEventService.EVENT_TYPES.SESSION_ENDED);

  // Trigger Async Report Generation
  await addReportJob(sessionId);
  logger.info(`[Lifecycle] Session ${sessionId} ended. Report job queued.`);

  res.status(200).json({
    success: true,
    message: 'Interview concluded. Your analysis report is being generated.',
    sessionId
  });
};

const getSessionEvents = async (req, res) => {
  const { id: sessionId } = req.params;
  const { sinceTime, sinceId } = req.query;
  const userId = req.user.userId;

  // Authorization check
  const state = await interviewEventService.getSessionState(sessionId);
  if (!state || state.session.user_id !== userId) {
    throw new AppError('Session not found or unauthorized', 404);
  }

  let events;
  if (sinceTime && sinceId) {
    events = await interviewEventService.getEventsSince(sessionId, sinceTime, sinceId);
  } else {
    events = state.events;
  }

  res.status(200).json({
    success: true,
    data: events
  });
};

const getSessionReport = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user.userId;

  // Authorization check
  const state = await interviewEventService.getSessionState(sessionId);
  if (!state || state.session.user_id !== userId) {
    throw new AppError('Session not found or unauthorized', 404);
  }

  const report = await interviewEventService.getSessionReport(sessionId);
  if (!report) {
    throw new AppError('Evaluation report not found for this session', 404);
  }

  res.status(200).json({
    success: true,
    data: report
  });
};

module.exports = {
  startSession,
  resumeSession,
  submitAnswer,
  endSession,
  getSessionEvents,
  getSessionReport
};
