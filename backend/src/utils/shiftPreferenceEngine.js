/**
 * @fileoverview Shift Preference Engine — pure computation utilities
 * @description Evaluates employee preferences, auto-assigns shifts based on
 * availability and preference rankings, matches swap requests, and computes
 * scheduling metrics. No I/O — callers handle persistence.
 */

/**
 * Validate that a time slot is well-formed.
 * @param {{ startTime: string, endTime: string, dayOfWeek: number }} slot
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTimeSlot(slot) {
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(slot.startTime)) {
    return { valid: false, error: `Invalid startTime: ${slot.startTime}` };
  }
  if (!timeRegex.test(slot.endTime)) {
    return { valid: false, error: `Invalid endTime: ${slot.endTime}` };
  }
  if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
    return { valid: false, error: `Invalid dayOfWeek: ${slot.dayOfWeek}` };
  }
  if (slot.startTime >= slot.endTime) {
    return { valid: false, error: 'startTime must be before endTime' };
  }
  return { valid: true };
}

/**
 * Compute hours between two HH:MM times on the same day.
 * @param {string} startTime "HH:MM"
 * @param {string} endTime "HH:MM"
 * @returns {number} hours (decimal)
 */
function hoursBetween(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

/**
 * Check if a requested time slot overlaps with any blackout date.
 * @param {Date} shiftDate
 * @param {Array<Date>} blackoutDates
 * @returns {boolean}
 */
function isBlackoutDate(shiftDate, blackoutDates) {
  const dateStr = shiftDate.toISOString().split('T')[0];
  return blackoutDates.some((bd) => bd.toISOString().split('T')[0] === dateStr);
}

/**
 * Score a shift assignment against an employee's stated preferences.
 * Higher score = better match.
 *
 * @param {{ shiftType: string, shiftDate: Date }} assignment
 * @param {Array} preferences — from ShiftPreference.preferences
 * @returns {{ score: number, matched: boolean, priority: number|null }}
 */
function scorePreferenceMatch(assignment, preferences) {
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return { score: 0, matched: false, priority: null };
  }

  const match = preferences.find((p) => {
    const pDate =
      p.shiftDate instanceof Date ? p.shiftDate : new Date(p.shiftDate);
    return (
      p.shiftType === assignment.shiftType &&
      pDate.toISOString().split('T')[0] ===
        (assignment.shiftDate instanceof Date
          ? assignment.shiftDate
          : new Date(assignment.shiftDate)
        )
          .toISOString()
          .split('T')[0]
    );
  });

  if (!match) return { score: 0, matched: false, priority: null };

  // Score: inverse of priority (priority 1 = score 10, priority 10 = score 1)
  const score = 11 - match.priority;
  return { score, matched: true, priority: match.priority };
}

/**
 * Auto-assign shifts for a group of employees based on their preferences.
 *
 * @param {Array} employees — employees with preferences
 * @param {Array} availableShifts — [{ shiftType, shiftDate, startTime, endTime, capacity }]
 * @param {Map<string, Array>} employeePreferences — Map<employeeId, preferences[]>
 * @returns {{ assignments: Array, unassigned: Array, conflicts: Array }}
 */
