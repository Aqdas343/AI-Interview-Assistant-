const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/v1/test/ping:
 *   get:
 *     summary: Simple ping test endpoint
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Successful ping response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "pong"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
    version: 'v1'
  });
});

/**
 * @swagger
 * /api/v1/test/echo:
 *   post:
 *     summary: Echo test endpoint
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Hello World"
 *     responses:
 *       200:
 *         description: Echo response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 echo:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.post('/echo', (req, res) => {
  const { message } = req.body;
  res.json({
    echo: message || 'No message provided',
    timestamp: new Date().toISOString(),
    version: 'v1'
  });
});

/**
 * @swagger
 * /api/v1/test/status:
 *   get:
 *     summary: System status test endpoint
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: System status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 uptime:
 *                   type: number
 *                 memory:
 *                   type: object
 *                 environment:
 *                   type: string
 */
router.get('/status', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
    },
    environment: process.env.NODE_ENV || 'development',
    version: 'v1',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;