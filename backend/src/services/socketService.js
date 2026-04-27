const { Server } = require('socket.io');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.io with the given HTTP server
   */
  init(server, config) {
    this.io = new Server(server, {
      cors: {
        origin: [
          config.corsOrigin || 'http://localhost:5173',
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:3000',
          'file://',
          'capacitor://localhost',
          'ionic://localhost',
          'http://localhost',
          'http://127.0.0.1:*',
          '*'
        ],
        methods: ["GET", "POST"],
        credentials: true,
        allowEIO3: true
      },
      allowEIO3: true,
      transports: ['websocket', 'polling'],
      // Increase ping timeout for longer interview sessions
      pingTimeout: 120000,    // 2 minutes (default is 5 seconds)
      pingInterval: 60000,    // 1 minute (default is 25 seconds)
      // Allow more time for connection upgrades
      upgradeTimeout: 30000,  // 30 seconds (default is 10 seconds)
      // Increase max HTTP buffer size for audio chunks
      maxHttpBufferSize: 1e8  // 100MB (default is 1MB)
    });

    logger.info('SocketService initialized with enhanced CORS and extended timeouts for interviews');
    return this.io;
  }

  /**
   * Broadcast a generic notification to all connected clients
   */
  sendNotification(message, type = 'info') {
    if (!this.io) {
      logger.warn('SocketService: Attempted to send notification before initialization');
      return;
    }
    
    logger.info(`[Socket] Broadcasting notification: ${message}`);
    this.io.emit('notification', { message, type, timestamp: new Date() });
  }

  /**
   * Send a private notification to a specific user channel
   */
  sendToUser(userId, message, type = 'info') {
    if (!this.io) {
      logger.warn('SocketService: Attempted to send targeted notification before initialization');
      return;
    }

    const room = `user_${userId}`;
    logger.info(`[Socket] Sending private notification to room ${room}: ${message}`);
    this.io.to(room).emit('notification', { message, type, timestamp: new Date() });
  }

  /**
   * Get the IO instance if needed for advanced usage
   */
  getIO() {
    return this.io;
  }
}

// Export a singleton instance
module.exports = new SocketService();
