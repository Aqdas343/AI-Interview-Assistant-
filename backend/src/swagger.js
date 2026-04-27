const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Backend API — v1',
      version: '1.0.0',
      description: `
## API Versioning

All routes are served under **\`/api/v1/\`** (canonical).

For **backward compatibility**, legacy \`/api/*\` paths are aliased to \`/api/v1/*\` automatically — existing clients require zero changes.

| Base Path      | Status      |
|----------------|-------------|
| \`/api/v1/\`   | ✅ Current  |
| \`/api/\`      | ⚠️ Legacy alias (maps to v1) |
      `,
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Global health check',
          tags: ['System'],
          responses: {
            200: {
              description: 'System is healthy',
              content: {
                'application/json': {
                  example: { status: 'OK', environment: 'development', latestVersion: 'v1' }
                }
              }
            }
          }
        }
      },
      '/api/v1/health': {
        get: {
          summary: 'v1 Health check',
          tags: ['System'],
          responses: {
            200: {
              description: 'System is healthy',
              content: {
                'application/json': {
                  example: { status: 'OK', version: 'v1', environment: 'development' }
                }
              }
            }
          }
        }
      },
      '/api/v1/start': {
        post: {
          summary: 'Initialize a new session',
          tags: ['System'],
          responses: {
            200: {
              description: 'Session created',
              content: {
                'application/json': {
                  example: { sessionId: 'xyz123', status: 'initialized', version: 'v1' }
                }
              }
            }
          }
        }
      },
      '/api/v1/auth/register': {
        post: {
          summary: 'Register a new user',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'testuser' },
                    password: { type: 'string', example: 'password123' }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: 'User registered successfully' },
            400: { description: 'Validation error (e.g. password too short)' },
            409: { description: 'Username already exists' }
          }
        }
      },
      '/api/v1/auth/login': {
        post: {
          summary: 'Log in and retrieve a JWT',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'testuser' },
                    password: { type: 'string', example: 'password123' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Login successful, returns JWT token' },
            401: { description: 'Invalid credentials' }
          }
        }
      },
      '/api/v1/protected': {
        get: {
          summary: 'Access protected data',
          tags: ['Protected Route'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Protected data retrieved successfully' },
            401: { description: 'Access denied. No token provided.' },
            403: { description: 'Invalid token.' }
          }
        }
      },
      '/api/v1/upload': {
        post: {
          summary: 'Securely upload a single file',
          tags: ['File Upload'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary',
                      description: 'The file to upload (JPEG, PNG, or PDF)'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'File uploaded successfully',
              content: {
                'application/json': {
                  example: {
                    status: 'success',
                    message: 'File uploaded successfully',
                    file: {
                      originalName: 'profile.jpg',
                      filename: '123456789-987654321-profile.jpg',
                      size: 15420,
                      mimetype: 'image/jpeg'
                    }
                  }
                }
              }
            },
            400: { description: 'Bad request (e.g. invalid file type or no file)' },
            401: { description: 'Access denied. No token provided.' }
          }
        }
      },
      '/api/v1/test/email': {
        post: {
          summary: 'Trigger a sample background email job',
          tags: ['Background Jobs'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', example: 'user@example.com' },
                    subject: { type: 'string', example: 'Welcome!' },
                    message: { type: 'string', example: 'This was processed in the background.' },
                    userId: { type: 'string', example: '42', description: 'Optional. If provided, a private success notification is sent to this user.' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Job successfully triggered',
              content: {
                'application/json': {
                  example: { status: 'success', message: 'Email job triggered', details: { id: '123' } }
                }
              }
            },
            400: { description: 'Bad request (missing email)' }
          }
        }
      },
      '/api/v1/test/notify': {
        post: {
          summary: 'Trigger a real-time notification broadcast',
          tags: ['Background Jobs'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Protocol initialized. Full system online.' },
                    type: { type: 'string', example: 'success', enum: ['info', 'success', 'warning', 'error'] }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Notification successfully broadcasted',
              content: {
                'application/json': {
                  example: { status: 'success', message: 'Real-time notification broadcasted', details: { message: '...', type: 'success' } }
                }
              }
            },
            400: { description: 'Bad request (missing message)' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = specs;

