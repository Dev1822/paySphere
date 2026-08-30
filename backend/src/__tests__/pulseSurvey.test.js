const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const PulseSurvey = require('../models/pulseSurvey.model');
const Employee = require('../models/employee.model');

jest.mock('../middlewares/auth.middleware', () => (req, res, next) => {
  req.userId = global.testUserId || '507f1f77bcf86cd799439011';
  req.tenantId = global.testTenantId || '507f1f77bcf86cd799439012';
  req.userRole = 'admin';
  next();
});

jest.mock('../middlewares/rbac.middleware', () => ({
  requireScope: () => (req, res, next) => next(),
}));

describe('Pulse Survey Controller', () => {
  let testEmployee;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/paysphere_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    testEmployee = await Employee.create({
      fullName: 'Survey Test Employee',
      role: 'Designer',
      department: 'Design',
      monthlySalary: 45000,
      companyName: 'Test Corp',
      createdBy: global.testUserId || '507f1f77bcf86cd799439011',
      tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
    });
  });

  afterAll(async () => {
    await PulseSurvey.deleteMany({});
    await Employee.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await PulseSurvey.deleteMany({});
  });

  const sampleQuestions = [
    { text: 'How satisfied are you?', type: 'rating', maxRating: 5 },
    { text: 'Preferred work mode?', type: 'multiple_choice', options: ['Remote', 'Hybrid', 'Office'] },
    { text: 'Would you recommend us?', type: 'yes_no' },
  ];

  describe('POST /api/pulse-surveys/', () => {
    it('should create a survey in draft', async () => {
      const res = await request(app)
        .post('/api/pulse-surveys/')
        .send({ title: 'Q3 Engagement', questions: sampleQuestions });
      expect(res.status).toBe(201);
      expect(res.body.survey.status).toBe('draft');
      expect(res.body.survey.questions).toHaveLength(3);
    });

    it('should return 400 for missing title', async () => {
      const res = await request(app)
        .post('/api/pulse-surveys/')
        .send({ questions: sampleQuestions });
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty questions', async () => {
      const res = await request(app)
        .post('/api/pulse-surveys/')
        .send({ title: 'Empty', questions: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/pulse-surveys/:id/publish', () => {
    it('should publish a draft survey', async () => {
      const survey = await PulseSurvey.create({
        title: 'Test', questions: sampleQuestions,
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      const res = await request(app).patch(`/api/pulse-surveys/${survey._id}/publish`);
      expect(res.status).toBe(200);
      expect(res.body.survey.status).toBe('active');
      expect(res.body.survey.publishedAt).toBeDefined();
    });
  });

  describe('POST /api/pulse-surveys/:surveyId/respond', () => {
    let activeSurvey;

    beforeEach(async () => {
      activeSurvey = await PulseSurvey.create({
        title: 'Active Survey', questions: sampleQuestions, status: 'active', publishedAt: new Date(),
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
    });

    it('should accept a response', async () => {
      const answers = activeSurvey.questions.map((q) => ({
        questionId: q._id,
        value: q.type === 'rating' ? 4 : q.type === 'yes_no' ? 'Yes' : 'Remote',
      }));
      const res = await request(app)
        .post(`/api/pulse-surveys/${activeSurvey._id}/respond`)
        .send({ answers });
      expect(res.status).toBe(201);
    });

    it('should be idempotent for duplicate response', async () => {
      const answers = activeSurvey.questions.map((q) => ({
        questionId: q._id, value: q.type === 'rating' ? 3 : q.type === 'yes_no' ? 'No' : 'Office',
      }));
      await request(app).post(`/api/pulse-surveys/${activeSurvey._id}/respond`).send({ answers });
      const res = await request(app).post(`/api/pulse-surveys/${activeSurvey._id}/respond`).send({ answers });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('already');
    });

    it('should reject response to closed survey', async () => {
      activeSurvey.status = 'closed';
      await activeSurvey.save();
      const res = await request(app)
        .post(`/api/pulse-surveys/${activeSurvey._id}/respond`)
        .send({ answers: [{ questionId: activeSurvey.questions[0]._id, value: 5 }] });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/pulse-surveys/:id/results', () => {
    it('should return aggregated results', async () => {
      const survey = await PulseSurvey.create({
        title: 'Results Test',
        questions: [{ text: 'Rate us', type: 'rating', maxRating: 5 }],
        status: 'active', publishedAt: new Date(),
        responses: [{
          employeeId: testEmployee._id,
          answers: [{ questionId: undefined, value: 4 }],
          submittedAt: new Date(),
        }],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      const res = await request(app).get(`/api/pulse-surveys/${survey._id}/results`);
      expect(res.status).toBe(200);
      expect(res.body.results).toBeDefined();
      expect(res.body.stats).toBeDefined();
    });
  });

  describe('GET /api/pulse-surveys/available/surveys', () => {
    it('should list available surveys', async () => {
      await PulseSurvey.create({
        title: 'Open Survey',
        questions: [{ text: 'Q1', type: 'yes_no' }],
        status: 'active', publishedAt: new Date(),
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      const res = await request(app).get('/api/pulse-surveys/available/surveys');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data?.surveys ?? res.body?.surveys)).toBe(true);
    });
  });
});
