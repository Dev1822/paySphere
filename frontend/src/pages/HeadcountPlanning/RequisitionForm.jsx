import React, { useState } from 'react';

const RequisitionForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    department: 'Engineering',
    type: 'New',
    requestedCount: 1,
    ctcBudget: 0,
    replacedEmployeeId: '',
  });
  const [preview, setPreview] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Simulate real-time budget preview
    if (name === 'ctcBudget' || name === 'requestedCount') {
      const budget = name === 'ctcBudget' ? Number(value) : formData.ctcBudget;
      const count =
        name === 'requestedCount' ? Number(value) : formData.requestedCount;
      setPreview({
        totalImpact: count * budget,
        remainingBudget: 3000000 - count * budget, // Mock remaining budget
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Requisition submitted for approval!');
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-xl rounded-xl mt-10">
      <h2 className="text-3xl font-bold mb-8 text-gray-800 border-b pb-4">
        New Headcount Requisition
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Job Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Department
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option>Engineering</option>
              <option>Sales</option>
              <option>Marketing</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Request Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="New">New Headcount</option>
              <option value="Backfill">Backfill</option>
            </select>
          </div>
          {formData.type === 'Backfill' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Replaced Employee ID
              </label>
              <input
                type="text"
                name="replacedEmployeeId"
                value={formData.replacedEmployeeId}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                required
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Requested Count
            </label>
            <input
              type="number"
              name="requestedCount"
              min="1"
              value={formData.requestedCount}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Target CTC Budget (Per Head)
            </label>
            <input
              type="number"
              name="ctcBudget"
              min="0"
              value={formData.ctcBudget}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
            />
          </div>
        </div>

        {preview && (
          <div className="mt-8 bg-blue-50 p-6 rounded-lg border border-blue-100 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-blue-900">
                Budget Impact Preview
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                Estimated cost vs department allocation
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-600 font-medium">
                Total Cost:{' '}
                <span className="font-bold text-red-600">
                  ${preview.totalImpact.toLocaleString()}
                </span>
              </p>
              <p className="text-gray-600 font-medium mt-1">
                Est. Remaining:{' '}
                <span
                  className={`font-bold ${preview.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  ${preview.remainingBudget.toLocaleString()}
                </span>
              </p>
            </div>
          </div>
        )}

        <div className="pt-6">
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors"
          >
            Submit Requisition
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequisitionForm;
