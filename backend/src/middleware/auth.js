const jwt = require('jsonwebtoken');
const config = require('../config');
const { getPermissionsByRole } = require('../config/roles');
const { logEvent, EVENT_TYPES, STATUS } = require('../services/auditService');

/**
 * Passport-style Authentication Middleware
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please re-authenticate.' });
    }
    return res.status(403).json({ message: 'Invalid or tampered token.' });
  }
};

/**
 * 🛡 RBAC Authorization Guard
 * @param {string|string[]} permissions - Required permission(s)
 * @param {string} mode - 'AND' (all) or 'OR' (any). Default 'OR'.
 */
const authorize = (permissions, mode = 'OR') => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: Missing identity context.' });
    }

    const userPermissions = getPermissionsByRole(req.user.role);
    const required = Array.isArray(permissions) ? permissions : [permissions];

    let hasAccess = false;
    if (mode === 'AND') {
      hasAccess = required.every(p => userPermissions.includes(p));
    } else {
      hasAccess = required.some(p => userPermissions.includes(p));
    }

    if (!hasAccess) {
      logEvent(req, { 
        userId: req.user.userId, 
        eventType: EVENT_TYPES.PERMISSION_DENIED, 
        status: STATUS.FAILURE, 
        metadata: { 
          requiredPermissions: permissions, 
          path: req.originalUrl 
        } 
      });
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions for this operation.' });
    }

    next();
  };
};

/**
 * Backward compatibility wrapper (Deprecated in favor of authorize)
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Role mismatch.' });
    }
    next();
  };
};

module.exports = { authenticateToken, authorize, checkRole };
