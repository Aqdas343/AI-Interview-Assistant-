const db = require('../db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * PRODUCTION-GRADE INTERVIEW EVENT SERVICE
 * Implements Event Sourcing pattern for interview sessions.
 */

const EVENT_TYPES = {
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_RESUMED: 'SESSION_RESUMED',
  QUESTION_ASKED: 'QUESTION_ASKED',
  ANSWER_SUBMITTED: 'ANSWER_SUBMITTED',
  AUDIO_RECORDED: 'AUDIO_RECORDED',
  SESSION_ENDED: 'SESSION_ENDED'
};

const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED'
};

/**
 * Record an event and update the session snapshot atomically.
 */
const recordEvent = async (userId, sessionId, eventType, payload = {}) => {
  try {
    // 1. Immutable Event Log Entry
    const eventQuery = `
      INSERT INTO interview_events (session_id, user_id, event_type, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at;
    `;
    const eventValues = [sessionId, userId, eventType, JSON.stringify(payload)];
    const { rows: eventRows } = await db.query(eventQuery, eventValues);
    const eventId = eventRows[0].id;

    // 2. Atomic Snapshot Update
    let snapshotUpdateQuery;
    let snapshotValues;

    if (eventType === EVENT_TYPES.QUESTION_ASKED) {
      snapshotUpdateQuery = `
        UPDATE interview_sessions 
        SET current_question_index = current_question_index + 1, 
            last_event_id = $1, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2;
      `;
      snapshotValues = [eventId, sessionId];
    } else if (eventType === EVENT_TYPES.SESSION_ENDED) {
      snapshotUpdateQuery = `
        UPDATE interview_sessions 
        SET status = $1, 
            last_event_id = $2, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $3;
      `;
      snapshotValues = [SESSION_STATUS.ENDED, eventId, sessionId];
    } else {
      snapshotUpdateQuery = `
        UPDATE interview_sessions 
        SET last_event_id = $1, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2;
      `;
      snapshotValues = [eventId, sessionId];
    }

    await db.query(snapshotUpdateQuery, snapshotValues);

    logger.info(`[InterviewEvent] ${eventType} recorded for session ${sessionId}`);
    return { eventId, timestamp: eventRows[0].created_at };

  } catch (error) {
    logger.error(`[InterviewEvent Error] Failed to record event ${eventType}:`, error);
    throw error;
  }
};

/**
 * Start a new interview session (Initialize snapshot and first event)
 */
const startInterview = async (userId, metadata = {}) => {
  try {
    // 1. Create Snapshot Entry
    const sessionQuery = `
      INSERT INTO interview_sessions (user_id, status)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const { rows: sessionRows } = await db.query(sessionQuery, [userId, SESSION_STATUS.ACTIVE]);
    const session = sessionRows[0];

    // 2. Record First Event
    await recordEvent(userId, session.id, EVENT_TYPES.SESSION_STARTED, metadata);

    return session;
  } catch (error) {
    logger.error('[InterviewEvent Error] Failed to start interview:', error);
    throw error;
  }
};

/**
 * Rehydrate session state by fetching snapshot and events
 */
const getSessionState = async (sessionId) => {
  const sessionQuery = `SELECT * FROM interview_sessions WHERE id = $1;`;
  const { rows: sessionRows } = await db.query(sessionQuery, [sessionId]);
  
  if (sessionRows.length === 0) return null;

  const eventsQuery = `SELECT * FROM interview_events WHERE session_id = $1 ORDER BY created_at ASC;`;
  const { rows: eventRows } = await db.query(eventsQuery, [sessionId]);

  return {
    session: sessionRows[0],
    events: eventRows
  };
};

/**
 * Fetch delta events since a specific dual-cursor
 */
const getEventsSince = async (sessionId, lastTimestamp, lastId) => {
  const query = `
    SELECT * FROM interview_events 
    WHERE session_id = $1 
      AND (
        (created_at > $2) 
        OR (created_at = $2 AND id > $3)
      )
    ORDER BY created_at ASC, id ASC;
  `;
  const { rows } = await db.query(query, [sessionId, lastTimestamp, lastId]);
  return rows;
};

/**
 * Fetch the AI evaluation report for a session
 */
const getSessionReport = async (sessionId) => {
  const query = `SELECT * FROM interview_reports WHERE session_id = $1;`;
  const { rows } = await db.query(query, [sessionId]);
  return rows[0] || null;
};

/**
 * Extract session memory (last 3 Q&A pairs) for AI context rehydration.
 */
const getSessionMemory = async (sessionId) => {
  try {
    const query = `
      SELECT event_type, payload 
      FROM interview_events 
      WHERE session_id = $1 
        AND event_type IN ($2, $3)
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    const { rows } = await db.query(query, [sessionId, EVENT_TYPES.QUESTION_ASKED, EVENT_TYPES.ANSWER_SUBMITTED]);
    
    // Reverse to chronological order and format for AI history
    const history = [];
    rows.reverse().forEach(row => {
      try {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        if (row.event_type === EVENT_TYPES.QUESTION_ASKED) {
          history.push({ role: 'user', content: payload.text || payload.question });
        } else if (row.event_type === EVENT_TYPES.ANSWER_SUBMITTED) {
          history.push({ role: 'assistant', content: payload.answer });
        }
      } catch (parseError) {
        logger.warn('[InterviewEvent] Failed to parse payload for event:', {
          eventType: row.event_type,
          payload: row.payload,
          error: parseError.message
        });
        // Skip corrupted entries
      }
    });

    // Keep only last 3 pairs (6 entries max)
    return history.slice(-6);
  } catch (error) {
    logger.error('[InterviewEvent Error] Failed to fetch session memory:', error);
    return [];
  }
};

module.exports = {
  recordEvent,
  startInterview,
  getSessionState,
  getEventsSince,
  getSessionReport,
  getSessionMemory,
  EVENT_TYPES,
  SESSION_STATUS
};
