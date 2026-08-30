import React, { useState } from 'react';

const CompetencyFrameworkEditor = () => {
  const [role, setRole] = useState('Frontend Engineer');
  const [requiredSkills, setRequiredSkills] = useState([
    { id: 1, name: 'React', minLevel: 4 },
    { id: 2, name: 'TypeScript', minLevel: 3 },
  ]);

  const [newSkill, setNewSkill] = useState('');
  const [newMinLevel, setNewMinLevel] = useState(1);

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (newSkill) {
      setRequiredSkills([
        ...requiredSkills,
        { id: Date.now(), name: newSkill, minLevel: parseInt(newMinLevel) },
      ]);
      setNewSkill('');
      setNewMinLevel(1);
    }
  };

  const handleRemoveSkill = (id) => {
    setRequiredSkills(requiredSkills.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    // API call placeholder
    alert('Framework saved successfully!');
  };

  return (
    <div className="competency-editor max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Competency Framework Editor
      </h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Job Role
        </label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full md:w-1/2 p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g. Senior Backend Engineer"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Add Required Skill
          </h3>
          <form onSubmit={handleAddSkill} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skill Name
              </label>
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Proficiency Level (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={newMinLevel}
                onChange={(e) => setNewMinLevel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="bg-gray-800 text-white font-medium py-2 px-4 rounded hover:bg-gray-900 transition"
            >
              Add to Framework
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Framework Requirements
          </h3>
          {requiredSkills.length === 0 ? (
            <p className="text-gray-500 italic">No skills required yet.</p>
          ) : (
            <ul className="space-y-3 mb-6">
              {requiredSkills.map((skill) => (
                <li
                  key={skill.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <div>
                    <span className="font-medium text-gray-800">
                      {skill.name}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">
                      Min Level: {skill.minLevel}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveSkill(skill.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Save Framework
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetencyFrameworkEditor;
