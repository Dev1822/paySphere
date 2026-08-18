const request = require('supertest');
const express = require('express');
const globalErrorHandler = require('../error.middleware');
const { AppError } = require('../../utils/apiError');

describe('Global Error Handler', () => {
  let app;
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(() => {
    app = express();
    app.get('/test-error', (req, res, next) => {
      next(new AppError('Operational database failure', 400));
    });
    app.get('/test-programming-error', (req, res, next) => {
      next(new Error('Database connection timed out internally'));
    });
    app.use(globalErrorHandler);
  });

  it('should return detailed error stack and metadata in development environment', async () => {
    process.env.NODE_ENV = 'development';

    const res = await request(app).get('/test-error');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toHaveProperty('stack');
    expect(res.body.error.message).toBe('Operational database failure');
  });

  it('should return sanitized error response and hide stack trace in production environment', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(app).get('/test-error');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Operational database failure');
    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.body.error).not.toHaveProperty('details');
  });

  it('should return sanitized error response and hide stack trace in staging/test environments', async () => {
    process.env.NODE_ENV = 'staging';

    const res = await request(app).get('/test-error');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Operational database failure');
    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.body.error).not.toHaveProperty('details');
  });

  it('should hide detailed message and return generic error for programming error in non-development environments', async () => {
    process.env.NODE_ENV = 'staging';

    const res = await request(app).get('/test-programming-error');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Something went very wrong!');
    expect(res.body.error).not.toHaveProperty('stack');
  });
});
