/**
 * @fileoverview FLSA Overtime & AWS Engine
 * Issue: #1934
 */

function calculateDailyOvertime(hoursWorked, matrix, awsSchedule) {
    let regular = 0, ot15 = 0, ot20 = 0;

    // AWS Exception: 4/10s means 10 hours regular, OT after 10
    const dailyLimit = awsSchedule && awsSchedule.scheduleType === '4/10' ? 10 : matrix.dailyOTThreshold;
    const doubleLimit = awsSchedule && awsSchedule.scheduleType === '4/10' ? 12 : matrix.dailyDoubleTimeThreshold;

    if (hoursWorked <= dailyLimit) {
        regular = hoursWorked;
    } else if (hoursWorked <= doubleLimit) {
        regular = dailyLimit;
        ot15 = hoursWorked - dailyLimit;
    } else {
        regular = dailyLimit;
        ot15 = doubleLimit - dailyLimit;
        ot20 = hoursWorked - doubleLimit;
    }

    return { regular, ot15, ot20, awsExceptionApplied: !!awsSchedule };
}

function check7thDayStreak(currentDayIndex, matrix) {
    // 0 = Sunday, 1 = Monday ... 6 = Saturday. Assuming Sunday start for workweek.
    if (matrix.seventhDayPremium && currentDayIndex === 6) {
        return { isSeventhDay: true, applyDoubleTime: matrix.seventhDayDoubleTime };
    }
    return { isSeventhDay: false, applyDoubleTime: false };
}

function preventPyramiding(weeklyHours, dailyOT15, dailyOT20) {
    // FLSA rule: hours counted as daily OT cannot be counted again as weekly OT
    const totalDailyOT = dailyOT15 + dailyOT20;
    const weeklyOTCandidate = Math.max(0, weeklyHours - 40);

    // Weekly OT is only applied to hours that weren't already paid as daily OT
    const weeklyOT15 = Math.max(0, weeklyOTCandidate - totalDailyOT);
    return { weeklyOT15 };
}

module.exports = { calculateDailyOvertime, check7thDayStreak, preventPyramiding };
