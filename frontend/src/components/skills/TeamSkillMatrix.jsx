import React, { useState } from 'react';

const TeamSkillMatrix = () => {
  const [teamMatrix, setTeamMatrix] = useState([
    {
      employee: { id: 1, name: 'Alice Smith', role: 'Frontend Engineer' },
      skills: [
        {
          id: 101,
          skill: { name: 'React', category: 'Frontend' },
          level: 4,
          status: 'approved',
        },
        {
          id: 102,
          skill: { name: 'TypeScript', category: 'Frontend' },
          level: 3,
          status: 'pending_endorsement',
        },
      ],
    },
    {
      employee: { id: 2, name: 'Bob Jones', role: 'Backend Engineer' },
      skills: [
        {
          id: 103,
          skill: { name: 'Node.js', category: 'Backend' },
          level: 5,
          status: 'approved',
        },
      ],
    },
  ]);

  const handleEndorse = (employeeId, skillId) => {
    setTeamMatrix((prev) =>
      prev.map((member) => {
        if (member.employee.id === employeeId) {
          return {
            ...member,
            skills: member.skills.map((s) =>
              s.id === skillId ? { ...s, status: 'approved' } : s,
            ),
          };
        }
        return member;
      }),
    );
  };

  return (
    <div className="team-skill-matrix max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Team Skill Matrix
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Employee
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Skills
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teamMatrix.map((member) => (
              <tr key={member.employee.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {member.employee.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.employee.role}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex flex-wrap gap-2">
                    {member.skills.map((s) => (
                      <span
                        key={s.id}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}
                      >
                        {s.skill.name} (L{s.level})
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.skills.filter(
                    (s) => s.status === 'pending_endorsement',
                  ).length > 0 && (
                    <button
                      onClick={() => {
                        const pendingSkill = member.skills.find(
                          (s) => s.status === 'pending_endorsement',
                        );
                        if (pendingSkill)
                          handleEndorse(member.employee.id, pendingSkill.id);
                      }}
                      className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                    >
                      Review Pending
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamSkillMatrix;
