const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Competency = require('../models/competency.model');
const Employee = require('../models/employee.model');
const User = require('../models/user.model');

// Mock auth middleware for tests
jest.mock('../middlewares/auth.middleware', () => (req, res, next) => {
  req.userId = global.testUserId || '507f1f77bcf86cd799439011';
  req.tenantId = global.testTenantId || '507f1f77bcf86cd799439012';
  req.userRole = 'admin';
  next();
});

jest.mock('../middlewares/rbac.middleware', () => ({
  requireScope: () => (req, res, next) => next(),
}));

describe('Competency Controller', () => {
  let testEmployee;
  let testProfile;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/paysphere_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Create a test employee
    testEmployee = await Employee.create({
      fullName: 'Test Employee',
      role: 'Software Engineer',
      department: 'Engineering',
      monthlySalary: 50000,
      companyName: 'Test Corp',
      createdBy: global.testUserId || '507f1f77bcf86cd799439011',
      tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
    });
  });

  afterAll(async () => {
    await Competency.deleteMany({});
    await Employee.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Competency.deleteMany({});
  });

  describe('GET /api/competencies/me', () => {
    it('should create and return an empty profile if none exists', async () => {
      const res = await request(app).get('/api/competencies/me');
      expect(res.status).toBe(200);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.skills).toEqual([]);
    });

    it('should return existing profile', async () => {
      testProfile = await Competency.create({
        employeeId: testEmployee._id,
        department: 'Engineering',
        skills: [
          { skillName: 'JavaScript', category: 'Technical', proficiency: 'Advanced' },
        ],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });

      const res = await request(app).get('/api/competencies/me');
      expect(res.status).toBe(200);
      expect(res.body.profile.skills).toHaveLength(1);
      expect(res.body.profile.skills[0].skillName).toBe('JavaScript');
    });
  });

  describe('POST /api/competencies/employee/:employeeId/skills', () => {
    beforeEach(async () => {
      await Competency.create({
        employeeId: testEmployee._id,
        department: 'Engineering',
        skills: [],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
    });

    it('should add a skill to the profile', async () => {
      const res = await request(app)
        .post(`/api/competencies/employee/${testEmployee._id}/skills`)
        .send({
          skillName: 'React',
          category: 'Technical',
          proficiency: 'Advanced',
          yearsOfExperience: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.profile.skills).toHaveLength(1);
      expect(res.body.profile.skills[0].skillName).toBe('React');
    });

    it('should reject duplicate skill names', async () => {
      await request(app)
        .post(`/api/competencies/employee/${testEmployee._id}/skills`)
        .send({ skillName: 'React', category: 'Technical', proficiency: 'Advanced' });

      const res = await request(app)
        .post(`/api/competencies/employee/${testEmployee._id}/skills`)
        .send({ skillName: 'React', category: 'Technical', proficiency: 'Beginner' });

      expect(res.status).toBe(409);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post(`/api/competencies/employee/${testEmployee._id}/skills`)
        .send({ skillName: 'React' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid proficiency', async () => {
      const res = await request(app)
        .post(`/api/competencies/employee/${testEmployee._id}/skills`)
        .send({
          skillName: 'React',
          category: 'Technical',
          proficiency: 'Master',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/competencies/employee/:employeeId/skills/:skillId', () => {
    let skillId;

    beforeEach(async () => {
      const profile = await Competency.create({
        employeeId: testEmployee._id,
        department: 'Engineering',
        skills: [
          { skillName: 'React', category: 'Technical', proficiency: 'Beginner' },
        ],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      skillId = profile.skills[0]._id;
    });

    it('should update a skill', async () => {
      const res = await request(app)
        .patch(`/api/competencies/employee/${testEmployee._id}/skills/${skillId}`)
        .send({ proficiency: 'Expert' });

      expect(res.status).toBe(200);
      expect(res.body.profile.skills[0].proficiency).toBe('Expert');
    });
  });

  describe('DELETE /api/competencies/employee/:employeeId/skills/:skillId', () => {
    let skillId;

    beforeEach(async () => {
      const profile = await Competency.create({
        employeeId: testEmployee._id,
        department: 'Engineering',
        skills: [
          { skillName: 'React', category: 'Technical', proficiency: 'Advanced' },
        ],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });
      skillId = profile.skills[0]._id;
    });

    it('should remove a skill', async () => {
      const res = await request(app)
        .delete(`/api/competencies/employee/${testEmployee._id}/skills/${skillId}`);

      expect(res.status).toBe(200);
      expect(res.body.profile.skills).toHaveLength(0);
    });
  });

  describe('GET /api/competencies/matrix', () => {
    it('should return department skill matrix', async () => {
      await Competency.create({
        employeeId: testEmployee._id,
        department: 'Engineering',
        skills: [
          { skillName: 'React', category: 'Technical', proficiency: 'Advanced', yearsOfExperience: 3 },
        ],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });

      const res = await request(app).get('/api/competencies/matrix');
      expect(res.status).toBe(200);
      expect(res.body.matrix).toBeDefined();
      expect(res.body.totalSkills).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/competencies/gap-analysis/:employeeId', () => {
    it('should return gap analysis', async () => {
      await Competency.create({
        employeeId: testEmployee._id,
        department: 'Engineering',
        skills: [
          { skillName: 'JavaScript', category: 'Technical', proficiency: 'Beginner' },
        ],
        createdBy: global.testUserId || '507f1f77bcf86cd799439011',
        tenantId: global.testTenantId || '507f1f77bcf86cd799439012',
      });

      const res = await request(app).get(
        `/api/competencies/gap-analysis/${testEmployee._id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.gaps).toBeDefined();
      expect(res.body.strengths).toBeDefined();
      expect(res.body.employee).toBeDefined();
    });
  });
});
