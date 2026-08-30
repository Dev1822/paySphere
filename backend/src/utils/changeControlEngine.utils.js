/**
 * @fileoverview Change Control Engine Utilities
 * @description Scores change risks, enforces Segregation of Duties (SoD), 
 * and generates immutable audit snapshots.
 * Issue: #1734
 */

/**
 * Scores the risk level of a proposed payroll change.
 * @param {string} changeType 
 * @param {number} beforeValue 
 * @param {number} afterValue 
 * @returns {{ riskScore: string, reason: string }}
 */
function scoreChangeRisk(changeType, beforeValue, afterValue) {
    // Bank account changes are always high risk (potential fraud/diversion)
    if (changeType === 'Bank Account') {
        return { riskScore: 'High', reason: 'Banking details modified. Requires strict dual-authorization.' };
    }

    if (changeType === 'Salary' || changeType === 'Bonus') {
        const numericBefore = Number(beforeValue) || 0;
        const numericAfter = Number(afterValue) || 0;
        const variance = Math.abs(numericAfter - numericBefore);
        const percentChange = numericBefore > 0 ? (variance / numericBefore) * 100 : 100;

        if (percentChange > 20 || variance > 50000) {
            return { riskScore: 'High', reason: `Compensation variance exceeds 20% or $50k threshold.` };
        }
        if (percentChange > 5) {
            return { riskScore: 'Medium', reason: 'Standard compensation adjustment.' };
        }
    }

    return { riskScore: 'Low', reason: 'Routine administrative update.' };
}

/**
 * Segregation of Duties (SoD) Guardrail.
 * Ensures the "maker" (requester) is not the same as the "checker" (approver),
 * and that the approver has sufficient authority.
 * 
 * @param {Object} maker - { id, role }
 * @param {Object} checker - { id, role }
 * @returns {{ isCompliant: boolean, reason: string }}
 */
function validateSegregationOfDuties(maker, checker) {
    // Rule 1: No self-approval
    if (maker.id.toString() === checker.id.toString()) {
        return {
            isCompliant: false,
            reason: 'SOX Violation: Maker cannot be the Checker. Self-approval is strictly prohibited.'
        };
    }

    // Rule 2: Role hierarchy validation (Mocked hierarchy)
    const hierarchy = { 'Payroll Admin': 1, 'HR Manager': 2, 'Finance Director': 3, 'CFO': 4 };
    const makerLevel = hierarchy[maker.role] || 0;
    const checkerLevel = hierarchy[checker.role] || 0;

    if (maker.role === 'Payroll Admin' && changeRequiresHighApproval && checkerLevel < 2) {
        return {
            isCompliant: false,
            reason: 'SOX Violation: High-risk changes require approval from HR Manager or above.'
        };
    }

    if (checkerLevel <= makerLevel && maker.role !== 'Employee') {
        return {
            isCompliant: false,
            reason: 'SOX Violation: Approver must hold a higher or equal authorization tier than the requester.'
        };
    }

    return { isCompliant: true, reason: 'Segregation of Duties validated.' };
}

/**
 * Generates an immutable snapshot of the request state for the audit log.
 * @param {Object} request - PayrollChangeRequest document
 * @param {Object} workflow - ApprovalWorkflow document
 * @returns {Object}
 */
function generateAuditSnapshot(request, workflow) {
    return {
        requestId: request._id,
        employeeId: request.employeeId,
        changeType: request.changeType,
        fieldName: request.fieldName,
        beforeValue: request.beforeValue,
        afterValue: request.afterValue,
        riskScore: request.riskScore,
        currentStatus: request.status,
        workflowStage: workflow ? workflow.stage : 1,
        workflowStatus: workflow ? workflow.status : 'Pending Review',
        timestamp: new Date().toISOString()
    };
}

module.exports = { scoreChangeRisk, validateSegregationOfDuties, generateAuditSnapshot };
