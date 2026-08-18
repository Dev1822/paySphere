const request = require('supertest');
const express = require('express');
const { redact, maskValue } = require('../../utils/redaction');
const redactionMiddleware = require('../redaction.middleware');

describe('PII Redaction Utility', () => {
  it('masks emails correctly', () => {
    expect(maskValue('email', 'john.doe@example.com')).toBe(
      'jo***@example.com',
    );
    expect(maskValue('email', 'a@b.com')).toBe('a*@b.com');
    expect(maskValue('email', '')).toBe('');
    expect(maskValue('email', null)).toBeNull();
  });

  it('masks phone numbers correctly', () => {
    expect(maskValue('phone', '+1234567890')).toBe('******7890');
    expect(maskValue('phone', '123')).toBe('****');
  });

  it('masks salary fields completely', () => {
    expect(maskValue('basesalary', 50000)).toBe('[REDACTED]');
    expect(maskValue('netSalary', '88000')).toBe('[REDACTED]');
    expect(maskValue('monthlySalary', 95000)).toBe('[REDACTED]');
  });

  it('masks ssn and bank accounts leaving only last 4 digits', () => {
    expect(maskValue('ssn', '123-456-7890')).toBe('********7890');
    expect(maskValue('pan', 'ABCDE1234F')).toBe('******1234F');
  });

  it('redacts credentials and secrets completely', () => {
    expect(maskValue('password', 'supersecret123')).toBe('[REDACTED]');
    expect(maskValue('passwordHash', '$2b$10$abcdefghijklmnopqrstuv')).toBe(
      '[REDACTED]',
    );
    expect(maskValue('refreshToken', 'some-jwt-token')).toBe('[REDACTED]');
    expect(maskValue('twoFactorSecret', 'base32secret')).toBe('[REDACTED]');
    expect(maskValue('twoFactorEnable', true)).toBe('[REDACTED]');
    expect(maskValue('googleId', '123456789')).toBe('[REDACTED]');
    expect(maskValue('webhookSecret', 'whsec_abcdef')).toBe('[REDACTED]');
  });

  it('recursively redacts sensitive fields in nested objects and arrays', () => {
    const data = {
      name: 'Alice',
      email: 'alice@example.com',
      profile: {
        phone: '1234567890',
        baseSalary: 60000,
      },
      skills: ['js', 'node'],
      history: [{ previousSalary: 45000, newSalary: 55000 }],
    };

    const result = redact(data);

    expect(result.name).toBe('Alice');
    expect(result.email).toBe('al***@example.com');
    expect(result.profile.phone).toBe('******7890');
    expect(result.profile.baseSalary).toBe('[REDACTED]');
    expect(result.skills).toEqual(['js', 'node']);
    expect(result.history[0].previousSalary).toBe('[REDACTED]');
    expect(result.history[0].newSalary).toBe('[REDACTED]');
  });
});

describe('Redaction Middleware', () => {
  let app;

  beforeAll(() => {
    app = express();

    // Setup a mock auth simulation
    app.use((req, res, next) => {
      if (req.headers['x-role'] === 'ADMIN') {
        req.user = { role: 'ADMIN' };
        req.accountType = 'ADMIN';
      } else if (req.headers['x-role'] === 'EMPLOYEE') {
        req.user = { role: 'EMPLOYEE' };
        req.accountType = 'EMPLOYEE';
      }
      next();
    });

    app.use(redactionMiddleware);

    app.get('/api/test-pii', (req, res) => {
      res.json({
        userId: '123',
        email: 'support@paysphere.com',
        baseSalary: 120000,
        netSalary: 110000,
        pan: 'ABCDE5678F',
      });
    });
  });

  it('returns unmasked data for ADMIN accounts', async () => {
    const res = await request(app).get('/api/test-pii').set('x-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('support@paysphere.com');
    expect(res.body.baseSalary).toBe(120000);
    expect(res.body.netSalary).toBe(110000);
    expect(res.body.pan).toBe('ABCDE5678F');
  });

  it('returns masked data for non-ADMIN (EMPLOYEE) accounts', async () => {
    const res = await request(app)
      .get('/api/test-pii')
      .set('x-role', 'EMPLOYEE');

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('su***@paysphere.com');
    expect(res.body.baseSalary).toBe('[REDACTED]');
    expect(res.body.netSalary).toBe('[REDACTED]');
    expect(res.body.pan).toBe('******5678F');
  });

  it('returns masked data for unauthenticated requests', async () => {
    const res = await request(app).get('/api/test-pii');

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('su***@paysphere.com');
    expect(res.body.baseSalary).toBe('[REDACTED]');
    expect(res.body.netSalary).toBe('[REDACTED]');
    expect(res.body.pan).toBe('******5678F');
  });
});
