const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const handleSocketEvents = require('./src/socket/socketHandler');
const { Server } = require('socket.io');

console.log('🚀 Starting Voice Assistant Backend...');

// Create Express app
const app = express();
const server = http.createServer(app);

// Setup CORS
app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Voice Assistant Backend is running',
    timestamp: new Date().toISOString(),
    config: {
      aiProvider: config.aiServiceProvider,
      hasOpenAI: !!config.openaiApiKey,
      hasGemini: !!config.geminiApiKey,
      hasGroq: !!config.groqApiKey,
      hasDeepgram: !!config.deepgramApiKey,
      simulationMode: config.aiSimulationMode
    }
  });
});

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Handle socket events
handleSocketEvents(io);

// Start server
const PORT = config.port || 5000;
server.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`🤖 AI Provider: ${config.aiServiceProvider}`);
  console.log(`🚀 Groq Key: ${config.groqApiKey ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎤 Deepgram Key: ${config.deepgramApiKey ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🔑 OpenAI Key: ${config.openaiApiKey ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎯 Simulation Mode: ${config.aiSimulationMode ? 'ON' : 'OFF'}`);
  console.log(`🎤 Ready for voice conversations!`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});