import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import Sidebar from '../components/Sidebar';
import SettingsIcon from '@mui/icons-material/Settings';

export default function CustomFieldsManager() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entityType, setEntityType] = useState('Employee');

  const [showModal, setShowModal] = useState(false);
  const [currentField, setCurrentField] = useState({
    fieldKey: '',
    label: '',
    fieldType: 'text',
    options: [],
    validationRules: { required: false },
  });

  const fetchFields = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/custom-fields?entityType=${entityType}`);
      setFields(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load custom fields.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [entityType]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...currentField, entityType };
      if (currentField._id) {
        await api.put(`/custom-fields/${currentField._id}`, payload);
      } else {
        await api.post('/custom-fields', payload);
      }
      setShowModal(false);
      fetchFields();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving custom field');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this field?')) return;
    try {
      await api.delete(`/custom-fields/${id}`);
      fetchFields();
    } catch (err) {
      alert('Failed to delete field');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Helmet>
        <title>Custom Fields - PaySphere</title>
      </Helmet>

      <Sidebar activePage="Settings" />

      <main className="flex-1 overflow-y-auto w-full md:w-[calc(100%-16rem)] ml-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-xl">
              <SettingsIcon />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Custom Fields Manager
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure dynamic data fields for your workspace.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex gap-4 mb-4">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="px-4 py-2 border rounded dark:bg-slate-800 dark:text-white"
            >
              <option value="Employee">Employee</option>
              <option value="Payroll">Payroll</option>
              <option value="Expense">Expense</option>
            </select>
            <button
              onClick={() => {
                setCurrentField({
                  fieldKey: '',
                  label: '',
                  fieldType: 'text',
                  options: [],
                  validationRules: { required: false },
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add New Field
            </button>
          </div>

          {loading ? (
            <p className="text-slate-500">Loading fields...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Label
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Required
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {fields.map((field) => (
                    <tr key={field._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {field.label}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {field.fieldKey}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {field.fieldType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {field.validationRules?.required ? 'Yes' : 'No'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 cursor-pointer">
                        <button
                          onClick={() => {
                            setCurrentField(field);
                            setShowModal(true);
                          }}
                          className="mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(field._id)}
                          className="text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {fields.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        No custom fields defined for {entityType}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {currentField._id ? 'Edit Field' : 'New Field'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Label
                </label>
                <input
                  type="text"
                  value={currentField.label}
                  onChange={(e) =>
                    setCurrentField({ ...currentField, label: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Field Key (alphanumeric_)
                </label>
                <input
                  type="text"
                  value={currentField.fieldKey}
                  disabled={!!currentField._id}
                  onChange={(e) =>
                    setCurrentField({
                      ...currentField,
                      fieldKey: e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <select
                  value={currentField.fieldType}
                  onChange={(e) =>
                    setCurrentField({
                      ...currentField,
                      fieldType: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown</option>
                </select>
              </div>

              {currentField.fieldType === 'dropdown' && (
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    Options (comma separated)
                  </label>
                  <input
                    type="text"
                    value={currentField.options?.join(', ')}
                    onChange={(e) =>
                      setCurrentField({
                        ...currentField,
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentField.validationRules?.required || false}
                  onChange={(e) =>
                    setCurrentField({
                      ...currentField,
                      validationRules: {
                        ...currentField.validationRules,
                        required: e.target.checked,
                      },
                    })
                  }
                  id="req-checkbox"
                />
                <label
                  htmlFor="req-checkbox"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Required Field
                </label>
              </div>

              <div className="flex gap-4 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded dark:border-slate-600 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
