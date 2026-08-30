import React, { useState } from 'react';
import CompensationCycleService from '../services/compensationCycle.service';

const ManagerRevisionWorkspace = () => {
  const [employees] = useState([
    {
      id: '1',
      name: 'Alice Smith',
      currentSalary: 80000,
      performanceRating: 'Exceeds Expectations',
      compaRatio: 0.9,
      recIncMin: 5,
      recIncMax: 10,
    },
  ]);

  const [proposals, setProposals] = useState({});

  const handlePropose = async (emp) => {
    const p = proposals[emp.id] || {};
    try {
      await CompensationCycleService.createProposal('dummyCycleId', {
        employeeId: emp.id,
        proposedSalary: p.newSalary,
        performanceRating: emp.performanceRating,
        compaRatio: emp.compaRatio,
        justification: p.justification,
      });
      alert('Proposed successfully!');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Manager Revision Workspace</h2>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Employee
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Current Salary
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Rating
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Compa Ratio
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Rec. Increase
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                New Salary
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Justification
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-4 py-2 text-sm">{emp.name}</td>
                <td className="px-4 py-2 text-sm">${emp.currentSalary}</td>
                <td className="px-4 py-2 text-sm">{emp.performanceRating}</td>
                <td className="px-4 py-2 text-sm">{emp.compaRatio}</td>
                <td className="px-4 py-2 text-sm">
                  {emp.recIncMin}% - {emp.recIncMax}%
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="border rounded p-1 text-sm w-24"
                    value={proposals[emp.id]?.newSalary || ''}
                    onChange={(e) =>
                      setProposals({
                        ...proposals,
                        [emp.id]: {
                          ...proposals[emp.id],
                          newSalary: e.target.value,
                        },
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    className="border rounded p-1 text-sm w-32"
                    placeholder="If outside matrix"
                    value={proposals[emp.id]?.justification || ''}
                    onChange={(e) =>
                      setProposals({
                        ...proposals,
                        [emp.id]: {
                          ...proposals[emp.id],
                          justification: e.target.value,
                        },
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handlePropose(emp)}
                    className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                  >
                    Submit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManagerRevisionWorkspace;
