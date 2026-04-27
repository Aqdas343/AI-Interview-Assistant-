const { body, validationResult } = require('express-validator');

const validateRegister = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .escape(),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

const validateLogin = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Input validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateAnswer = [
  body('sessionId').isInt().withMessage('Valid session ID is required'),
  body('question').trim().notEmpty().withMessage('Question is required').escape(),
  body('answer').trim().notEmpty().withMessage('Answer is required').escape()
];

module.exports = {
  validateRegister,
  validateLogin,
  validateAnswer,
  checkValidation,
  validateRequest: checkValidation
};
