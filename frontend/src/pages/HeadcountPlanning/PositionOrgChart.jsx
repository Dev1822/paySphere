import React from 'react';

const PositionOrgChart = () => {
  // Mock data representing a tree of positions
  const orgData = {
    id: 'POS-001',
    title: 'CTO',
    department: 'Engineering',
    status: 'Active',
    employeeName: 'Jane Doe',
    reports: [
      {
        id: 'POS-002',
        title: 'VP of Engineering',
        department: 'Engineering',
        status: 'Active',
        employeeName: 'John Smith',
        reports: [
          {
            id: 'POS-003',
            title: 'Engineering Manager',
            department: 'Engineering',
            status: 'Vacant',
            employeeName: null,
            reports: [],
          },
          {
            id: 'POS-004',
            title: 'Senior Software Engineer',
            department: 'Engineering',
            status: 'Active',
            employeeName: 'Alice Johnson',
            reports: [],
          },
        ],
      },
    ],
  };

  const renderNode = (node) => {
    const isVacant = node.status === 'Vacant';

    return (
      <div key={node.id} className="flex flex-col items-center">
        <div
          className={`relative p-4 w-64 rounded-xl shadow-sm border-2 text-center transition-all hover:-translate-y-1 hover:shadow-md ${isVacant ? 'bg-red-50 border-red-200 border-dashed' : 'bg-white border-blue-200'}`}
        >
          {isVacant && (
            <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
              VACANT
            </div>
          )}
          <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">
            {node.title}
          </h4>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
            {node.department}
          </p>

          <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 flex items-center justify-center">
            {isVacant ? (
              <span className="text-sm font-semibold text-red-600">
                Pending Hire
              </span>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                  {node.employeeName.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {node.employeeName}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">{node.id}</p>
        </div>

        {node.reports && node.reports.length > 0 && (
          <>
            <div className="w-px h-8 bg-gray-300"></div>
            <div
              className="relative border-t border-gray-300 flex justify-center mt-0 pt-8"
              style={{ width: `${node.reports.length * 280}px` }}
            >
              {/* Connector lines are simplified for structural representation */}
              <div className="flex space-x-8">
                {node.reports.map((report) => renderNode(report))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen overflow-x-auto">
      <h2 className="text-3xl font-bold mb-12 text-center text-gray-800">
        Position & Vacancy Chart
      </h2>
      <div className="flex justify-center min-w-[800px]">
        {renderNode(orgData)}
      </div>
    </div>
  );
};

export default PositionOrgChart;
