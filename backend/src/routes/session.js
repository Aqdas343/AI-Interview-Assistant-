const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const { validateAnswer, validateRequest } = require('../middleware/validator');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @swagger
 * /api/v1/session/start:
 *   post:
 *     summary: Start a new interview session
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Session started successfully
 */
router.post('/start', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(sessionController.startSession));

/**
 * @swagger
 * /api/v1/session/answer:
 *   post:
 *     summary: Submit an answer and get AI feedback
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: integer
 *               question:
 *                 type: string
 *               answer:
 *                 type: string
 *     responses:
 *       201:
 *         description: Answer submitted and feedback received
 */
router.post('/answer', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), validateAnswer, validateRequest, asyncHandler(sessionController.submitAnswer));

/**
 * @swagger
 * /api/v1/session/{id}/next-question:
 *   get:
 *     summary: Generate the next adaptive interview question
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: roleOrTopic
 *         schema:
 *           type: string
 *         description: Optional role or topic to focus on
 *     responses:
 *       200:
 *         description: Next question generated successfully
 */
router.get('/:sessionId/next-question', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(sessionController.getNextQuestion));

/**
 * @swagger
 * /api/v1/session/{id}:
 *   get:
 *     summary: Get session details and answers
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session details retrieved
 */
router.get('/:id', authenticateToken, authorize(PERMISSIONS.VIEW_TRANSCRIPT), asyncHandler(sessionController.getSession));

/**
 * @swagger
 * /api/v1/session/{id}/end:
 *   post:
 *     summary: End an interview session
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session ended
 */
router.post('/:id/end', authenticateToken, authorize(PERMISSIONS.START_INTERVIEW), asyncHandler(sessionController.endSession));

module.exports = router;
