import React, { useState } from 'react';

const EmployeeSkillProfile = ({ employeeId }) => {
  const [skills, setSkills] = useState([
    { id: 1, name: 'React', level: 4, status: 'approved' },
    { id: 2, name: 'TypeScript', level: 3, status: 'pending_endorsement' },
  ]);
  const [newSkill, setNewSkill] = useState('');
  const [newLevel, setNewLevel] = useState(1);

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (newSkill) {
      setSkills([
        ...skills,
        {
          id: Date.now(),
          name: newSkill,
          level: parseInt(newLevel),
          status: 'pending_endorsement',
        },
      ]);
      setNewSkill('');
      setNewLevel(1);
    }
  };

  return (
    <div className="employee-skill-profile max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        My Skill Profile
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Add New Skill Assessment
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
                placeholder="e.g. Node.js"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proficiency Level (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Certification (Optional)
              </label>
              <input
                type="file"
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Assess Skill
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Current Skills
          </h3>
          <ul className="space-y-3">
            {skills.map((skill) => (
              <li
                key={skill.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100"
              >
                <div>
                  <span className="font-medium text-gray-800">
                    {skill.name}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    Level {skill.level}
                  </span>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${skill.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                >
                  {skill.status === 'approved' ? 'Approved' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">
              Skill Radar
            </h3>
            <div className="flex items-center justify-center h-48 bg-gray-100 rounded border border-dashed border-gray-300">
              <span className="text-gray-500">Radar Chart (e.g. Recharts)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSkillProfile;
