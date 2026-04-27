const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const socketService = require('./services/socketService');
const handleSocketEvents = require('./socket/socketHandler');
const db = require('./db');
const logger = require('./utils/logger');

const server = http.createServer(app);

// Initialize Socket.io via Service
const io = socketService.init(server, config);

// Initialize Socket.io Logic Handler
handleSocketEvents(io);

const PORT = config.port;

// Initialize Database then start the server
db.initDb().then(() => {
  logger.info('Database initialized successfully.');
}).catch(err => {
  logger.error('\n=========================================');
  logger.error('Failed to initialize database!');
  logger.error('Please check your DATABASE_URL in the .env file.');
  logger.error('=========================================\n', err);
}).finally(() => {
  // Always start the server, even if the DB fails to connect early on.
  server.listen(PORT, () => {
    logger.info(`Core initialized on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    
    // 🔍 Startup Diagnostics
    const resendKeyStatus = config.resendApiKey && config.resendApiKey !== 're_123456789' ? '✅ VALID' : '❌ MISSING/PLACEHOLDER';
    console.log('\n--- 🧠 AI INTERVIEW ASSISTANT STATUS ---');
    console.log(`🤖 AI SIMULATION:    ${config.aiSimulationMode ? '🟢 ACTIVE' : '⚪ OFF'}`);
    console.log(`📧 EMAIL SIMULATION: ${config.emailSimulationMode ? '🟢 ACTIVE' : '⚪ OFF'}`);
    console.log(`🔑 RESEND KEY:      ${resendKeyStatus}`);
    console.log('----------------------------------------\n');
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use. Please close the other process and try again.`);
    process.exit(1);
  } else {
    throw err;
  }
});
