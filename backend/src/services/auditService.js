const db = require('../db');
const logger = require('../utils/logger');
const { getDeviceId } = require('../utils/fingerprint');

/**
 * PRODUCTION-GRADE AUDIT LOGGING SERVICE
 * Handles security and administrative event tracking non-blockingly.
 */

const EVENT_TYPES = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ADMIN_ACTION: 'ADMIN_ACTION'
};

const STATUS = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE'
};

/**
 * Log a structured audit event
 * FAIL-SAFE: This method is designed to never block the main request flow.
 */
const logEvent = async (req, { userId = null, eventType, status, metadata = {} }) => {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceId = getDeviceId(req);

    const query = `
      INSERT INTO audit_logs (user_id, event_type, status, metadata, ip_address, user_agent, device_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [userId, eventType, status, JSON.stringify(metadata), ipAddress, userAgent, deviceId];

    // FIRE AND FORGET: Do not await the database write to prevent blocking the request response.
    // Errors are caught internally to ensure non-blocking behavior.
    db.query(query, values).catch(err => {
      logger.error(`❌ [AUDIT STORAGE FAILURE]: ${err.message}`);
    });

    // Console Logging for Visibility
    const userDisplay = userId ? `User:${userId}` : 'Anonymous';
    logger.info(`[AUDIT] ${eventType} | ${status} | ${userDisplay} | IP:${ipAddress}`);

  } catch (error) {
    // Fail silently but log the error to stderr
    logger.error(`❌ [AUDIT SERVICE ERROR]: ${error.message}`);
  }
};

/**
 * Query audit logs with advanced filtering and pagination
 */
const findLogs = async ({ userId, eventType, since, until, limit = 50, offset = 0 }) => {
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];

  if (userId) {
    params.push(userId);
    query += ` AND user_id = $${params.length}`;
  }

  if (eventType) {
    params.push(eventType);
    query += ` AND event_type = $${params.length}`;
  }

  if (since) {
    params.push(since);
    query += ` AND created_at >= $${params.length}`;
  }

  if (until) {
    params.push(until);
    query += ` AND created_at <= $${params.length}`;
  }

  params.push(limit, offset);
  query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return rows;
};

module.exports = {
  logEvent,
  findLogs,
  EVENT_TYPES,
  STATUS
};
