import React, { useState } from 'react';

const MeritMatrixBuilder = () => {
  const [matrixEntries, setMatrixEntries] = useState([
    {
      rating: 'Exceeds Expectations',
      minRatio: 0.8,
      maxRatio: 1.0,
      minInc: 5,
      maxInc: 10,
    },
    {
      rating: 'Meets Expectations',
      minRatio: 0.8,
      maxRatio: 1.0,
      minInc: 2,
      maxInc: 5,
    },
  ]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Merit Matrix Builder</h2>
      <div className="bg-white p-4 rounded shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                Performance Rating
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                Compa-Ratio Min
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                Compa-Ratio Max
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                Rec. Increase Min (%)
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">
                Rec. Increase Max (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {matrixEntries.map((entry, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-4 py-2 text-sm">{entry.rating}</td>
                <td className="px-4 py-2 text-sm">{entry.minRatio}</td>
                <td className="px-4 py-2 text-sm">{entry.maxRatio}</td>
                <td className="px-4 py-2 text-sm">{entry.minInc}</td>
                <td className="px-4 py-2 text-sm">{entry.maxInc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Entry
        </button>
      </div>
    </div>
  );
};

export default MeritMatrixBuilder;
