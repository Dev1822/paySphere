jest.mock('../../models/pyq.model', () => {
  const model = {
    create: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
  };
  return model;
});

jest.mock('../../models/pyqTrend.model', () => {
  const model = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  return model;
});

jest.mock('../../utils/gemini', () => ({
  generatePYQTrend: jest.fn().mockResolvedValue({
    predictedDifficulty: 'hard',
    difficultyConfidence: 90,
    topics: [
      {
        chapter: 'Calculus',
        probability: 0.9,
        trend: 'rising',
        weightageClass: 'high',
        badge: 'Rising Weightage in 2026',
      },
    ],
  }),
  getLocalFallbackTrend: jest.fn().mockReturnValue({
    predictedDifficulty: 'medium',
    difficultyConfidence: 75,
    topics: [],
  }),
}));

const mongoose = require('mongoose');
const PYQ = require('../../models/pyq.model');
const PYQTrend = require('../../models/pyqTrend.model');
const { generatePYQTrend } = require('../../utils/gemini');
const {
  createPYQ,
  bulkUploadPYQs,
  getPYQs,
  generateTrendForecast,
  getLatestTrendForecast,
} = require('../pyq.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (body = {}, query = {}, params = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  body,
  query,
  params,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PYQ Controller Tests', () => {
  describe('createPYQ', () => {
    test('creates a PYQ entry', async () => {
      const res = buildRes();
      const body = {
        subject: 'Maths',
        exam: 'JEE',
        year: 2024,
        question: 'Integrate x dx',
        chapter: 'Calculus',
        difficulty: 'medium',
        tags: ['integration'],
      };
      PYQ.create.mockResolvedValue(body);

      await createPYQ(buildReq(body), res, jest.fn());

      expect(PYQ.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Maths',
          year: 2024,
          tenantId: TENANT_ID,
          createdBy: USER_ID,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('returns 400 when required fields are missing', async () => {
      const res = buildRes();
      await createPYQ(buildReq({ subject: 'Maths' }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkUploadPYQs', () => {
    test('inserts multiple PYQ records', async () => {
      const res = buildRes();
      const pyqs = [
        {
          subject: 'Physics',
          exam: 'NEET',
          year: 2023,
          question: 'F = ma',
          chapter: 'Mechanics',
          difficulty: 'easy',
        },
      ];
      PYQ.insertMany.mockResolvedValue(pyqs);

      await bulkUploadPYQs(buildReq({ pyqs }), res, jest.fn());

      expect(PYQ.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            chapter: 'Mechanics',
            tenantId: TENANT_ID,
          }),
        ])
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('returns 400 for empty payload', async () => {
      const res = buildRes();
      await bulkUploadPYQs(buildReq({ pyqs: [] }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPYQs', () => {
    test('retrieves pyqs with query filters', async () => {
      const res = buildRes();
      const list = [{ subject: 'Maths', year: 2024 }];
      const sortChain = jest.fn().mockResolvedValue(list);
      PYQ.find.mockReturnValue({ sort: sortChain });

      await getPYQs(buildReq({}, { subject: 'Maths', year: '2024', exam: 'JEE' }), res, jest.fn());

      expect(PYQ.find).toHaveBeenCalled();
      expect(sortChain).toHaveBeenCalledWith({ year: -1, chapter: 1 });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('generateTrendForecast', () => {
    test('triggers Gemini AI analysis and saves trend prediction', async () => {
      const res = buildRes();
      const pyqs = [{ chapter: 'Calculus', difficulty: 'hard', year: 2023 }];
      const chain = { lean: jest.fn().mockResolvedValue(pyqs) };
      PYQ.find.mockReturnValue(chain);

      const forecastData = {
        predictedDifficulty: 'hard',
        difficultyConfidence: 90,
        topics: [
          {
            chapter: 'Calculus',
            probability: 0.9,
            trend: 'rising',
            weightageClass: 'high',
            badge: 'Rising Weightage in 2026',
          },
        ],
      };
      PYQTrend.findOneAndUpdate.mockResolvedValue(forecastData);

      await generateTrendForecast(
        buildReq({ subject: 'Maths', exam: 'JEE', forecastYear: 2026 }),
        res,
        jest.fn()
      );

      expect(generatePYQTrend).toHaveBeenCalledWith(pyqs, 'Maths', 'JEE', 2026);
      expect(PYQTrend.findOneAndUpdate).toHaveBeenCalledWith(
        {
          tenantId: TENANT_ID,
          subject: 'Maths',
          exam: 'JEE',
          forecastYear: 2026,
        },
        expect.objectContaining({
          predictedDifficulty: 'hard',
          difficultyConfidence: 90,
        }),
        { new: true, upsert: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('returns 400 when subject, exam, or forecastYear missing', async () => {
      const res = buildRes();
      await generateTrendForecast(buildReq({ subject: 'Maths' }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getLatestTrendForecast', () => {
    test('returns latest forecast for subject and exam', async () => {
      const res = buildRes();
      const mockRecord = { subject: 'Physics', exam: 'JEE', forecastYear: 2026 };
      PYQTrend.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockRecord),
      });

      await getLatestTrendForecast(buildReq({}, { subject: 'Physics', exam: 'JEE' }), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRecord);
    });

    test('returns 404 when no forecast exists', async () => {
      const res = buildRes();
      PYQTrend.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      await getLatestTrendForecast(buildReq({}, { subject: 'Physics', exam: 'JEE' }), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 400 when query params missing', async () => {
      const res = buildRes();
      await getLatestTrendForecast(buildReq({}, {}), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
