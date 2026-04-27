const crypto = require('crypto');

/**
 * Generate a unique device ID from request headers if not provided
 */
const getDeviceId = (req) => {
  return req.headers['x-device-id'] || 
         crypto.createHash('md5').update(req.headers['user-agent'] + req.ip).digest('hex');
};

module.exports = { getDeviceId };
