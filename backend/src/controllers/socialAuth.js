const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const User = require('../models/User');
const sessionService = require('../services/sessionService');
const { getDeviceId } = require('../utils/fingerprint');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Create OAuth2Client with proper configuration
const client = new OAuth2Client(config.googleClientId);

// Set timeout for Google API requests
const GOOGLE_API_TIMEOUT = 15000; // 15 seconds

/**
 * 🔐 Simple Google OAuth Login
 * Verifies the ID token from frontend and syncs user with database.
 */
const googleOAuthLogin = async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw new AppError('Google credential is required', 400);

  logger.info('[GOOGLE_AUTH] Starting OAuth verification...');
  logger.info('[GOOGLE_AUTH] Client ID:', config.googleClientId ? 'SET' : 'MISSING');
  logger.info('[GOOGLE_AUTH] Client Secret exists:', !!config.googleClientSecret);

  try {
    // 1. Verify the ID Token from Google with timeout
    logger.info('[GOOGLE_AUTH] Verifying token with Google...');
    
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    logger.info('[GOOGLE_AUTH] Token verified successfully');
    logger.info('[GOOGLE_AUTH] User email:', email);
    logger.info('[GOOGLE_AUTH] Google ID:', googleId);

    if (!email) throw new AppError('Email not provided by Google', 400);

    // 2. Find or Create User
    logger.info('[GOOGLE_AUTH] Looking up user by Google ID...');
    let user = await User.findByGoogleId(googleId);

    if (!user) {
      logger.info('[GOOGLE_AUTH] User not found by Google ID, checking by email...');
      // Fallback: check by email if Google ID isn't linked yet
      user = await User.findByEmail(email);
      
      if (!user) {
        // New user: Create account
        logger.info('[GOOGLE_AUTH] Creating new user account...');
        const username = name || email.split('@')[0];
        user = await User.create(username, null, email, googleId);
        logger.info('[GOOGLE_AUTH] New user created:', user?.id);
        
        // Ensure user object has required properties
        if (!user || !user.id) {
          throw new AppError('Failed to create user account', 500);
        }
      } else {
        // Existing user: Link Google ID
        logger.info('[GOOGLE_AUTH] Linking Google ID to existing user...');
        user = await User.linkGoogleAccount(user.id, googleId);
        logger.info('[GOOGLE_AUTH] Google ID linked successfully');
        
        // Ensure user object has required properties
        if (!user || !user.id) {
          throw new AppError('Failed to link Google account', 500);
        }
      }
    } else {
      logger.info('[GOOGLE_AUTH] User found:', user.id);
    }

    // Validate user object before proceeding
    if (!user || !user.id) {
      logger.error('[GOOGLE_AUTH] Invalid user object:', user);
      throw new AppError('User authentication failed - invalid user data', 500);
    }

    // 3. Issue Session Tokens
    logger.info('[GOOGLE_AUTH] Issuing session tokens for user:', user.id);
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const deviceId = getDeviceId(req);
    
    // Ensure user object has all required properties for session
    const sessionUser = {
      id: user.id,
      username: user.username || name || email.split('@')[0],
      email: user.email || email,
      role: user.role || 'candidate'
    };
    
    const tokens = await sessionService.issueSession(sessionUser, deviceInfo, deviceId);

    logger.info('[GOOGLE_AUTH] Login successful for user:', user.id);
    res.status(200).json({
      message: 'Logged in with Google',
      ...tokens,
      userId: user.id,
      username: user.username || name || email.split('@')[0],
      email: user.email || email,
      role: user.role || 'candidate',
      picture
    });

  } catch (error) {
    logger.error('[GOOGLE_LOGIN_ERROR] Full Error:', error);
    logger.error('[GOOGLE_LOGIN_ERROR] Message:', error.message);
    logger.error('[GOOGLE_LOGIN_ERROR] Stack:', error.stack);
    
    // Specific error handling for network issues
    if (error.message && (
        error.message.includes('getaddrinfo ENOTFOUND') || 
        error.message.includes('ENOTFOUND www.googleapis.com') ||
        error.message.includes('Failed to retrieve verification certificates') ||
        error.message.includes('Google verification timeout') ||
        error.message.includes('socket hang up') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNRESET')
    )) {
        logger.error('[GOOGLE_CONFIG_ERROR] Network connectivity issue - cannot reach Google servers');
        throw new AppError('Google sign-in is temporarily unavailable due to network issues. Please use email login instead.', 503);
    }
    
    // Other specific error handling
    if (error.message && error.message.includes('idtoken only works with a client id')) {
        logger.error('[GOOGLE_CONFIG_ERROR] GOOGLE_CLIENT_ID is missing or invalid in .env');
        throw new AppError('Google OAuth configuration error. Please contact support.', 500);
    }
    
    if (error.message && error.message.includes('Invalid token')) {
      logger.error('[GOOGLE_CONFIG_ERROR] The token might be expired or invalid');
      throw new AppError('Google token is invalid or expired. Please try again.', 401);
    }
    
    if (error.message && error.message.includes('Token used too early')) {
      logger.error('[GOOGLE_CONFIG_ERROR] Clock skew issue - check server time');
      throw new AppError('Server time synchronization issue. Please try again.', 500);
    }
    
    // Generic network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.error('[GOOGLE_CONFIG_ERROR] Network connectivity issue:', error.code);
      throw new AppError('Unable to connect to Google services. Please use email login instead.', 503);
    }
    
    // Generic error
    const errorMessage = error.message || 'Unknown error occurred during Google authentication';
    throw new AppError(`Google authentication failed: ${errorMessage}`, error.statusCode || 500);
  }
};

module.exports = { googleOAuthLogin };

