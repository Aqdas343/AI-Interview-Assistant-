const bcrypt = require('bcrypt');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const sessionService = require('../services/sessionService');
const { getDeviceId } = require('../utils/fingerprint');
const { logEvent, EVENT_TYPES, STATUS } = require('../services/auditService');

const register = async (req, res) => {
  const { email, password, username } = req.body;

  const existingUser = await User.findByEmail(email);
  if (existingUser) throw new AppError('Email already exists', 409);

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create(username || email.split('@')[0], hashedPassword, email);

  res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    logEvent(req, { eventType: EVENT_TYPES.LOGIN_FAILED, status: STATUS.FAILURE, metadata: { email, reason: 'User not found' } });
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    logEvent(req, { eventType: EVENT_TYPES.LOGIN_FAILED, status: STATUS.FAILURE, metadata: { email, reason: 'Wrong password' } });
    throw new AppError('Invalid credentials', 401);
  }

  const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
  const deviceId = getDeviceId(req);

  const tokens = await sessionService.issueSession(user, deviceInfo, deviceId);

  logEvent(req, { userId: user.id, eventType: EVENT_TYPES.LOGIN_SUCCESS, status: STATUS.SUCCESS });

  res.status(200).json({
    message: 'Login successful',
    ...tokens,
    userId: user.id,
    username: user.username,
    role: user.role
  });
};

const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) throw new AppError('Refresh token required', 400);

  const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
  const newTokens = await sessionService.refreshSession(token, deviceInfo);

  if (!newTokens) {
    throw new AppError('Invalid or expired refresh token. Please login again.', 401);
  }

  res.status(200).json(newTokens);
};

const logout = async (req, res) => {
  const deviceId = getDeviceId(req);
  await sessionService.revokeSession(req.user.userId, deviceId);
  
  logEvent(req, { userId: req.user.userId, eventType: EVENT_TYPES.LOGOUT, status: STATUS.SUCCESS, metadata: { deviceId, type: 'single' } });
  
  res.status(200).json({ message: 'Device logged out successfully' });
};

const getSessions = async (req, res) => {
  const sessions = await sessionService.getActiveSessions(req.user.userId);
  res.status(200).json(sessions);
};

const logoutAll = async (req, res) => {
  await sessionService.revokeAllSessions(req.user.userId);
  
  logEvent(req, { userId: req.user.userId, eventType: EVENT_TYPES.LOGOUT, status: STATUS.SUCCESS, metadata: { type: 'all' } });

  res.status(200).json({ message: 'All active sessions terminated' });
};

const getProfile = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) throw new AppError('User not found', 404);

  res.status(200).json({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  });
};

module.exports = { register, login, refreshToken, logout, getSessions, logoutAll, getProfile };


