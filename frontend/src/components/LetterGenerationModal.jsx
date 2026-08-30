import { useState, useEffect } from 'react';
import api from '../services/api';

export default function LetterGenerationModal({
  open,
  onClose,
  selectedEmployees,
}) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [metaVariables, setMetaVariables] = useState({
    effectiveDate: '',
    signingBonus: '',
  });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (open) {
      api
        .get('/api/templates')
        .then((res) => {
          setTemplates(res.data);
          if (res.data.length > 0) setSelectedTemplate(res.data[0]._id);
        })
        .catch((err) => console.error(err));
      setSummary(null);
    }
  }, [open]);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!selectedTemplate) return alert('Select a template');
    setLoading(true);
    setSummary(null);

    try {
      if (selectedEmployees.length === 1) {
        await api.post('/api/templates/generate', {
          employeeId: selectedEmployees[0],
          templateId: selectedTemplate,
          metaVariables,
        });
        setSummary({ success: 1, failed: 0 });
      } else {
        const res = await api.post('/api/templates/bulk-generate', {
          employeeIds: selectedEmployees,
          templateId: selectedTemplate,
          metaVariables,
        });
        setSummary(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-bold mb-4 dark:text-white">
          Generate Letter
        </h2>

        {summary ? (
          <div className="text-center">
            <div className="mb-4">
              <span className="text-green-600 font-bold block text-xl">
                Success: {summary.success}
              </span>
              {summary.failed > 0 && (
                <span className="text-red-600 font-bold block">
                  Failed: {summary.failed}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1 dark:text-white">
                Selected Employees: {selectedEmployees.length}
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1 dark:text-white">
                Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full p-2 border rounded dark:bg-slate-900 dark:text-white dark:border-slate-700"
              >
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1 dark:text-white">
                Effective Date
              </label>
              <input
                type="date"
                value={metaVariables.effectiveDate}
                onChange={(e) =>
                  setMetaVariables({
                    ...metaVariables,
                    effectiveDate: e.target.value,
                  })
                }
                className="w-full p-2 border rounded dark:bg-slate-900 dark:text-white dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1 dark:text-white">
                Signing Bonus
              </label>
              <input
                type="number"
                placeholder="Amount (optional)"
                value={metaVariables.signingBonus}
                onChange={(e) =>
                  setMetaVariables({
                    ...metaVariables,
                    signingBonus: e.target.value,
                  })
                }
                className="w-full p-2 border rounded dark:bg-slate-900 dark:text-white dark:border-slate-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 bg-brand-600 text-white rounded font-bold hover:bg-brand-700"
              >
                {loading
                  ? 'Generating...'
                  : `Generate ${selectedEmployees.length > 1 ? 'Bulk' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
