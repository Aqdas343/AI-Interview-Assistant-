const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const aiService = require('../src/services/aiService');

// Mock aiService so we don't call actual OpenAI during tests
jest.mock('../src/services/aiService');

beforeAll(async () => {
  // Ensure DB is initialized
  await db.initDb();
  db.resetDb();
});

describe('Session and Analytics Endpoints', () => {
  let token;
  let sessionId;

  beforeAll(async () => {
    const dynamicEmail = `session${Date.now()}@test.com`;
    // 1. Create a mock user via register endpoint to ensure password is hashed
    await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'testsession', email: dynamicEmail, password: 'password123' });
    
    // 2. Login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: dynamicEmail, password: 'password123' });
    
    token = loginRes.body.token;
  });

  describe('Session Management', () => {
    it('should start a new session', async () => {
      const res = await request(app)
        .post('/api/v1/session/start')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      sessionId = res.body.data.id;
    });

    it('should submit an answer and get mock AI feedback', async () => {
      // Setup mock return using structured JSON format
      const mockFeedback = {
        score: 85,
        strengths: ["Clear explanation", "Mentioned functional components"],
        weaknesses: ["Could mention clean-up effects"],
        suggestion: "Read more about useEffect hooks."
      };
      
      aiService.generateFeedback.mockResolvedValue({
        feedback: JSON.stringify(mockFeedback),
        score: 85
      });

      const res = await request(app)
        .post('/api/v1/session/answer')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId,
          question: "Explain React hooks.",
          answer: "Hooks allow state in functional components."
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      // Backend now returns stringified JSON in ai_feedback
      const feedback = JSON.parse(res.body.data.ai_feedback);
      expect(feedback.score).toBe(85);
      expect(res.body.data.score).toBe(85);
    });

    it('should get session details', async () => {
      const res = await request(app)
        .get(`/api/v1/session/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answers.length).toBeGreaterThan(0);
    });

    it('should end a session', async () => {
      const res = await request(app)
        .post(`/api/v1/session/${sessionId}/end`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ended_at).not.toBeNull();
    });
  });

  describe('Analytics', () => {
    it('should calculate performance analytics correctly', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/performance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Ensure we compare numbers (mock DB might return string or float)
      expect(Number(res.body.data.averageScore)).toBe(85);
    });
  });
});
