import React, { useState } from 'react';
import CompensationCycleService from '../services/compensationCycle.service';

const RevisionApprovalQueue = () => {
  const [proposals] = useState([
    {
      id: 'p1',
      employeeName: 'Bob Builder',
      currentSalary: 70000,
      proposedSalary: 75000,
      incPct: 7.1,
      rating: 'Meets Expectations',
      status: 'Manager_Approved',
      version: 1,
    },
  ]);

  const handleApprove = async (proposalId, version) => {
    try {
      await CompensationCycleService.approveProposal(
        proposalId,
        version,
        'Finance_Approved',
        'Looks good',
      );
      alert('Approved successfully!');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleReject = async (proposalId, version) => {
    try {
      await CompensationCycleService.approveProposal(
        proposalId,
        version,
        'Rejected',
        'Exceeds budget',
      );
      alert('Rejected successfully!');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Revision Approval Queue</h2>
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
                Proposed Salary
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Increase %
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Rating
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {proposals.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-sm">{p.employeeName}</td>
                <td className="px-4 py-2 text-sm">${p.currentSalary}</td>
                <td className="px-4 py-2 text-sm">${p.proposedSalary}</td>
                <td className="px-4 py-2 text-sm">{p.incPct}%</td>
                <td className="px-4 py-2 text-sm">{p.rating}</td>
                <td className="px-4 py-2 text-sm">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm font-medium">
                  <button
                    onClick={() => handleApprove(p.id, p.version)}
                    className="text-green-600 hover:text-green-900 mr-4"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(p.id, p.version)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Reject
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

export default RevisionApprovalQueue;
