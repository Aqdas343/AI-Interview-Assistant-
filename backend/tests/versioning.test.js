const request = require('supertest');
const app = require('../src/app');

describe('API Versioning and Backward Compatibility', () => {
  it('should respond to /api/v1/health with v1 format', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version', 'v1');
  });

  it('should respond to /api/health with v1 format for backward compatibility', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version', 'v1');
  });

  it('should start a session on /api/v1/start', async () => {
    const response = await request(app).post('/api/v1/start');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version', 'v1');
  });

  it('should start a session on /api/start for backward compatibility', async () => {
    const response = await request(app).post('/api/start');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version', 'v1');
  });
});
