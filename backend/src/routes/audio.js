const express = require('express');
const { uploadAndTranscribe } = require('../controllers/audioController');
const { audioUpload } = require('../middleware/upload');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * @swagger
 * /api/v1/audio/upload:
 *   post:
 *     summary: Upload and transcribe an audio file
 *     tags: [Audio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The audio file to upload (MP3, WAV, WEBM)
 *     responses:
 *       200:
 *         description: Audio transcribed successfully
 *       400:
 *         description: Bad request (invalid file type)
 */
router.post('/upload', authenticateToken, authorize(PERMISSIONS.PROCESS_AUDIO), audioUpload.single('file'), asyncHandler(uploadAndTranscribe));

module.exports = router;
