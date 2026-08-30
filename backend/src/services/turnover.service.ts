/**
 * @fileoverview Turnover Service (TypeScript Migration)
 * @description Aggregates employee turnover metrics and departure reasons.
 * Issue: #1406
 */

import mongoose = require('mongoose');

const Employee = require('../models/employee.model');

export type ExitType =
  | 'resignation'
  | 'termination'
  | 'retirement'
  | 'end_of_contract'
  | 'other';

export interface DeparturesByReason {
  resignation: number;
  termination: number;
  retirement: number;
  end_of_contract: number;
  other: number;
  voluntary: number;
  involuntary: number;
}

export interface TurnoverMetrics {
  departuresByReason: DeparturesByReason;
}

interface DepartureAggregationResult {
  _id: ExitType | null;
  count: number;
}

/**
 * Aggregates turnover metrics and departure reasons by month for a given user.
 * Categorizes departures into voluntary (resignation/retirement) vs involuntary
 * (termination/end_of_contract/other).
 *
 * @param userId
 * @param monthsBack - Number of past months to aggregate (currently unused by the
 *                      aggregation itself, kept for API-compatibility with callers)
 */
export async function getTurnoverMetrics(
  userId: string | mongoose.Types.ObjectId,
  monthsBack?: number,
): Promise<TurnoverMetrics> {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const departureAggregation: DepartureAggregationResult[] = await Employee.aggregate([
    {
      $match: {
        createdBy: userObjectId,
        $or: [
          { deletedAt: { $ne: null } },
          { employmentStatus: 'exited' },
          { 'exitDetails.exitType': { $exists: true, $ne: null } },
        ],
      },
    },
    {
      $project: {
        exitType: {
          $ifNull: ['$exitDetails.exitType', 'resignation'],
        },
        exitReason: '$exitDetails.reason',
      },
    },
    {
      $group: {
        _id: '$exitType',
        count: { $sum: 1 },
      },
    },
  ]);

  const departuresByReason: DeparturesByReason = {
    resignation: 0,
    termination: 0,
    retirement: 0,
    end_of_contract: 0,
    other: 0,
    voluntary: 0,
    involuntary: 0,
  };

  departureAggregation.forEach((item) => {
    const reason = (item._id || 'other') as keyof DeparturesByReason;
    const count = item.count || 0;

    if (Object.prototype.hasOwnProperty.call(departuresByReason, reason)) {
      departuresByReason[reason] = count;
    } else {
      departuresByReason.other += count;
    }

    if (reason === 'resignation' || reason === 'retirement') {
      departuresByReason.voluntary += count;
    } else {
      departuresByReason.involuntary += count;
    }
  });

  return { departuresByReason };
}

module.exports = { getTurnoverMetrics };