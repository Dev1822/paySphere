import React, { useState, useEffect } from 'react';

const HeadcountPlanningDashboard = () => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    // In a real scenario, this would be an API call to /api/headcount-planning/analytics
    setMetrics({
      totalPlannedHeadcount: 100,
      totalUtilizedHeadcount: 85,
      totalBudgetLimit: 5000000,
      totalUtilizedBudget: 4200000,
      totalBudgetUtilizationPercent: '84.00',
      departments: [
        {
          department: 'Engineering',
          plannedHeadcount: 50,
          utilizedHeadcount: 45,
          budgetLimit: 3000000,
          utilizedBudget: 2700000,
          budgetUtilizationPercent: '90.00',
        },
        {
          department: 'Sales',
          plannedHeadcount: 50,
          utilizedHeadcount: 40,
          budgetLimit: 2000000,
          utilizedBudget: 1500000,
          budgetUtilizationPercent: '75.00',
        },
      ],
    });
  }, []);

  if (!metrics) return <div>Loading metrics...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Headcount Planning Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Planned Headcount
          </h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            {metrics.totalPlannedHeadcount}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Utilized Headcount
          </h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            {metrics.totalUtilizedHeadcount}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Total Budget Limit
          </h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            ${metrics.totalBudgetLimit.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Utilized Budget
          </h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            ${metrics.totalUtilizedBudget.toLocaleString()} (
            {metrics.totalBudgetUtilizationPercent}%)
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Department Breakdown
      </h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Planned HC
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Utilized HC
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Budget Limit
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Utilized Budget
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Utilization %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.departments.map((dept, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-800">
                  {dept.department}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {dept.plannedHeadcount}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {dept.utilizedHeadcount}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  ${dept.budgetLimit.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  ${dept.utilizedBudget.toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">
                      {dept.budgetUtilizationPercent}%
                    </span>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${Number(dept.budgetUtilizationPercent) > 90 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${dept.budgetUtilizationPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HeadcountPlanningDashboard;
