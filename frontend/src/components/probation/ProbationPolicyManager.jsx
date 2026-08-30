import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Settings } from 'lucide-react';

export default function ProbationPolicyManager() {
  const [policies, setPolicies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    durationMonths: 3,
    maxExtensions: 1,
    maxTotalMonths: 6,
    salaryStepUpType: 'none',
    salaryStepUpValue: 0,
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const { data } = await axios.get('/api/probation/policies');
      setPolicies(data.policies);
    } catch (error) {
      toast.error('Failed to load policies');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/probation/policies', formData);
      toast.success('Policy created');
      setShowForm(false);
      fetchPolicies();
    } catch (error) {
      toast.error('Failed to create policy');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Probation Policies
          </h2>
          <p className="text-gray-500">
            Manage duration rules and salary steps
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Policy
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Name
              </label>
              <input
                type="text"
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (Months)
              </label>
              <input
                type="number"
                required
                min="1"
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                value={formData.durationMonths}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    durationMonths: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Extensions Allowed
              </label>
              <input
                type="number"
                required
                min="0"
                className="w-full border rounded-lg p-2"
                value={formData.maxExtensions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxExtensions: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Total Duration (Months)
              </label>
              <input
                type="number"
                required
                min="1"
                className="w-full border rounded-lg p-2"
                value={formData.maxTotalMonths}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxTotalMonths: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary Step-Up Type
              </label>
              <select
                className="w-full border rounded-lg p-2"
                value={formData.salaryStepUpType}
                onChange={(e) =>
                  setFormData({ ...formData, salaryStepUpType: e.target.value })
                }
              >
                <option value="none">None</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>
            {formData.salaryStepUpType !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step-Up Value
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full border rounded-lg p-2"
                  value={formData.salaryStepUpValue}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salaryStepUpValue: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg"
            >
              Save Policy
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((p) => (
          <div
            key={p._id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>
                Base Duration: <strong>{p.durationMonths} months</strong>
              </p>
              <p>
                Max Extensions: <strong>{p.maxExtensions}</strong> (Limit:{' '}
                {p.maxTotalMonths}m)
              </p>
              <p>
                Salary Step-Up:{' '}
                <strong>
                  {p.salaryStepUpType === 'none'
                    ? 'None'
                    : `${p.salaryStepUpValue}${p.salaryStepUpType === 'percentage' ? '%' : ' flat'}`}
                </strong>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
