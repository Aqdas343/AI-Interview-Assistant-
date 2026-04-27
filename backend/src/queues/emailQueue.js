const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const { isRedisActive } = require('../utils/redisCache');
const socketService = require('../services/socketService');

// Initialize the queue only if Redis is active to prevent connection spam/crash
let emailQueue;
if (isRedisActive()) {
  emailQueue = new Bull('email-queue', config.redisUrl);

  // Process jobs
  emailQueue.process(async (job) => {
    const { email, subject, message, userId } = job.data;
    
    logger.info(`[Queue] Processing email job for: ${email}`);
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logger.info(`[Queue] Email successfully sent to: ${email}`);
    
    if (userId) {
      socketService.sendToUser(userId, `Email dispatched successfully to ${email}`, 'success');
    }

    return { status: 'sent', email };
  });

  emailQueue.on('failed', (job, err) => {
    logger.error(`[Queue] Job ${job.id} failed: ${err.message}`);
  });
}

/**
 * Resilient Job Producer
 * If Redis is active, it adds to queue.
 * Otherwise, it executes the payload immediately (Instant Mode).
 */
const addEmailJob = async (data) => {
  if (isRedisActive()) {
    logger.info(`[Queue] Adding email job to background queue for: ${data.email}`);
    return await emailQueue.add(data);
  } else {
    logger.warn(`[Queue] Redis Offline: Executing email simulation immediately for: ${data.email}`);
    
    // Simulation logic (Instant Mode)
    logger.info(`[Instant-Mode] Processing email simulation for: ${data.email}`);
    // No delay in instant mode for better dev experience, or small delay if preferred
    logger.info(`[Instant-Mode] Email simulation completed for: ${data.email}`);
    
    if (data.userId) {
      socketService.sendToUser(data.userId, `Email simulation completed for ${data.email}`, 'info');
    }

    return { status: 'completed-immediately', data };
  }
};

module.exports = {
  addEmailJob
};
