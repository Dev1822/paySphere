const mongoose = require('mongoose');
const BenefitPlan = require('../../models/benefitPlan.model');
const BenefitEnrollment = require('../../models/benefitEnrollment.model');
const Employee = require('../../models/employee.model');
const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  enroll,
  cancelEnrollment,
  getMyEnrollments,
  getAllEnrollments,
  getEnrollmentStats,
  terminateEnrollment,
} = require('../benefits.controller');

jest.mock('../../models/benefitPlan.model');
jest.mock('../../models/benefitEnrollment.model');
jest.mock('../../models/employee.model');
jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Benefits Controller', () => {
  let req, res, next;
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  const planId = new mongoose.Types.ObjectId().toString();
  const employeeId = new mongoose.Types.ObjectId().toString();
  const enrollmentId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      userId,
      tenantId,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  // ─── createPlan ──────────────────────────────────────────────────────
  describe('createPlan', () => {
    it('should return 400 if name is missing', async () => {
      req.body = { category: 'health', monthlyPremium: 500 };
      await createPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should return 400 if category is missing', async () => {
      req.body = { name: 'Health Plus', monthlyPremium: 500 };
      await createPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should create a benefit plan', async () => {
      req.body = {
        name: 'Health Plus',
        category: 'health',
        monthlyPremium: 500,
        employerContribution: 300,
        employeeContribution: 200,
      };
      BenefitPlan.findOne.mockResolvedValue(null);
      BenefitPlan.create.mockResolvedValue({
        _id: planId,
        name: 'Health Plus',
        category: 'health',
      });
      await createPlan(req, res, next);
      expect(BenefitPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Health Plus', category: 'health' }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 409 for duplicate name', async () => {
      req.body = {
        name: 'Health Plus',
        category: 'health',
        monthlyPremium: 500,
      };
      BenefitPlan.findOne.mockResolvedValue({ _id: 'existing' });
      await createPlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // ─── getPlans ────────────────────────────────────────────────────────
  describe('getPlans', () => {
    it('should return all plans', async () => {
      BenefitPlan.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getPlans(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── getPlanById ─────────────────────────────────────────────────────
  describe('getPlanById', () => {
    it('should return 404 if not found', async () => {
      req.params.id = planId;
      BenefitPlan.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await getPlanById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('should return the plan', async () => {
      req.params.id = planId;
      const mock = { _id: planId, name: 'Health Plus' };
      BenefitPlan.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mock),
      });
      await getPlanById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ plan: mock });
    });
  });

  // ─── updatePlan ──────────────────────────────────────────────────────
  describe('updatePlan', () => {
    it('should update plan fields', async () => {
      req.params.id = planId;
      req.body = { name: 'Updated Health', monthlyPremium: 600 };
      const mock = {
        _id: planId,
        name: 'Old',
        monthlyPremium: 500,
        save: jest.fn(),
      };
      BenefitPlan.findOne.mockResolvedValue(mock);
      await updatePlan(req, res, next);
      expect(mock.name).toBe('Updated Health');
      expect(mock.monthlyPremium).toBe(600);
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── deletePlan ──────────────────────────────────────────────────────
  describe('deletePlan', () => {
    it('should return 400 if plan has active enrollments', async () => {
      req.params.id = planId;
      BenefitEnrollment.countDocuments.mockResolvedValue(3);
      await deletePlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should delete plan if no active enrollments', async () => {
      req.params.id = planId;
      BenefitEnrollment.countDocuments.mockResolvedValue(0);
      BenefitPlan.findOneAndDelete.mockResolvedValue({ _id: planId });
      await deletePlan(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── enroll ──────────────────────────────────────────────────────────
  describe('enroll', () => {
    it('should return 400 if planId is missing', async () => {
      req.body = {};
      await enroll(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it('should enroll employee in a benefit plan', async () => {
      req.body = { planId, coverageType: 'family' };
      BenefitPlan.findOne.mockResolvedValue({
        _id: planId,
        isActive: true,
        coverageType: 'individual',
        employeeContribution: 200,
        maxEnrollees: null,
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      BenefitEnrollment.findOne.mockResolvedValue(null);
      BenefitEnrollment.create.mockResolvedValue({
        _id: enrollmentId,
        status: 'enrolled',
      });
      await enroll(req, res, next);
      expect(BenefitEnrollment.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('should return 409 if already enrolled', async () => {
      req.body = { planId };
      BenefitPlan.findOne.mockResolvedValue({
        _id: planId,
        isActive: true,
        maxEnrollees: null,
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      BenefitEnrollment.findOne.mockResolvedValue({
        _id: enrollmentId,
        status: 'enrolled',
      });
      await enroll(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
    it('should re-enroll if previously cancelled', async () => {
      req.body = { planId, coverageType: 'individual' };
      BenefitPlan.findOne.mockResolvedValue({
        _id: planId,
        isActive: true,
        employeeContribution: 200,
      });
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      const mock = { _id: enrollmentId, status: 'cancelled', save: jest.fn() };
      BenefitEnrollment.findOne.mockResolvedValue(mock);
      await enroll(req, res, next);
      expect(mock.status).toBe('enrolled');
      expect(mock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 409 if max enrollees reached', async () => {
      req.body = { planId };
      BenefitPlan.findOne.mockResolvedValue({
        _id: planId,
        isActive: true,
        maxEnrollees: 10,
      });
      BenefitEnrollment.countDocuments.mockResolvedValue(10);
      await enroll(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // ─── cancelEnrollment ────────────────────────────────────────────────
  describe('cancelEnrollment', () => {
    it('should cancel an enrollment', async () => {
      req.params.enrollmentId = enrollmentId;
      req.body = { reason: 'Switching plans' };
      const mock = { _id: enrollmentId, status: 'enrolled', save: jest.fn() };
      BenefitEnrollment.findOne.mockResolvedValue(mock);
      await cancelEnrollment(req, res, next);
      expect(mock.status).toBe('cancelled');
      expect(mock.cancellationReason).toBe('Switching plans');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 400 if already cancelled', async () => {
      req.params.enrollmentId = enrollmentId;
      BenefitEnrollment.findOne.mockResolvedValue({
        _id: enrollmentId,
        status: 'cancelled',
      });
      await cancelEnrollment(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── getMyEnrollments ────────────────────────────────────────────────
  describe('getMyEnrollments', () => {
    it('should return enrollments for the employee', async () => {
      Employee.findOne.mockResolvedValue({ _id: employeeId });
      BenefitEnrollment.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
      });
      await getMyEnrollments(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return empty if no employee record', async () => {
      Employee.findOne.mockResolvedValue(null);
      await getMyEnrollments(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ enrollments: [] });
    });
  });

  // ─── getAllEnrollments ────────────────────────────────────────────────
  describe('getAllEnrollments', () => {
    it('should return all enrollments', async () => {
      BenefitEnrollment.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue({
            populate: jest
              .fn()
              .mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
          }),
      });
      await getAllEnrollments(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── terminateEnrollment ─────────────────────────────────────────────
  describe('terminateEnrollment', () => {
    it('should terminate an enrollment', async () => {
      req.params.enrollmentId = enrollmentId;
      req.body = { reason: 'Left company' };
      const mock = { _id: enrollmentId, status: 'enrolled', save: jest.fn() };
      BenefitEnrollment.findOne.mockResolvedValue(mock);
      await terminateEnrollment(req, res, next);
      expect(mock.status).toBe('terminated');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should return 400 if already terminated', async () => {
      req.params.enrollmentId = enrollmentId;
      BenefitEnrollment.findOne.mockResolvedValue({
        _id: enrollmentId,
        status: 'terminated',
      });
      await terminateEnrollment(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── getEnrollmentStats ──────────────────────────────────────────────
  describe('getEnrollmentStats', () => {
    it('should return stats for all plans', async () => {
      BenefitPlan.find.mockResolvedValue([
        { _id: planId, name: 'Health', category: 'health', maxEnrollees: 50 },
      ]);
      Employee.countDocuments.mockResolvedValue(100);
      BenefitEnrollment.countDocuments.mockResolvedValue(30);
      BenefitEnrollment.aggregate.mockResolvedValue([{ total: 6000 }]);
      await getEnrollmentStats(req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body.totalEmployees).toBe(100);
      expect(body.plans[0].enrolled).toBe(30);
      expect(body.plans[0].utilization).toBe(60);
    });
  });
});
