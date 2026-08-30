const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-global-4.4');
const piiMaskingPlugin = require('../piiMaskingPlugin');
const DataPrivacyPolicy = require('../../models/dataPrivacyPolicy.model');
const Employee = require('../../models/employee.model');
const { requestUnmaskedPII } = require('../../services/dataPrivacy.service');
const eventBus = require('../../services/event.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('piiMaskingPlugin & dataPrivacyService', () => {
  let tenantId, employeeId;

  beforeEach(async () => {
    await DataPrivacyPolicy.deleteMany({});
    await Employee.deleteMany({});

    tenantId = new mongoose.Types.ObjectId();
    
    // Create standard masking policy
    await DataPrivacyPolicy.create({
      tenantId,
      rules: [
        {
          path: 'Employee.bankAccount',
          maskingType: 'partial',
          roles: ['HR', 'Auditor'],
        },
        {
          path: 'Employee.ssn',
          maskingType: 'full',
          roles: ['HR'],
        },
      ],
      isActive: true,
    });

    const emp = await Employee.create({
      tenantId,
      name: 'John Doe',
      bankAccount: '123456789012',
      ssn: '987-654-321',
      createdBy: new mongoose.Types.ObjectId(),
    });
    employeeId = emp._id;
  });

  it('masks bankAccount and ssn for HR role', async () => {
    const doc = await Employee.findOne({ _id: employeeId })
      .setOptions({ tenantId, userRole: 'HR' });

    expect(doc).toBeDefined();
    // 123456789012 should turn into XXXXXXXX9012 (partial masking last 4 digits visible)
    expect(doc.bankAccount).toBe('XXXXXXXX9012');
    expect(doc.ssn).toBe('[MASKED]');
  });

  it('does not mask bankAccount for Admin role (cleartext)', async () => {
    const doc = await Employee.findOne({ _id: employeeId })
      .setOptions({ tenantId, userRole: 'Admin' });

    expect(doc).toBeDefined();
    expect(doc.bankAccount).toBe('123456789012');
    expect(doc.ssn).toBe('987-654-321');
  });

  it('privileged requestUnmaskedPII retrieves cleartext and triggers audit log', async () => {
    const auditLogSpy = jest.fn();
    eventBus.on('AUDIT_LOG', auditLogSpy);

    const result = await requestUnmaskedPII({
      userId: 'user123',
      tenantId,
      employeeId,
      fields: ['bankAccount', 'ssn'],
      reason: 'Maker-checker validation verification',
      userRole: 'Auditor',
      req: { ip: '1.2.3.4' },
    });

    expect(result.bankAccount).toBe('123456789012');
    expect(result.ssn).toBe('987-654-321');

    expect(auditLogSpy).toHaveBeenCalledTimes(1);
    expect(auditLogSpy.mock.calls[0][0]).toMatchObject({
      userId: 'user123',
      action: 'UNMASKED_PII_VIEWED',
      resourceType: 'Employee',
      details: {
        fields: ['bankAccount', 'ssn'],
        reason: 'Maker-checker validation verification',
        userRole: 'Auditor',
        ipAddress: '1.2.3.4',
      },
    });

    eventBus.off('AUDIT_LOG', auditLogSpy);
  });
});
