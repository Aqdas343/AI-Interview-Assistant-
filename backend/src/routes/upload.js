const express = require('express');
const { uploadFile } = require('../controllers/upload');
const { upload } = require('../middleware/upload');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * @route POST /api/upload
 * @desc Securely upload a single file
 * @access Private
 */
router.post('/', authenticateToken, authorize(PERMISSIONS.UPLOAD_FILES), upload.single('file'), asyncHandler(uploadFile));

module.exports = router;
