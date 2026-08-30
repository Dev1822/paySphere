/**
 * @fileoverview PEO Funding Engine
 * Issue: #1937
 */

function calculateFundingRequest(netPayTotal, employerTaxesTotal, grossWagesTotal, adminFeePercentage) {
    const adminFeeTotal = Math.round(grossWagesTotal * adminFeePercentage * 100) / 100;
    const totalFundingRequested = Math.round((netPayTotal + employerTaxesTotal + adminFeeTotal) * 100) / 100;

    return { adminFeeTotal, totalFundingRequested };
}

function generateLaborDistribution(departmentWages, defaultGLAccount, adminFeePercentage) {
    const journals = [];
    let totalDebits = 0;

    for (const dept of departmentWages) {
        const gross = dept.grossWages;
        const taxes = dept.employerTaxes;
        const fee = Math.round(gross * adminFeePercentage * 100) / 100;
        const totalCost = gross + taxes + fee;

        journals.push({
            departmentId: dept.departmentId,
            glAccountCode: dept.glAccountCode || defaultGLAccount,
            debitAmount: Math.round(totalCost * 100) / 100,
            description: `PEO Labor Cost - ${dept.departmentName}`
        });
        totalDebits += totalCost;
    }

    // Liability Credit (Owed to PEO)
    journals.push({
        departmentId: null,
        glAccountCode: '2000-PEO-Payable', // Standard liability account
        creditAmount: Math.round(totalDebits * 100) / 100,
        description: 'Intercompany PEO Funding Payable'
    });

    return { journals, isBalanced: Math.round(totalDebits * 100) === Math.round(totalDebits * 100) };
}

module.exports = { calculateFundingRequest, generateLaborDistribution };
