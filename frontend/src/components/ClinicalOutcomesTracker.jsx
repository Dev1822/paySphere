import React, { useState, useEffect } from 'react';

export default function ClinicalOutcomesTracker() {
  const [bonuses, setBonuses] = useState([]);

  useEffect(() => {
    // Mock data for the employee's accumulated clinical bonuses
    setBonuses([
      {
        id: '101',
        ruleName: 'STEMI Cath Lab < 90 mins',
        amount: 833.33,
        currency: 'USD',
        dateEarned: new Date().toISOString(),
        shiftId: 'SHIFT-8472',
      },
      {
        id: '102',
        ruleName: 'Sepsis Bundle < 3 hrs',
        amount: 500.0,
        currency: 'USD',
        dateEarned: new Date(Date.now() - 86400000 * 2).toISOString(),
        shiftId: 'SHIFT-8410',
      },
    ]);
  }, []);

  const totalBonus = bonuses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Clinical Outcomes Tracker
        </h3>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
          Current Period
        </span>
      </div>

      <div className="mb-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800/30">
        <p className="text-sm text-green-800 dark:text-green-300 font-medium mb-1">
          Total Quality-of-Care Bonus
        </p>
        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
          $
          {totalBonus.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
          Recent Payouts
        </h4>
        <div className="space-y-3">
          {bonuses.length > 0 ? (
            bonuses.map((bonus) => (
              <div
                key={bonus.id}
                className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {bonus.ruleName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Shift: {bonus.shiftId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">
                    +${bonus.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(bonus.dateEarned).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No bonuses earned yet this period.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
