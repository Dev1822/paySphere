import React, { useState, useEffect } from 'react';

export default function ClinicalIncentiveDashboard() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Example data instead of fetching for now
  useEffect(() => {
    setRules([
      {
        _id: '1',
        name: 'STEMI Cath Lab < 90 mins',
        metricSource: 'cardiologyStemi',
        condition: { field: 'doorToBalloonTime', operator: '<=', value: 90 },
        bonusPoolAmount: 5000,
        currency: 'USD',
        isActive: true,
      },
    ]);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Value-Based Care Incentives
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage clinical outcome incentive rules
          </p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          Create New Rule
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-4">Rule Name</th>
              <th className="p-4">Metric Source</th>
              <th className="p-4">Condition Threshold</th>
              <th className="p-4">Bonus Pool</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rules.map((rule) => (
              <tr
                key={rule._id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="p-4 font-medium text-gray-900 dark:text-white">
                  {rule.name}
                </td>
                <td className="p-4 text-gray-600 dark:text-gray-300">
                  {rule.metricSource}
                </td>
                <td className="p-4 text-gray-600 dark:text-gray-300">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">
                    {rule.condition.field} {rule.condition.operator}{' '}
                    {rule.condition.value}
                  </span>
                </td>
                <td className="p-4 font-medium text-green-600 dark:text-green-400">
                  {rule.bonusPoolAmount.toLocaleString()} {rule.currency}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rule.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No active incentive rules found.
          </div>
        )}
      </div>
    </div>
  );
}
