import React, { useState } from 'react';

const SkillSearchPanel = () => {
  const [queries, setQueries] = useState([{ id: 1, skill: '', minLevel: 1 }]);
  const [results, setResults] = useState([]);

  const addQuery = () => {
    setQueries([...queries, { id: Date.now(), skill: '', minLevel: 1 }]);
  };

  const removeQuery = (id) => {
    setQueries(queries.filter((q) => q.id !== id));
  };

  const updateQuery = (id, field, value) => {
    setQueries(
      queries.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
  };

  const handleSearch = () => {
    // API call placeholder
    setResults([
      {
        id: 101,
        name: 'Alice Smith',
        role: 'Frontend Engineer',
        department: 'Engineering',
      },
    ]);
  };

  return (
    <div className="skill-search-panel max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Skill Search</h2>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Query Builder
        </h3>

        <div className="space-y-4">
          {queries.map((q, index) => (
            <div key={q.id} className="flex items-end gap-4">
              {index > 0 && (
                <span className="font-bold text-gray-500 mb-2">AND</span>
              )}
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Skill
                </label>
                <input
                  type="text"
                  value={q.skill}
                  onChange={(e) => updateQuery(q.id, 'skill', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. React"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-gray-500 mb-1">
                  Min Level
                </label>
                <select
                  value={q.minLevel}
                  onChange={(e) =>
                    updateQuery(q.id, 'minLevel', parseInt(e.target.value))
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>1 - Beginner</option>
                  <option value={2}>2 - Novice</option>
                  <option value={3}>3 - Intermediate</option>
                  <option value={4}>4 - Advanced</option>
                  <option value={5}>5 - Expert</option>
                </select>
              </div>
              {queries.length > 1 && (
                <button
                  onClick={() => removeQuery(q.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4">
          <button
            onClick={addQuery}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition text-sm font-medium"
          >
            + Add Condition
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
          >
            Search Employees
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Results ({results.length})
        </h3>
        {results.length === 0 ? (
          <p className="text-gray-500 italic">
            No employees match the criteria.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((emp) => (
              <div
                key={emp.id}
                className="border border-gray-200 rounded p-4 hover:shadow-md transition"
              >
                <h4 className="font-bold text-gray-800">{emp.name}</h4>
                <p className="text-sm text-gray-600">{emp.role}</p>
                <p className="text-xs text-gray-500 mt-1">{emp.department}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillSearchPanel;
