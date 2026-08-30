const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const BulkOperation = require('../models/bulkOperation.model');
const Employee = require('../models/employee.model');
const User = require('../models/user.model');
const { connection } = require('../jobs/queue.service');
const logger = require('../utils/logger');
const payrollSocket = require('../sockets/payroll.socket');
const eventBus = require('../services/event.service');
const { invalidateStatsCaches } = require('../controllers/stats.controller');

async function processExecute(job) {
  const { operationId, tenantId, userId } = job.data;
  const operation = await BulkOperation.findOne({ _id: operationId, tenantId });

  if (!operation || operation.status !== 'pending') {
    return { skipped: true, reason: 'invalid_status' };
  }

  operation.status = 'processing';
  await operation.save();

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < operation.snapshots.length; i++) {
    const snapshot = operation.snapshots[i];
    const employee = await Employee.findOne({
      _id: snapshot.employeeId,
      tenantId,
    });

    if (!employee || employee.deletedAt) {
      snapshot.status = 'error';
      snapshot.error = 'Employee not found or deleted';
      errorCount++;
      continue;
    }

    try {
      if (operation.operationType === 'SALARY_REVISION') {
        employee.monthlySalary = snapshot.newValue;
        // Optionally add to SalaryHistory here if needed, or rely on existing middlewares/triggers
      } else if (operation.operationType === 'DEPARTMENT_TRANSFER') {
        employee.department = snapshot.newValue;
      } else if (operation.operationType === 'ROLE_CHANGE') {
        employee.role = snapshot.newValue;
      }

      await employee.save();

      snapshot.status = 'success';
      successCount++;
    } catch (err) {
      snapshot.status = 'error';
      snapshot.error = err.message;
      errorCount++;
    }

    // Emit progress
    const progress = Math.floor(((i + 1) / operation.snapshots.length) * 100);
    await job.updateProgress(progress);

    const io = payrollSocket.getIo();
    if (io) {
      io.to(`user:${userId}`).emit('bulk_operation_progress', {
        operationId,
        progress,
        processedCount: i + 1,
        totalCount: operation.snapshots.length,
      });
    }
  }

  operation.status = 'completed';
  operation.processedCount = operation.snapshots.length;
  operation.successCount = successCount;
  operation.errorCount = errorCount;
  await operation.save();

  const io = payrollSocket.getIo();
  if (io) {
    io.to(`user:${userId}`).emit('bulk_operation_completed', {
      operationId,
      successCount,
      errorCount,
    });
  }

  eventBus.emit('AUDIT_LOG', {
    userId,
    action: 'BULK_OPERATION_EXECUTE',
    resourceType: 'BulkOperation',
    resourceIds: [operation._id],
    details: {
      operationType: operation.operationType,
      successCount,
      errorCount,
    },
    // We mock req since this is background
    req: { ip: 'worker', auditContext: { userId, tenantId } },
  });

  await invalidateStatsCaches(tenantId);

  return { successCount, errorCount };
}

async function processRollback(job) {
  const { operationId, tenantId, userId } = job.data;
  const operation = await BulkOperation.findOne({ _id: operationId, tenantId });

  if (!operation || operation.status !== 'rolling_back') {
    return { skipped: true, reason: 'invalid_status' };
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < operation.snapshots.length; i++) {
    const snapshot = operation.snapshots[i];

    // Only rollback successful ones
    if (snapshot.status !== 'success') {
      continue;
    }

    const employee = await Employee.findOne({
      _id: snapshot.employeeId,
      tenantId,
    });

    if (!employee || employee.deletedAt) {
      snapshot.error = 'Employee not found for rollback';
      errorCount++;
      continue;
    }

    try {
      if (operation.operationType === 'SALARY_REVISION') {
        employee.monthlySalary = snapshot.previousValue;
      } else if (operation.operationType === 'DEPARTMENT_TRANSFER') {
        employee.department = snapshot.previousValue;
      } else if (operation.operationType === 'ROLE_CHANGE') {
        employee.role = snapshot.previousValue;
      }

      await employee.save();

      snapshot.status = 'rolled_back';
      successCount++;
    } catch (err) {
      snapshot.error = 'Rollback failed: ' + err.message;
      errorCount++;
    }

    // Emit progress
    const progress = Math.floor(((i + 1) / operation.snapshots.length) * 100);
    await job.updateProgress(progress);

    const io = payrollSocket.getIo();
    if (io) {
      io.to(`user:${userId}`).emit('bulk_operation_progress', {
        operationId,
        progress,
        processedCount: i + 1,
        totalCount: operation.snapshots.length,
        isRollback: true,
      });
    }
  }

  operation.status = 'rolled_back';
  await operation.save();

  const io = payrollSocket.getIo();
  if (io) {
    io.to(`user:${userId}`).emit('bulk_operation_rolled_back', {
      operationId,
      successCount,
      errorCount,
    });
  }

  eventBus.emit('AUDIT_LOG', {
    userId,
    action: 'BULK_OPERATION_ROLLBACK',
    resourceType: 'BulkOperation',
    resourceIds: [operation._id],
    details: {
      operationType: operation.operationType,
      successCount,
      errorCount,
    },
    req: { ip: 'worker', auditContext: { userId, tenantId } },
  });

  await invalidateStatsCaches(tenantId);

  return { successCount, errorCount };
}

async function processBulkOperationJob(job) {
  logger.info(
    `Starting bulk operation job ${job.id} of type ${job.name} for user ${job.data.userId}`,
  );

  if (job.name === 'execute-bulk-operation') {
    return await processExecute(job);
  } else if (job.name === 'rollback-bulk-operation') {
    return await processRollback(job);
  } else {
    throw new Error('Unknown job name: ' + job.name);
  }
}

let bulkOperationWorker;

function startBulkOperationWorker() {
  if (bulkOperationWorker) return bulkOperationWorker;

  bulkOperationWorker = new Worker('bulk-operations', processBulkOperationJob, {
    connection,
  });

  bulkOperationWorker.on('completed', (job) => {
    logger.info(`Bulk operation job ${job.id} has completed!`);
  });

  bulkOperationWorker.on('failed', (job, err) => {
    logger.error(`Bulk operation job ${job.id} has failed with ${err.message}`);
  });

  logger.info('Bulk operations worker started');
  return bulkOperationWorker;
}

module.exports = {
  startBulkOperationWorker,
};
