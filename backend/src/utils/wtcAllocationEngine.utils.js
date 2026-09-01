/**
 * @fileoverview WOTC Allocation Engine
 * Issue: #1935
 */

function evaluateWOTCCap(grossWages, ytdAllocatedWages, maxQualifiedWages) {
    const remainingCap = Math.max(0, maxQualifiedWages - ytdAllocatedWages);
    const allocatedWages = Math.min(grossWages, remainingCap);
    const capReached = (ytdAllocatedWages + allocatedWages) >= maxQualifiedWages;
    return { allocatedWages, capReached, newYtd: ytdAllocatedWages + allocatedWages };
}

function check28DaySLA(hireDate, submissionDate, currentDate) {
    const deadline = new Date(hireDate);
    deadline.setDate(deadline.getDate() + 28);

    if (submissionDate) {
        return { isSLABreached: new Date(submissionDate) > deadline, daysRemaining: 0 };
    }

    const diffTime = deadline.getTime() - new Date(currentDate).getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { isSLABreached: daysRemaining < 0, daysRemaining: Math.max(0, daysRemaining) };
}

function calculateForm5884Credit(allocatedWages, creditPercentage, isSecondYear = false) {
    const rate = isSecondYear ? creditPercentage : 0.25; // 25% first year, 50% second year for some groups
    return Math.round(allocatedWages * rate * 100) / 100;
}

module.exports = { evaluateWOTCCap, check28DaySLA, calculateForm5884Credit };
