const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./middleware/auth');
const uploadRoutes = require('./routes/upload');
const testRoutes = require('./routes/test');
const sessionRoutes = require('./routes/session');
const analyticsRoutes = require('./routes/analytics');
const audioRoutes = require('./routes/audio');
const adminRoutes = require('./routes/admin');
const interviewRoutes = require('./routes/interview');
const chatRoutes = require('./routes/chat');

// Swagger Components
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

const app = express();

// Security Middlewares - Disable COOP for Google OAuth compatibility
app.use(helmet({
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

// Serve Interactive API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use(cors({ 
  origin: [
    config.corsOrigin,
    'file://',
    'http://localhost:5173',
    'http://localhost:3000',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://127.0.0.1'
  ],
  credentials: true
}));
app.use(express.json());

// Serve Static Files (Uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});
app.use('/api/', limiter);

// ─────────────────────────────────────────────────────────────────────
// API v1 Router — canonical versioned routes live here
// ─────────────────────────────────────────────────────────────────────
const v1Router = express.Router();

v1Router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', version: 'v1', environment: config.nodeEnv });
});

v1Router.post('/start', (req, res) => {
  const sessionId = Math.random().toString(36).substring(7);
  res.json({ sessionId, status: 'initialized', version: 'v1' });
});

v1Router.use('/auth', authRoutes);
v1Router.use('/upload', uploadRoutes);
v1Router.use('/test', testRoutes);
v1Router.use('/session', sessionRoutes);
v1Router.use('/analytics', analyticsRoutes);
v1Router.use('/audio', audioRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/interview', interviewRoutes);
v1Router.use('/chat', chatRoutes);

v1Router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'You have accessed a protected route!', user: req.user, version: 'v1' });
});

// Mount v1 at /api/v1
app.use('/api/v1', v1Router);

// ─────────────────────────────────────────────────────────────────────
// Backward Compatibility — /api/* proxies to /api/v1/*
// Clients using the old /api/auth, /api/upload etc. still work.
// ─────────────────────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  // If the request is already for /v1, let it pass to the next handler
  if (req.url.startsWith('/v1')) {
    return next();
  }
  
  // Otherwise, re-dispatch through the v1 router
  v1Router(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────
// Global health check (no version)
// ─────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', environment: config.nodeEnv, latestVersion: 'v1' });
});

// Error Handling
app.use(errorHandler);

module.exports = app;

