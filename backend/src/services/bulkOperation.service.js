const BulkOperation = require('../models/bulkOperation.model');
const Employee = require('../models/employee.model');
const { bulkOperationQueue } = require('../jobs/queue.service');

class BulkOperationService {
  async previewOperation(tenantId, operationType, employeeIds, spec) {
    const employees = await Employee.find({
      _id: { $in: employeeIds },
      tenantId,
      deletedAt: null,
    }).lean();

    const snapshots = [];
    for (const employee of employees) {
      let newValue = null;
      let error = null;

      try {
        if (operationType === 'SALARY_REVISION') {
          const currentSalary = employee.monthlySalary || 0;
          if (spec.type === 'percentage') {
            newValue = currentSalary + currentSalary * (spec.value / 100);
          } else if (spec.type === 'fixed') {
            newValue = currentSalary + spec.value;
          } else if (spec.type === 'absolute') {
            newValue = spec.value;
          } else {
            throw new Error('Invalid salary revision type');
          }
        } else if (operationType === 'DEPARTMENT_TRANSFER') {
          newValue = spec.department;
        } else if (operationType === 'ROLE_CHANGE') {
          newValue = spec.role;
        } else {
          throw new Error('Unsupported operation type');
        }
      } catch (err) {
        error = err.message;
      }

      snapshots.push({
        employeeId: employee._id,
        previousValue:
          operationType === 'SALARY_REVISION'
            ? employee.monthlySalary
            : operationType === 'DEPARTMENT_TRANSFER'
              ? employee.department
              : employee.role,
        newValue,
        status: error ? 'error' : 'pending',
        error,
      });
    }

    return {
      operationType,
      spec,
      totalCount: employees.length,
      snapshots,
    };
  }

  async executeOperation(tenantId, userId, operationType, employeeIds, spec) {
    const preview = await this.previewOperation(
      tenantId,
      operationType,
      employeeIds,
      spec,
    );

    const operation = await BulkOperation.create({
      tenantId,
      createdBy: userId,
      operationType,
      spec,
      snapshots: preview.snapshots,
      totalCount: preview.totalCount,
      status: 'pending',
    });

    await bulkOperationQueue.add('execute-bulk-operation', {
      operationId: operation._id,
      tenantId,
      userId,
    });

    return operation;
  }

  async rollbackOperation(tenantId, userId, operationId) {
    const operation = await BulkOperation.findOne({
      _id: operationId,
      tenantId,
    });

    if (!operation) {
      throw new Error('Bulk operation not found');
    }

    if (operation.status !== 'completed' && operation.status !== 'failed') {
      throw new Error('Can only rollback completed or failed operations');
    }

    operation.status = 'rolling_back';
    await operation.save();

    await bulkOperationQueue.add('rollback-bulk-operation', {
      operationId: operation._id,
      tenantId,
      userId,
    });

    return operation;
  }
}

module.exports = new BulkOperationService();
