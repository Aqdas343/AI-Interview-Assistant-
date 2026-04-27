const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const asyncHandler = require('../utils/asyncHandler');

/**
 * 🎙 INTERVIEW LIFECYCLE V2 (EVENT-DRIVEN)
 */

router.post('/start', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(interviewController.startSession));
router.get('/:id/resume', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(interviewController.resumeSession));
router.get('/:id/events', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(interviewController.getSessionEvents));
router.get('/:id/report', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(interviewController.getSessionReport));
router.post('/:id/submit', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(interviewController.submitAnswer));
router.post('/:id/end', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(interviewController.endSession));

module.exports = router;
