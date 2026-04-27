const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const asyncHandler = require('../utils/asyncHandler');

/**
 * 🔐 ADMINISTRATIVE DASHBOARD ROUTES
 * Every endpoint is strictly guarded by the ADMIN_PANEL permission.
 */

// User Management
router.get('/users', authenticateToken, authorize(PERMISSIONS.ADMIN_PANEL), asyncHandler(adminController.listUsers));
router.patch('/users/:id/role', authenticateToken, authorize(PERMISSIONS.MANAGE_ROLES), asyncHandler(adminController.updateUserRole));
router.delete('/users/:id', authenticateToken, authorize(PERMISSIONS.MANAGE_USERS), asyncHandler(adminController.deleteUser));

// Session Intelligence
router.get('/users/:id/sessions', authenticateToken, authorize(PERMISSIONS.ADMIN_PANEL), asyncHandler(adminController.inspectUserSessions));
router.delete('/users/:id/sessions/:deviceId', authenticateToken, authorize(PERMISSIONS.ADMIN_PANEL), asyncHandler(adminController.adminRevokeSession));

// Audit & Security logs
router.get('/audit-logs', authenticateToken, authorize(PERMISSIONS.ADMIN_PANEL), asyncHandler(adminController.getAuditLogs));

module.exports = router;
