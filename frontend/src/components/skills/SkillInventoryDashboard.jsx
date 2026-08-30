import React, { useState, useEffect } from 'react';

// Placeholder for actual API fetching
const fetchTaxonomy = async () => {
  return [
    {
      _id: '1',
      name: 'React',
      category: 'Frontend',
      description: 'React Library',
    },
    {
      _id: '2',
      name: 'Node.js',
      category: 'Backend',
      description: 'Node.js Runtime',
    },
  ];
};

const SkillInventoryDashboard = () => {
  const [taxonomy, setTaxonomy] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaxonomy().then((data) => {
      setTaxonomy(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="skill-inventory-dashboard p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Skill Inventory Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Skill Taxonomy</h2>
          {loading ? (
            <p>Loading taxonomy...</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="border-b py-2 text-gray-600 font-medium">
                    Skill Name
                  </th>
                  <th className="border-b py-2 text-gray-600 font-medium">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {taxonomy.map((skill) => (
                  <tr key={skill._id} className="hover:bg-gray-50">
                    <td className="py-2 border-b">{skill.name}</td>
                    <td className="py-2 border-b">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {skill.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            Organization Skill Heatmap
          </h2>
          <div className="flex items-center justify-center h-64 bg-gray-100 rounded border border-dashed border-gray-300">
            <span className="text-gray-500">
              Heatmap Visualization (e.g. Chart.js / Recharts)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillInventoryDashboard;
