const mongoose = require('mongoose');
const AccessPolicy = require('../models/accessPolicy.model');
const PolicyAttachment = require('../models/policyAttachment.model');
const Role = require('../models/role.model');
const logger = require('../utils/logger');
const { roles: staticRoles } = require('../middlewares/rbac.middleware');

async function seedAbacPolicies() {
  logger.info('Starting ABAC policies seed...');

  try {
    const policies = [
      {
        name: 'DefaultEmployeePolicy',
        description: 'Default access for employees to view their own records',
        effect: 'allow',
        actions: ['employee:read', 'payroll:read', 'attendance:read'],
        resources: ['Employee', 'Payroll', 'Attendance'],
        conditions: [
          {
            attribute: 'resource.employeeId',
            operator: 'equals',
            value: '$subject._id',
          },
        ],
      },
      {
        name: 'DefaultManagerPolicy',
        description: 'Managers can read records within their department',
        effect: 'allow',
        actions: [
          'employee:read',
          'payroll:read',
          'report:read',
          'attendance:read',
          'attendance:write',
        ],
        resources: ['Employee', 'Payroll', 'Report', 'Attendance'],
        conditions: [
          {
            attribute: 'resource.department',
            operator: 'equals',
            value: '$subject.department',
          },
        ],
      },
      {
        name: 'DefaultEmployerPolicy',
        description: 'Employers have broad read/write access',
        effect: 'allow',
        actions: [
          'employee:read',
          'employee:write',
          'payroll:read',
          'payroll:write',
          'report:read',
          'report:write',
          'attendance:read',
          'attendance:write',
        ],
        resources: ['Employee', 'Payroll', 'Report', 'Attendance'],
        conditions: [],
      },
      {
        name: 'DefaultAdminPolicy',
        description: 'Admins have full access',
        effect: 'allow',
        actions: ['*'],
        resources: ['*'],
        conditions: [],
      },
    ];

    for (const policyData of policies) {
      const existing = await AccessPolicy.findOne({ name: policyData.name });
      if (!existing) {
        await AccessPolicy.create(policyData);
        logger.info(`Created policy: ${policyData.name}`);
      }
    }

    // Attempt to map static roles to policies
    const dbRoles = await Role.find({});
    for (const role of dbRoles) {
      let policyName = null;
      if (role.name === 'admin' || role.name === 'SUPER_ADMIN')
        policyName = 'DefaultAdminPolicy';
      else if (role.name === 'employer' || role.name === 'OWNER')
        policyName = 'DefaultEmployerPolicy';
      else if (role.name === 'manager' || role.name === 'MANAGER')
        policyName = 'DefaultManagerPolicy';
      else policyName = 'DefaultEmployeePolicy';

      const policy = await AccessPolicy.findOne({ name: policyName });
      if (policy) {
        const attachExists = await PolicyAttachment.findOne({
          policyId: policy._id,
          principalId: role._id,
          principalType: 'Role',
        });
        if (!attachExists) {
          await PolicyAttachment.create({
            policyId: policy._id,
            principalId: role._id,
            principalType: 'Role',
          });
          logger.info(`Attached ${policyName} to role ${role.name}`);
        }
      }
    }

    logger.info('ABAC policies seeded successfully.');
  } catch (error) {
    logger.error('Error seeding ABAC policies:', error);
  }
}

module.exports = { seedAbacPolicies };
