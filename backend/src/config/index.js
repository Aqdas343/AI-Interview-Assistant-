require('dotenv').config();

const toBool = (val) => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'yes';
};

module.exports = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_123',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || (process.env.JWT_SECRET + '_refresh'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  aiSimulationMode: toBool(process.env.AI_SIMULATION_MODE),
  emailSimulationMode: toBool(process.env.EMAIL_SIMULATION_MODE),
  aiServiceProvider: process.env.AI_SERVICE_PROVIDER || 'groq',
  geminiApiKey: process.env.GEMINI_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'Clue Assistant <onboarding@resend.dev>',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
};
