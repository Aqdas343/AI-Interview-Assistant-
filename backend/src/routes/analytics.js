const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @swagger
 * /api/v1/analytics/performance:
 *   get:
 *     summary: Get performance analytics for the current user
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved
 */
router.get('/performance', authenticateToken, authorize(PERMISSIONS.VIEW_ANALYTICS), asyncHandler(analyticsController.getPerformance));

module.exports = router;
