const config = require('../config');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Try to use the error's own status code, default to 500
  const statusCode = err.statusCode || err.status || 500;
  
  if (config.nodeEnv === 'development') {
    // Detailed error for developers
    res.status(statusCode).json({
      success: false,
      message: err.message,
      error: err,
      stack: err.stack,
    });
  } else {
    // Production Mode: separate operational errors from unknown programming errors
    if (err.isOperational) {
      // Known client error
      res.status(statusCode).json({
        success: false,
        message: err.message,
      });
    } else {
      // Programming or other unknown error: don't leak error details to client
      logger.error('ERROR 💥', err);
      res.status(500).json({
        success: false,
        message: 'Something went very wrong!',
      });
    }
  }
};

module.exports = { errorHandler };