function autoAssignShifts(employees, availableShifts, employeePreferences) {
  const assignments = [];
  const unassigned = [];
  const conflicts = [];
  const shiftCapacity = new Map();

  // Initialize capacity tracking
  for (const shift of availableShifts) {
    const key = `${shift.shiftType}:${shift.shiftDate.toISOString().split('T')[0]}`;
    shiftCapacity.set(key, { ...shift, filled: 0 });
  }

  // Sort employees by preference strength (more preferences = higher priority)
  const sortedEmployees = [...employees].sort((a, b) => {
    const prefsA = employeePreferences.get(String(a._id)) || [];
    const prefsB = employeePreferences.get(String(b._id)) || [];
    return prefsB.length - prefsA.length;
  });

  for (const emp of sortedEmployees) {
    const prefs = employeePreferences.get(String(emp._id)) || [];
    const blackout = emp.blackoutDates || [];

    // Try to assign preferred shifts first
    const sortedPrefs = [...prefs].sort((a, b) => a.priority - b.priority);
    let assigned = false;

    for (const pref of sortedPrefs) {
      const dateStr =
        pref.shiftDate instanceof Date
          ? pref.shiftDate.toISOString().split('T')[0]
          : new Date(pref.shiftDate).toISOString().split('T')[0];

      const key = `${pref.shiftType}:${dateStr}`;
      const slot = shiftCapacity.get(key);

      if (!slot) continue;
      if (isBlackoutDate(pref.shiftDate, blackout)) continue;
      if (slot.filled >= slot.capacity) {
        conflicts.push({
          employeeId: emp._id,
          shiftType: pref.shiftType,
          shiftDate: pref.shiftDate,
          reason: 'Shift at full capacity',
        });
        continue;
      }

      slot.filled += 1;
      assignments.push({
        employeeId: emp._id,
        shiftType: pref.shiftType,
        shiftDate: pref.shiftDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        autoAssigned: true,
        preferenceMatch: true,
        preferencePriority: pref.priority,
      });
      assigned = true;
      break;
    }

    if (!assigned) {
      // Try any available shift
      for (const [key, slot] of shiftCapacity) {
        if (slot.filled >= slot.capacity) continue;

        const shiftDate = new Date(slot.shiftDate || key.split(':')[1]);
        if (isBlackoutDate(shiftDate, blackout)) continue;

        slot.filled += 1;
        assignments.push({
          employeeId: emp._id,
          shiftType: slot.shiftType,
          shiftDate: shiftDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          autoAssigned: true,
          preferenceMatch: false,
          preferencePriority: null,
        });
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      unassigned.push({
        employeeId: emp._id,
        reason: 'No available shifts match preferences or availability',
      });
    }
  }

  return { assignments, unassigned, conflicts };
}

/**
 * Find matching partners for a shift swap request.
 *
 * @param {object} swapRequest — { requesterId, originalShift, desiredShift }
 * @param {Array} otherEmployees — employees with assignments
 * @param {Array} theirPreferences — preferences of other employees
 * @returns {Array<{ employeeId, score, reason }>}
 */
function findSwapMatches(swapRequest, otherEmployees, theirPreferences) {
  const matches = [];

  for (const emp of otherEmployees) {
    if (String(emp._id) === String(swapRequest.requesterId)) continue;

    const prefs = theirPreferences.filter(
      (p) => String(p.employeeId) === String(emp._id),
    );

    // Check if this employee has a preference for the requester's original shift
    const hasMatchingPref = prefs.some((p) => {
      const pDate = new Date(p.shiftDate);
      const origDate = new Date(swapRequest.originalShift.shiftDate);
      return (
        p.shiftType === swapRequest.originalShift.shiftType &&
        pDate.toISOString().split('T')[0] ===
          origDate.toISOString().split('T')[0]
      );
    });

    if (hasMatchingPref) {
      matches.push({
        employeeId: emp._id,
        employeeName: emp.fullName || 'Unknown',
        score: 10,
        reason: 'Has a matching preference for this shift',
      });
      continue;
    }

    // Check if this employee doesn't have a conflicting assignment
    const hasConflict = false; // Simplified — real check would query assignments
    if (!hasConflict) {
      matches.push({
        employeeId: emp._id,
        employeeName: emp.fullName || 'Unknown',
        score: 3,
        reason: 'Available but no specific preference',
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Compute scheduling metrics for a set of assignments.
 *
 * @param {Array} assignments
 * @param {Array} preferences
 * @returns {object}
 */
function computeScheduleMetrics(assignments, preferences) {
  const total = assignments.length;
  const preferenceMatches = assignments.filter((a) => a.preferenceMatch).length;
  const autoAssigned = assignments.filter((a) => a.autoAssigned).length;

  // Group by shift type
  const byShiftType = {};
  for (const a of assignments) {
    if (!byShiftType[a.shiftType]) byShiftType[a.shiftType] = 0;
    byShiftType[a.shiftType] += 1;
  }

  // Coverage by day
  const byDate = {};
  for (const a of assignments) {
    const dateStr = new Date(a.shiftDate).toISOString().split('T')[0];
    if (!byDate[dateStr]) byDate[dateStr] = 0;
    byDate[dateStr] += 1;
  }

  return {
    totalAssignments: total,
    preferenceMatchRate:
      total > 0 ? Math.round((preferenceMatches / total) * 100) : 0,
    autoAssignmentRate:
      total > 0 ? Math.round((autoAssigned / total) * 100) : 0,
    byShiftType,
    byDate,
  };
}

module.exports = {
  validateTimeSlot,
  hoursBetween,
  isBlackoutDate,
  scorePreferenceMatch,
  autoAssignShifts,
  findSwapMatches,
  computeScheduleMetrics,
};
