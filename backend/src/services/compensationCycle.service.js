const mongoose = require('mongoose');
const CompensationCycle = require('../models/compensationCycle.model');
const MeritMatrix = require('../models/meritMatrix.model');
const CycleBudget = require('../models/cycleBudget.model');
const RevisionProposal = require('../models/revisionProposal.model');
const { SalaryAdjustment } = require('../models/salaryAdjustment.model');
const SalaryHistory = require('../models/salaryHistory.model');
const Employee = require('../models/employee.model');

class CompensationCycleService {
  /**
   * Propose a revision for an employee
   */
  async createRevisionProposal(
    tenantId,
    managerId,
    cycleId,
    employeeId,
    proposedSalary,
    performanceRating,
    compaRatio,
    justification,
    userDetails,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cycle = await CompensationCycle.findOne({
        _id: cycleId,
        tenantId,
        status: 'Open',
      }).session(session);
      if (!cycle) {
        throw new Error('Cycle is not open or does not exist');
      }

      const employee = await Employee.findOne({
        _id: employeeId,
        tenantId,
      }).session(session);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check budget
      const budget = await CycleBudget.findOne({
        compensationCycleId: cycleId,
        departmentId: employee.departmentId,
        tenantId,
      }).session(session);

      const currentSalary = employee.currentSalary || 0;
      const proposedIncreaseAmount = proposedSalary - currentSalary;
      const proposedIncreasePercentage =
        currentSalary > 0
          ? (proposedIncreaseAmount / currentSalary) * 100
          : 100;

      if (budget) {
        // Calculate new utilized amount (simplified: we should sum all submitted/approved proposals)
        // Here we just do a quick check against the proposed amount vs allocated amount minus current utilization
        if (
          budget.utilizedAmount + proposedIncreaseAmount >
          budget.allocatedAmount
        ) {
          throw new Error('422: Proposal exceeds department budget'); // specific error string to catch 422 in controller
        }
      }

      // Check merit matrix
      const matrix = await MeritMatrix.findOne({
        compensationCycleId: cycleId,
        tenantId,
        performanceRating,
        compaRatioMin: { $lte: compaRatio },
        compaRatioMax: { $gte: compaRatio },
      }).session(session);

      let isOutsideMeritMatrix = false;
      if (matrix) {
        if (
          proposedIncreasePercentage < matrix.recommendedIncreaseMin ||
          proposedIncreasePercentage > matrix.recommendedIncreaseMax
        ) {
          isOutsideMeritMatrix = true;
        }
      }

      if (
        isOutsideMeritMatrix &&
        (!justification || justification.trim().length === 0)
      ) {
        throw new Error(
          'Justification required as proposal is outside merit matrix corridor',
        );
      }

      const proposal = new RevisionProposal({
        tenantId,
        compensationCycleId: cycleId,
        employeeId,
        managerId,
        currentSalary,
        proposedSalary,
        proposedIncreaseAmount,
        proposedIncreasePercentage,
        performanceRating,
        compaRatio,
        isOutsideMeritMatrix,
        justification,
        status: 'Submitted',
        approvalHistory: [
          {
            actionBy: managerId,
            action: 'Submitted',
            comment: 'Initial proposal submission',
          },
        ],
      });

      await proposal.save({ session });

      if (budget) {
        budget.utilizedAmount += proposedIncreaseAmount;
        await budget.save({ session });
      }

      await session.commitTransaction();
      return proposal;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Multi-tier approval
   */
  async approveProposal(
    tenantId,
    userId,
    proposalId,
    version,
    newStatus,
    comment,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const proposal = await RevisionProposal.findOne({
        _id: proposalId,
        tenantId,
        __v: version,
      }).session(session);
      if (!proposal) {
        throw new Error(
          'Proposal not found or version mismatch (optimistic concurrency error)',
        );
      }

      // Update status
      proposal.status = newStatus;

      proposal.approvalHistory.push({
        actionBy: userId,
        action: newStatus === 'Rejected' ? 'Rejected' : 'Approved',
        comment,
      });

      // Optimistic concurrency is handled by Mongoose plugin or by manually incrementing
      proposal.__v = version + 1; // Mongoose will check the original __v

      await proposal.save({ session });

      await session.commitTransaction();
      return proposal;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Close a cycle and apply proposals
   */
  async closeCycle(tenantId, cycleId, userId, userName) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cycle = await CompensationCycle.findOne({
        _id: cycleId,
        tenantId,
      }).session(session);
      if (!cycle || cycle.status === 'Closed') {
        throw new Error('Cycle not found or already closed');
      }

      cycle.status = 'Closed';
      await cycle.save({ session });

      // Find all finance approved proposals
      const proposals = await RevisionProposal.find({
        compensationCycleId: cycleId,
        tenantId,
        status: 'Finance_Approved',
      })
        .populate('employeeId')
        .session(session);

      const currentDate = new Date();

      for (const proposal of proposals) {
        const employee = proposal.employeeId;

        // 1. Create Salary History
        await SalaryHistory.createHistory({
          employeeId: employee._id,
          employeeName: employee.firstName + ' ' + employee.lastName,
          previousSalary: proposal.currentSalary,
          newSalary: proposal.proposedSalary,
          changedBy: userId,
          changedByName: userName,
          tenantId,
          reason: 'annual_revision',
          note: `Compensation Cycle: ${cycle.name}`,
          currency: proposal.currency,
        });

        // 2. Create Salary Adjustment
        const adjustment = new SalaryAdjustment({
          tenantId,
          employeeId: employee._id,
          effectiveMonth: currentDate.getMonth() + 1,
          effectiveYear: currentDate.getFullYear(),
          oldSalaryRate: proposal.currentSalary,
          newSalaryRate: proposal.proposedSalary,
          calculatedDelta: proposal.proposedIncreaseAmount,
          status: 'Pending',
        });
        await adjustment.save({ session });

        // Update employee current salary
        employee.currentSalary = proposal.proposedSalary;
        await employee.save({ session });
      }

      await session.commitTransaction();
      return cycle;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new CompensationCycleService();
