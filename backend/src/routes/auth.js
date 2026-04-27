const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { register, login, refreshToken, logout, getSessions, logoutAll, getProfile } = require('../controllers/auth');
const { googleOAuthLogin } = require('../controllers/socialAuth');
const { validateRequest } = require('../middleware/validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/roles');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Strict Rate Limiting specifically for Authentication
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { status: 'error', message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .notEmpty().withMessage('Email is required'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

router.post('/register', authValidation, validateRequest, asyncHandler(register));
router.post('/login', loginLimiter, authValidation, validateRequest, asyncHandler(login));
router.post('/social/google', loginLimiter, asyncHandler(googleOAuthLogin));
router.post('/refresh', asyncHandler(refreshToken));

// Session Management (Multi-device support with granular RBAC)
router.get('/sessions', authenticateToken, authorize(PERMISSIONS.READ_DEVICES), asyncHandler(getSessions));
router.delete('/sessions', authenticateToken, authorize(PERMISSIONS.REVOKE_SESSION), asyncHandler(logoutAll));
router.delete('/logout', authenticateToken, authorize(PERMISSIONS.REVOKE_SESSION), asyncHandler(logout)); 

router.get('/profile', authenticateToken, asyncHandler(getProfile));

module.exports = router;

