const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { setCache, getCache, clearCache, isRedisActive } = require('../utils/redisCache');
const logger = require('../utils/logger');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

const { getPermissionsByRole } = require('../config/roles');

/**
 * Hash a token for secure Redis storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Issue a complete JWT Session
 */
const issueSession = async (user, deviceInfo, deviceId = 'unknown') => {
  // Validate user object
  if (!user) {
    throw new Error('User object is required for session creation');
  }
  
  const userId = user.id || user.userId;
  if (!userId) {
    logger.error('[JWT] Invalid user object - missing id:', user);
    throw new Error('User ID is required for session creation');
  }
  
  const role = user.role || 'candidate';
  const permissions = getPermissionsByRole(role);

  logger.info(`[JWT] Creating session for user ${userId} with role ${role}`);

  // 1. Generate Tokens
  const accessToken = jwt.sign(
    { 
      userId, 
      username: user.username || 'Unknown User', 
      email: user.email || '', 
      role,
      permissions // Injected for client-side optimization
    },
    config.jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId, deviceId },
    config.jwtSecret + '_refresh',
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
  );

  // 2. Prepare Session Metadata
  const rtHash = hashToken(refreshToken);
  const sessionData = {
    userId,
    deviceId,
    rtHash,
    userAgent: deviceInfo,
    username: user.username || 'Unknown User',
    role: role,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  };

  // 3. Persist to Redis
  const sessionKey = `session:${userId}:${deviceId}`;
  const userSessionsKey = `user:sessions:${userId}`;

  try {
    await setCache(sessionKey, sessionData, REFRESH_TOKEN_EXPIRY_SECONDS);
    
    // Track deviceId in the user's session set
    const existingDevices = await getCache(userSessionsKey) || [];
    if (!existingDevices.includes(deviceId)) {
      existingDevices.push(deviceId);
      await setCache(userSessionsKey, existingDevices, REFRESH_TOKEN_EXPIRY_SECONDS);
    }

    logger.info(`[JWT] New session issued for User ${userId} [Device: ${deviceId}]`);

    return { token: accessToken, refreshToken, expiresIn: 900 };
  } catch (error) {
    logger.error('[JWT] Failed to create session:', error.message);
    throw new Error(`Session creation failed: ${error.message}`);
  }
};

/**
 * Refresh/Rotate Session with Theft Protection
 */
const refreshSession = async (oldRefreshToken, deviceInfo) => {
  try {
    const payload = jwt.verify(oldRefreshToken, config.jwtSecret + '_refresh');
    const { userId, deviceId } = payload;
    const sessionKey = `session:${userId}:${deviceId}`;
    const oldRtHash = hashToken(oldRefreshToken);

    const session = await getCache(sessionKey);

    // 1. THEFT PROTECTION: If no session exists or hash mismatch
    if (!session || session.rtHash !== oldRtHash) {
      logger.warn(`🚨 [SECURITY BREACH] Refresh token reuse detected for User ${userId}. Nuking all sessions!`);
      await revokeAllSessions(userId);
      return null;
    }

    // 2. SUCCESS: Rotate tokens
    const user = { id: userId, username: session.username, role: session.role }; // We might need more user data if we want it in the payload
    const newTokens = await issueSession(user, deviceInfo, deviceId);

    // Update lastActiveAt is handled by issueSession (overwrites sessionKey)
    return newTokens;

  } catch (error) {
    logger.error('[JWT] Refresh failed:', error.message);
    return null;
  }
};

/**
 * Revoke specific session
 */
const revokeSession = async (userId, deviceId) => {
  const sessionKey = `session:${userId}:${deviceId}`;
  const userSessionsKey = `user:sessions:${userId}`;

  await clearCache(sessionKey);

  // Remove deviceId from tracking list
  const devices = await getCache(userSessionsKey) || [];
  const updatedDevices = devices.filter(d => d !== deviceId);
  if (updatedDevices.length > 0) {
    await setCache(userSessionsKey, updatedDevices, REFRESH_TOKEN_EXPIRY_SECONDS);
  } else {
    await clearCache(userSessionsKey);
  }

  logger.info(`[JWT] Session revoked for User ${userId} [Device: ${deviceId}]`);
};

/**
 * Revoke ALL sessions for a user
 */
const revokeAllSessions = async (userId) => {
  const userSessionsKey = `user:sessions:${userId}`;
  const devices = await getCache(userSessionsKey) || [];

  for (const deviceId of devices) {
    await clearCache(`session:${userId}:${deviceId}`);
  }
  await clearCache(userSessionsKey);

  logger.info(`[JWT] ALL sessions revoked for User ${userId}`);
};

/**
 * Get List of Active Devices
 */
const getActiveSessions = async (userId) => {
  const userSessionsKey = `user:sessions:${userId}`;
  const devices = await getCache(userSessionsKey) || [];
  const sessions = [];

  for (const deviceId of devices) {
    const data = await getCache(`session:${userId}:${deviceId}`);
    if (data) {
      // Remove sensitive rtHash before returning
      const { rtHash, ...publicData } = data;
      sessions.push(publicData);
    }
  }

  return sessions;
};

module.exports = {
  issueSession,
  refreshSession,
  revokeSession,
  revokeAllSessions,
  getActiveSessions
};
