/**
 * Migration: Create PayslipGeneration collection
 * Issue #1904
 */

async function up(db) {
  await db.createCollection('payslipgenerations', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['jobHash', 'payrollId', 'employeeId', 'tenantId'],
        properties: {
          jobHash: { bsonType: 'string' },
          payrollId: { bsonType: 'objectId' },
          employeeId: { bsonType: 'objectId' },
          tenantId: { bsonType: 'objectId' },
          status: { bsonType: 'string' }
        }
      }
    }
  });

  // Create indexes
  await db.collection('payslipgenerations').createIndex({ jobHash: 1 }, { unique: true });
  await db.collection('payslipgenerations').createIndex({ payrollId: 1, tenantId: 1 });
  await db.collection('payslipgenerations').createIndex({ status: 1, tenantId: 1 });
}

async function down(db) {
  await db.collection('payslipgenerations').drop();
}

module.exports = { up, down };