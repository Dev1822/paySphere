import React from 'react';

const RequisitionApprovalWorkflow = () => {
  // Mock data for requisitions pending approval
  const requisitions = [
    {
      id: 'REQ-001',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      count: 2,
      ctcBudget: 150000,
      status: 'HR_Approval',
    },
    {
      id: 'REQ-002',
      title: 'Marketing Manager',
      department: 'Sales',
      count: 1,
      ctcBudget: 120000,
      status: 'Finance_Approval',
    },
  ];

  const handleApprove = (id, level) => {
    alert(`Approved ${id} at level ${level}`);
  };

  const handleReject = (id) => {
    alert(`Rejected ${id}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">
        Pending Approvals
      </h2>
      <div className="space-y-6">
        {requisitions.map((req) => (
          <div
            key={req.id}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex justify-between items-center transition hover:shadow-lg"
          >
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900">
                  {req.title}{' '}
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {req.id}
                  </span>
                </h3>
              </div>
              <p className="text-gray-600 mb-1">
                <strong>Department:</strong> {req.department}
              </p>
              <p className="text-gray-600 mb-1">
                <strong>Requested:</strong> {req.count} headcount @ $
                {req.ctcBudget.toLocaleString()}/each
              </p>
              <p className="text-sm font-medium text-orange-600 mt-2 flex items-center">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                Current Stage: {req.status}
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => handleApprove(req.id, req.status.split('_')[0])}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow transition"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(req.id)}
                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-semibold py-2 px-6 rounded-lg transition"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RequisitionApprovalWorkflow;
