import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { AlertTriangle, X } from 'lucide-react';

export default function ProbationExtensionModal({
  tracker,
  onClose,
  onComplete,
}) {
  const [extensionMonths, setExtensionMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const policy = tracker.policyId;
  const remainingExtensions = policy.maxExtensions - tracker.extensionCount;

  const handleExtend = async () => {
    setSubmitting(true);
    try {
      await axios.post(`/api/probation/${tracker._id}/extend`, {
        extensionMonths,
      });
      toast.success('Probation extended successfully');
      if (onComplete) onComplete();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to extend probation',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">Extend Probation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Policy Limits</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  Max allowed extensions: {policy.maxExtensions} (Used:{' '}
                  {tracker.extensionCount})
                </li>
                <li>Max total duration: {policy.maxTotalMonths} months</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extend By (Months)
            </label>
            <input
              type="number"
              min="1"
              max="12"
              className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={extensionMonths}
              onChange={(e) => setExtensionMonths(parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleExtend}
            disabled={submitting || remainingExtensions <= 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 transition"
          >
            {submitting ? 'Extending...' : 'Confirm Extension'}
          </button>
        </div>
      </div>
    </div>
  );
}
