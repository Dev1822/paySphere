/**
 * @fileoverview Tests for Pulse Survey Analytics Controller
 *
 * Unit tests for the survey analytics aggregation endpoints.
 * Covers: getOverview, getDepartmentBreakdown, getQuestionAnalytics,
 * getResponseHeatmap, getSentimentTrend, getSurveyComparison, getEngagementScorecard.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ─── Model Imports ────────────────────────────────────────────────────────

const PulseSurvey = require('../../models/pulseSurvey.model');
const Employee = require('../../models/employee.model');

// ─── Helpers ──────────────────────────────────────────────────────────────

const TENANT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

function mockReq(overrides = {}) {
  return {
    tenantId: TENANT_ID,
    userId: USER_ID,
    params: {},
    query: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next = jest.fn();

async function createTestEmployee(dept = 'Engineering') {
  return Employee.create({
    fullName: `Test Employee ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    department: dept,
    monthlySalary: 50000,
    companyName: 'TestCorp',
    createdBy: USER_ID,
    tenantId: TENANT_ID,
  });
}

async function createTestSurvey(overrides = {}) {
  const questions = overrides.questions || [
    { text: 'How satisfied are you?', type: 'rating', maxRating: 5, options: [] },
    { text: 'Would you recommend?', type: 'yes_no', options: [] },
    { text: 'Preferred work mode?', type: 'multiple_choice', options: ['Remote', 'Hybrid', 'Office'] },
  ];

  const responses = overrides.responses || [
    {
      employeeId: new mongoose.Types.ObjectId(),
      answers: [
        { questionId: null, value: 4 },
        { questionId: null, value: 'Yes' },
        { questionId: null, value: 'Hybrid' },
      ],
      submittedAt: new Date(),
    },
  ];

  // Wire question IDs into answers
  for (const response of responses) {
    response.answers = response.answers.map((ans, i) => ({
      ...ans,
      questionId: questions[i]?._id || questions[i]?._id,
    }));
  }

  return PulseSurvey.create({
    title: overrides.title || 'Test Survey',
    description: overrides.description || 'Test description',
    questions,
    responses,
    status: overrides.status || 'active',
    publishedAt: overrides.publishedAt || new Date(),
    createdBy: USER_ID,
    tenantId: TENANT_ID,
    targetDepartments: overrides.targetDepartments || [],
    ...overrides,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Pulse Survey Analytics Controller', () => {
  beforeEach(async () => {
    await PulseSurvey.deleteMany({});
    await Employee.deleteMany({});
    jest.clearAllMocks();
  });

  // ─── getOverview ────────────────────────────────────────────────────────

  describe('getOverview', () => {
    it('should return overview metrics for an empty tenant', async () => {
      const { getOverview } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getOverview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.overview).toBeDefined();
      expect(body.overview.totalSurveys).toBe(0);
      expect(body.overview.totalResponses).toBe(0);
      expect(body.responseTimeline).toBeInstanceOf(Array);
      expect(body.responseTimeline).toHaveLength(12);
    });

    it('should aggregate metrics across multiple surveys', async () => {
      const emp = await createTestEmployee('Engineering');
      const emp2 = await createTestEmployee('Marketing');

      const q1 = { text: 'Rate satisfaction', type: 'rating', maxRating: 5, options: [] };
      const q2 = { text: 'Do you like it?', type: 'yes_no', options: [] };

      await createTestSurvey({
        title: 'Survey 1',
        questions: [q1, q2],
        responses: [
          {
            employeeId: emp._id,
            answers: [
              { questionId: q1._id, value: 5 },
              { questionId: q2._id, value: 'Yes' },
            ],
            submittedAt: new Date(),
          },
          {
            employeeId: emp2._id,
            answers: [
              { questionId: q1._id, value: 3 },
              { questionId: q2._id, value: 'No' },
            ],
            submittedAt: new Date(),
          },
        ],
        status: 'closed',
      });

      await createTestSurvey({
        title: 'Draft Survey',
        status: 'draft',
        responses: [],
      });

      const { getOverview } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getOverview(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.overview.totalSurveys).toBe(2);
      expect(body.overview.closedSurveys).toBe(1);
      expect(body.overview.draftSurveys).toBe(1);
      expect(body.overview.totalResponses).toBe(2);
      expect(body.overview.avgSatisfaction).toBe(4); // (5 + 3) / 2
      expect(body.topSurveys).toHaveLength(1);
      expect(body.topSurveys[0].title).toBe('Survey 1');
    });

    it('should call next on error', async () => {
      // Force an error by mocking the model
      const originalFind = PulseSurvey.find;
      PulseSurvey.find = jest.fn().mockRejectedValue(new Error('DB Error'));

      const { getOverview } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getOverview(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));

      PulseSurvey.find = originalFind;
    });
  });

  // ─── getDepartmentBreakdown ─────────────────────────────────────────────

  describe('getDepartmentBreakdown', () => {
    it('should return department breakdown', async () => {
      const emp1 = await createTestEmployee('Engineering');
      const emp2 = await createTestEmployee('Engineering');
      const emp3 = await createTestEmployee('Sales');

      const q1 = { text: 'Rate this', type: 'rating', maxRating: 5, options: [] };
      await createTestSurvey({
        questions: [q1],
        responses: [
          { employeeId: emp1._id, answers: [{ questionId: q1._id, value: 4 }], submittedAt: new Date() },
          { employeeId: emp3._id, answers: [{ questionId: q1._id, value: 2 }], submittedAt: new Date() },
        ],
      });

      const { getDepartmentBreakdown } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getDepartmentBreakdown(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.departments).toBeDefined();
      expect(body.departments.length).toBeGreaterThanOrEqual(2);

      const eng = body.departments.find((d) => d.department === 'Engineering');
      expect(eng).toBeDefined();
      expect(eng.employeeCount).toBe(2);

      const sales = body.departments.find((d) => d.department === 'Sales');
      expect(sales).toBeDefined();
      expect(sales.employeeCount).toBe(1);
    });
  });

  // ─── getQuestionAnalytics ───────────────────────────────────────────────

  describe('getQuestionAnalytics', () => {
    it('should return 404 for non-existent survey', async () => {
      const { getQuestionAnalytics } = require('../surveyAnalytics.controller');
      const req = mockReq({ params: { surveyId: new mongoose.Types.ObjectId() } });
      const res = mockRes();

      await getQuestionAnalytics(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Survey not found' });
    });

    it('should return per-question analytics for a rating survey', async () => {
      const emp = await createTestEmployee();
      const q1 = { text: 'How happy?', type: 'rating', maxRating: 5, options: [] };
      const q2 = { text: 'MC question', type: 'multiple_choice', options: ['A', 'B', 'C'] };

      const survey = await createTestSurvey({
        questions: [q1, q2],
        responses: [
          {
            employeeId: emp._id,
            answers: [
              { questionId: q1._id, value: 5 },
              { questionId: q2._id, value: 'A' },
            ],
            submittedAt: new Date(),
          },
        ],
      });

      const { getQuestionAnalytics } = require('../surveyAnalytics.controller');
      const req = mockReq({ params: { surveyId: survey._id.toString() } });
      const res = mockRes();

      await getQuestionAnalytics(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.questions).toHaveLength(2);
      expect(body.questions[0].type).toBe('rating');
      expect(body.questions[0].avg).toBe(5);
      expect(body.questions[0].median).toBe(5);
      expect(body.questions[0].stdDev).toBe(0);
      expect(body.questions[0].sentimentBreakdown).toBeDefined();
      expect(body.questions[0].sentimentBreakdown.positive.count).toBe(1);

      expect(body.questions[1].type).toBe('multiple_choice');
      expect(body.questions[1].topOption).toBe('A');
      expect(body.questions[1].topOptionPercentage).toBe(100);
    });
  });

  // ─── getResponseHeatmap ─────────────────────────────────────────────────

  describe('getResponseHeatmap', () => {
    it('should return heatmap data', async () => {
      const emp = await createTestEmployee();
      const q1 = { text: 'Rate', type: 'rating', maxRating: 5, options: [] };

      const now = new Date();
      const responses = [];
      for (let i = 0; i < 5; i++) {
        responses.push({
          employeeId: emp._id,
          answers: [{ questionId: q1._id, value: 4 }],
          submittedAt: new Date(now.getTime() - i * 86400000),
        });
      }

      await createTestSurvey({ questions: [q1], responses });

      const { getResponseHeatmap } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getResponseHeatmap(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.heatmap).toBeDefined();
      expect(body.heatmap.totalResponses).toBe(5);
      expect(body.heatmap.dayOfWeek).toHaveLength(7);
      expect(body.heatmap.hourOfDay).toHaveLength(24);
      expect(body.heatmap.peakDay).toBeDefined();
      expect(body.heatmap.peakHour).toBeDefined();
    });
  });

  // ─── getSentimentTrend ──────────────────────────────────────────────────

  describe('getSentimentTrend', () => {
    it('should return sentiment trend data', async () => {
      const emp = await createTestEmployee();
      const q1 = { text: 'Rate', type: 'rating', maxRating: 5, options: [] };

      const now = new Date();
      const responses = [];
      for (let i = 0; i < 10; i++) {
        responses.push({
          employeeId: emp._id,
          answers: [{ questionId: q1._id, value: Math.floor(Math.random() * 5) + 1 }],
          submittedAt: new Date(now.getTime() - i * 7 * 86400000),
        });
      }

      await createTestSurvey({ questions: [q1], responses });

      const { getSentimentTrend } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getSentimentTrend(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.sentimentTrend).toBeInstanceOf(Array);
      if (body.sentimentTrend.length > 0) {
        expect(body.sentimentTrend[0]).toHaveProperty('weekStart');
        expect(body.sentimentTrend[0]).toHaveProperty('avgSatisfaction');
        expect(body.sentimentTrend[0]).toHaveProperty('positivePercentage');
        expect(body.sentimentTrend[0]).toHaveProperty('negativePercentage');
      }
    });
  });

  // ─── getSurveyComparison ────────────────────────────────────────────────

  describe('getSurveyComparison', () => {
    it('should return comparison data for published surveys', async () => {
      const emp = await createTestEmployee();
      const q1 = { text: 'Rate', type: 'rating', maxRating: 5, options: [] };

      await createTestSurvey({
        title: 'Active Survey',
        status: 'active',
        questions: [q1],
        responses: [
          { employeeId: emp._id, answers: [{ questionId: q1._id, value: 4 }], submittedAt: new Date() },
        ],
      });

      await createTestSurvey({
        title: 'Draft Survey',
        status: 'draft',
        responses: [],
      });

      const { getSurveyComparison } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getSurveyComparison(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.comparison).toBeDefined();
      // Draft surveys are excluded from comparison
      const active = body.comparison.find((c) => c.title === 'Active Survey');
      expect(active).toBeDefined();
      expect(active.responseCount).toBe(1);
      expect(active.avgSatisfaction).toBe(4);
    });
  });

  // ─── getEngagementScorecard ─────────────────────────────────────────────

  describe('getEngagementScorecard', () => {
    it('should return scorecard with zero responses', async () => {
      const { getEngagementScorecard } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getEngagementScorecard(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.scorecard).toBeDefined();
      expect(body.scorecard.totalResponses).toBe(0);
      expect(body.scorecard.engagementScore).toBeGreaterThanOrEqual(0);
      expect(body.scorecard.engagementScore).toBeLessThanOrEqual(100);
    });

    it('should compute engagement score from responses', async () => {
      const emp = await createTestEmployee();
      const q1 = { text: 'Rate', type: 'rating', maxRating: 5, options: [] };

      await createTestSurvey({
        questions: [q1],
        responses: [
          { employeeId: emp._id, answers: [{ questionId: q1._id, value: 5 }], submittedAt: new Date() },
          { employeeId: new mongoose.Types.ObjectId(), answers: [{ questionId: q1._id, value: 4 }], submittedAt: new Date() },
        ],
      });

      const { getEngagementScorecard } = require('../surveyAnalytics.controller');
      const req = mockReq();
      const res = mockRes();

      await getEngagementScorecard(req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.scorecard.totalResponses).toBe(2);
      expect(body.scorecard.engagementScore).toBeGreaterThan(0);
      expect(body.scorecard.trendDirection).toBeDefined();
      expect(['improving', 'declining', 'stable']).toContain(body.scorecard.trendDirection);
    });
  });
});
