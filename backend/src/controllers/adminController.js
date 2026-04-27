const User = require('../models/User');
const sessionService = require('../services/sessionService');
const auditService = require('../services/auditService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * PRODUCTION-GRADE ADMINISTRATIVE CONTROLLER
 * Strictly guarded by RBAC permissions.
 */

// 1. User Management
const listUsers = async (req, res) => {
  const { limit, offset } = req.query;
  const users = await User.findAll(parseInt(limit) || 50, parseInt(offset) || 0);
  res.status(200).json(users);
};

const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Security: Prevent self-escalation
  if (req.user.userId == id) {
    throw new AppError('Self-escalation prohibited. You cannot modify your own administrative role.', 403);
  }

  const updatedUser = await User.updateRole(id, role);
  
  // Audit Log: Track administrative change
  await auditService.logEvent(req, {
    userId: req.user.userId,
    eventType: auditService.EVENT_TYPES.ADMIN_ACTION,
    status: auditService.STATUS.SUCCESS,
    metadata: { targetUserId: id, action: 'ROLE_UPDATE', newRole: role }
  });

  res.status(200).json({ message: 'User role updated successfully', user: updatedUser });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user.userId == id) {
    throw new AppError('Self-deletion prohibited.', 403);
  }

  // Revoke all sessions first
  await sessionService.revokeAllSessions(id);
  
  const success = await User.delete(id);
  if (!success) throw new AppError('User not found', 404);

  // Audit Log: Track administrative change
  await auditService.logEvent(req, {
    userId: req.user.userId,
    eventType: auditService.EVENT_TYPES.ADMIN_ACTION,
    status: auditService.STATUS.SUCCESS,
    metadata: { targetUserId: id, action: 'USER_DELETE' }
  });

  res.status(200).json({ message: 'User and all sessions deleted successfully' });
};

// 2. Session Inspection
const inspectUserSessions = async (req, res) => {
  const { id } = req.params;
  const sessions = await sessionService.getActiveSessions(id);
  res.status(200).json(sessions);
};

const adminRevokeSession = async (req, res) => {
  const { id, deviceId } = req.params;

  await sessionService.revokeSession(id, deviceId);

  // Audit Log
  await auditService.logEvent(req, {
    userId: req.user.userId,
    eventType: auditService.EVENT_TYPES.ADMIN_ACTION,
    status: auditService.STATUS.SUCCESS,
    metadata: { targetUserId: id, action: 'SESSION_REVOKE', deviceId }
  });

  res.status(200).json({ message: 'Session revoked successfully' });
};

// 3. Audit Log Querying
const getAuditLogs = async (req, res) => {
  const { userId, eventType, since, until, limit, offset } = req.query;

  const logs = await auditService.findLogs({
    userId,
    eventType,
    since,
    until,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0
  });

  res.status(200).json(logs);
};

module.exports = {
  listUsers,
  updateUserRole,
  deleteUser,
  inspectUserSessions,
  adminRevokeSession,
  getAuditLogs
};
