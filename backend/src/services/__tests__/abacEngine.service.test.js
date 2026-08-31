const {
  evaluateAccess,
  evaluateCondition,
  getAttributeValue,
} = require('../abacEngine.service');
const PolicyAttachment = require('../../models/policyAttachment.model');
const AccessPolicy = require('../../models/accessPolicy.model');

jest.mock('../../models/policyAttachment.model');
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
}));

describe('ABAC Engine Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAttributeValue', () => {
    it('should retrieve nested attribute value', () => {
      const obj = { user: { profile: { department: 'Engineering' } } };
      expect(getAttributeValue(obj, 'user.profile.department')).toBe(
        'Engineering',
      );
    });

    it('should return undefined for missing paths', () => {
      const obj = { user: {} };
      expect(getAttributeValue(obj, 'user.profile.department')).toBeUndefined();
    });
  });

  describe('evaluateCondition', () => {
    const contextData = {
      subject: { department: 'Engineering', id: '123' },
      resource: { department: 'Engineering', createdBy: '123' },
    };

    it('should evaluate equals correctly', () => {
      expect(
        evaluateCondition(
          {
            attribute: 'subject.department',
            operator: 'equals',
            value: 'Engineering',
          },
          contextData,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          {
            attribute: 'subject.department',
            operator: 'equals',
            value: 'Sales',
          },
          contextData,
        ),
      ).toBe(false);
    });

    it('should evaluate equals using context variable', () => {
      expect(
        evaluateCondition(
          {
            attribute: 'resource.department',
            operator: 'equals',
            value: '$subject.department',
          },
          contextData,
        ),
      ).toBe(true);
    });

    it('should evaluate in correctly', () => {
      expect(
        evaluateCondition(
          {
            attribute: 'subject.department',
            operator: 'in',
            value: ['Engineering', 'Sales'],
          },
          contextData,
        ),
      ).toBe(true);
    });

    it('should evaluate greater_than correctly', () => {
      const ctx = { resource: { amount: 1500 } };
      expect(
        evaluateCondition(
          {
            attribute: 'resource.amount',
            operator: 'greater_than',
            value: 1000,
          },
          ctx,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          {
            attribute: 'resource.amount',
            operator: 'greater_than',
            value: 2000,
          },
          ctx,
        ),
      ).toBe(false);
    });
  });

  describe('evaluateAccess', () => {
    const mockUser = { _id: 'user1', role: 'role1' };

    it('should return true if an allow policy matches and conditions are met', async () => {
      const mockPolicy = {
        actions: ['employee:read'],
        resources: ['Employee'],
        effect: 'allow',
        conditions: [
          {
            attribute: 'resource.department',
            operator: 'equals',
            value: '$subject.department',
          },
        ],
      };

      PolicyAttachment.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([{ policyId: mockPolicy }]),
      });

      const allowed = await evaluateAccess(
        { _id: 'user1', department: 'Engineering' },
        'employee:read',
        'Employee',
        { department: 'Engineering' },
      );

      expect(allowed).toBe(true);
    });

    it('should return false if explicit deny policy matches', async () => {
      const mockPolicyAllow = {
        actions: ['employee:read'],
        resources: ['Employee'],
        effect: 'allow',
        conditions: [],
      };
      const mockPolicyDeny = {
        actions: ['employee:read'],
        resources: ['Employee'],
        effect: 'deny',
        conditions: [],
      };

      PolicyAttachment.find.mockReturnValue({
        populate: jest
          .fn()
          .mockResolvedValue([
            { policyId: mockPolicyAllow },
            { policyId: mockPolicyDeny },
          ]),
      });

      const allowed = await evaluateAccess(
        mockUser,
        'employee:read',
        'Employee',
        {},
      );

      expect(allowed).toBe(false);
    });

    it('should return false if no policies match', async () => {
      PolicyAttachment.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const allowed = await evaluateAccess(
        mockUser,
        'employee:read',
        'Employee',
        {},
      );

      expect(allowed).toBe(false);
    });
  });
});
