/**
 * @fileoverview Survey Controller Tests
 * @description Unit tests for the employee survey and pulse check controller
 * covering survey CRUD, responses, pulse checks, analytics, and dashboard.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;
beforeAll(async () => { mongoServer = await MongoMemoryServer.create(); await mongoose.connect(mongoServer.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });

jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
const eventBus = require('../../services/event.service');

const { Survey, SurveyResponse, PulseCheck, PulseCheckResponse } = require('../../models/survey.model');

const tenantId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
function makeReq(overrides = {}) { return { tenantId, userId, params: {}, body: {}, query: {}, ...overrides }; }
function makeRes() { return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }; }
const next = jest.fn();

let surveyId;

beforeEach(async () => {
  await Promise.all([Survey.deleteMany({}), SurveyResponse.deleteMany({}), PulseCheck.deleteMany({}), PulseCheckResponse.deleteMany({})]);
  eventBus.emit.mockClear(); next.mockClear();

  const survey = await Survey.create({
    tenantId, title: 'Test Survey', type: 'PULSE', status: 'ACTIVE',
    questions: [
      { questionText: 'Satisfaction?', questionType: 'LIKERT_5', options: [], isRequired: true, category: 'test' },
      { questionText: 'Comments?', questionType: 'OPEN_TEXT', options: [], isRequired: false, category: 'feedback' },
    ],
    isAnonymous: true, targetAll: true, createdBy: userId,
  });
  surveyId = survey._id;
});

const {
  createSurvey, getSurveys, publishSurvey, closeSurvey,
  submitSurveyResponse, getSurveyAnalytics,
  createPulseCheck, getPulseChecks, respondToPulse, getPulseAnalytics,
  getDashboard,
} = require('../survey.controller');

describe('Survey', () => {
  test('createSurvey creates a draft survey', async () => {
    const req = makeReq({ body: { title: 'New Survey', type: 'ENGAGEMENT', questions: [] } });
    const res = makeRes();
    await createSurvey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].survey.status).toBe('DRAFT');
  });

  test('publishSurvey activates a draft survey', async () => {
    const req = makeReq({ params: { surveyId: String(surveyId) } });
    const res = makeRes();
    await publishSurvey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Survey.findById(surveyId);
    expect(updated.status).toBe('ACTIVE');
    expect(updated.startDate).toBeTruthy();
  });

  test('submitSurveyResponse records response and increments count', async () => {
    const req = makeReq({
      params: { surveyId: String(surveyId) },
      body: { answers: [{ questionId: survey.questions[0]._id, value: 4 }], completionTime: 120 },
    });
    const res = makeRes();
    await submitSurveyResponse(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const updated = await Survey.findById(surveyId);
    expect(updated.responseCount).toBe(1);
  });

  test('submitSurveyResponse rejects duplicate for non-anonymous', async () => {
    const survey2 = await Survey.create({
      tenantId, title: 'Identified Survey', type: 'CUSTOM', status: 'ACTIVE',
      questions: [{ questionText: 'Q1', questionType: 'YES_NO', options: [], isRequired: true, category: 'test' }],
      isAnonymous: false, targetAll: true, createdBy: userId,
    });

    const req1 = makeReq({ params: { surveyId: String(survey2._id) }, body: { answers: [] } });
    const res1 = makeRes();
    await submitSurveyResponse(req1, res1, next);
    expect(res1.status).toHaveBeenCalledWith(201);

    const req2 = makeReq({ params: { surveyId: String(survey2._id) }, body: { answers: [] } });
    const res2 = makeRes();
    await submitSurveyResponse(req2, res2, next);
    expect(res2.status).toHaveBeenCalledWith(409);
  });

  test('getSurveyAnalytics returns question-level analytics', async () => {
    const qId = survey.questions[0]._id;
    await SurveyResponse.create({
      tenantId, surveyId, isAnonymous: true,
      answers: [{ questionId: qId, questionText: 'Satisfaction?', questionType: 'LIKERT_5', value: 4, textValue: '' }],
      department: 'Engineering',
    });

    const req = makeReq({ params: { surveyId: String(surveyId) } });
    const res = makeRes();
    await getSurveyAnalytics(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalResponses).toBe(1);
    expect(body.questionAnalytics).toHaveLength(2);
    expect(body.questionAnalytics[0].avg).toBe(4);
    expect(body.departmentBreakdown['Engineering']).toBe(1);
  });
});

describe('PulseCheck', () => {
  let pulseId;

  beforeEach(async () => {
    const pulse = await PulseCheck.create({
      tenantId, title: 'Weekly Pulse', question: 'How are you?',
      questionType: 'EMOJI_1_5', status: 'ACTIVE', createdBy: userId,
    });
    pulseId = pulse._id;
  });

  test('createPulseCheck creates an active pulse', async () => {
    const req = makeReq({ body: { title: 'New Pulse', question: 'Feeling good?' } });
    const res = makeRes();
    await createPulseCheck(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].pulse.status).toBe('ACTIVE');
  });

  test('respondToPulse records response and updates avg/sentiment', async () => {
    const req = makeReq({ params: { pulseCheckId: String(pulseId) }, body: { value: 4, emoji: '😊' } });
    const res = makeRes();
    await respondToPulse(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const updated = await PulseCheck.findById(pulseId);
    expect(updated.responseCount).toBe(1);
    expect(updated.avgScore).toBe(4);
    expect(updated.sentiment).toBe('POSITIVE');
  });

  test('respondToPulse updates existing response', async () => {
    const req1 = makeReq({ params: { pulseCheckId: String(pulseId) }, body: { value: 3 } });
    const res1 = makeRes();
    await respondToPulse(req1, res1, next);

    const req2 = makeReq({ params: { pulseCheckId: String(pulseId) }, body: { value: 5 } });
    const res2 = makeRes();
    await respondToPulse(req2, res2, next);

    expect(res2.status).toHaveBeenCalledWith(200);
    const updated = await PulseCheck.findById(pulseId);
    expect(updated.avgScore).toBe(5);
  });

  test('getPulseAnalytics returns distribution and department averages', async () => {
    await PulseCheckResponse.create([
      { tenantId, pulseCheckId: pulseId, respondentId: new mongoose.Types.ObjectId(), value: 3, department: 'Engineering' },
      { tenantId, pulseCheckId: pulseId, respondentId: new mongoose.Types.ObjectId(), value: 5, department: 'Engineering' },
      { tenantId, pulseCheckId: pulseId, respondentId: new mongoose.Types.ObjectId(), value: 2, department: 'Sales' },
    ]);

    const req = makeReq({ params: { pulseCheckId: String(pulseId) } });
    const res = makeRes();
    await getPulseAnalytics(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalResponses).toBe(3);
    expect(body.departmentAverages.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getDashboard', () => {
  test('returns aggregated metrics', async () => {
    await Survey.create(Array.from({ length: 3 }, (_, i) => ({
      tenantId, title: `Survey ${i}`, type: 'PULSE', status: i === 0 ? 'ACTIVE' : 'CLOSED',
      questions: [{ questionText: 'Q', questionType: 'YES_NO', options: [], isRequired: true, category: 't' }],
      isAnonymous: true, targetAll: true, createdBy: userId,
    })));
    await PulseCheck.create(Array.from({ length: 2 }, (_, i) => ({
      tenantId, title: `Pulse ${i}`, question: 'Q?', status: i === 0 ? 'ACTIVE' : 'CLOSED',
      createdBy: userId,
    })));

    const req = makeReq(); const res = makeRes();
    await getDashboard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.totalSurveys).toBe(3);
    expect(body.activeSurveys).toBe(1);
    expect(body.activePulseChecks).toBe(1);
    expect(Array.isArray(body.recentSurveys)).toBe(true);
  });
});
