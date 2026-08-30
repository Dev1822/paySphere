require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const logger = require('../utils/logger');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');
const Role = require('../models/role.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const { seedRbac } = require('./rbac.seed');

const seedE2EUser = async () => {
  try {
    await connectDB();
    await seedRbac();
    const ownerRole = await Role.findOne({ name: 'Owner' });
    if (!ownerRole) {
      throw new Error('Owner role not found after RBAC seeding');
    }

    const testEmail = (
      process.env.TEST_USER_EMAIL || 'test@example.com'
    ).toLowerCase();
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword';

    let user = await User.findOne({ email: testEmail });
    if (!user) {
      const hashedPassword = await bcrypt.hash(testPassword, 12);

      // Setup Tenant first
      let tenant = new Tenant({
        name: 'PaySphere Test Tenant',
        domain: 'paysphere-test.com',
      });
      await tenant.save();
      logger.info('Test Tenant created');

      user = new User({
        fullName: 'Test E2E User',
        email: testEmail,
        companyName: 'PaySphere Test Tenant',
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        accountType: 'ADMIN',
        role: ownerRole._id,
        tenantId: tenant._id,
        isEmailVerified: true,
      });
      await user.save();
      logger.info(`Test user ${testEmail} created successfully.`);

      tenant.ownerId = user._id;
      await tenant.save();
    } else {
      logger.info(`Test user ${testEmail} already exists.`);
    }

    // Keep one deterministic employee available for the payroll CUJ.
    // Remove only this fixture's previous payroll rows so the test can be
    // rerun locally without colliding with the current pay period.
    const payrollFixtureName = 'E2E Payroll Employee';
    let payrollEmployee = await Employee.findOne({
      tenantId: user.tenantId,
      fullName: payrollFixtureName,
      role: 'E2E Tester',
    });

    if (!payrollEmployee) {
      payrollEmployee = await Employee.create({
        fullName: payrollFixtureName,
        role: 'E2E Tester',
        department: 'Engineering',
        monthlySalary: 75000,
        overtimeRate: 500,
        companyName: user.companyName,
        createdBy: user._id,
        tenantId: user.tenantId,
        isActive: true,
        employmentStatus: 'active',
      });
      logger.info(`E2E payroll employee ${payrollFixtureName} created.`);
    }

    await PayrollUpdate.deleteMany({
      tenantId: user.tenantId,
      employeeId: payrollEmployee._id,
    });

    logger.info(`E2E payroll fixture reset for ${payrollFixtureName}.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('E2E database seeding failed', { error: error.message });
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedE2EUser();
