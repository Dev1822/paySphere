

export default function PayrollTable({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Employee Payroll Details
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-slate-800">
            <tr>
              <th className="px-5 py-3 text-left">Employee</th>
              <th className="px-5 py-3 text-left">Department</th>
              <th className="px-5 py-3 text-left">Salary</th>
              <th className="px-5 py-3 text-left">Bonus</th>
              <th className="px-5 py-3 text-left">Overtime</th>
              <th className="px-5 py-3 text-left">Deduction</th>
              <th className="px-5 py-3 text-left">Net Salary</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {data.map((employee) => (
              <tr
                key={employee.id}
                className="border-t border-gray-200 dark:border-slate-800"
              >
                <td className="px-5 py-4">{employee.name}</td>
                <td className="px-5 py-4">{employee.department}</td>
                <td className="px-5 py-4">{employee.salary}</td>
                <td className="px-5 py-4">{employee.bonus}</td>
                <td className="px-5 py-4">{employee.overtime}</td>
                <td className="px-5 py-4">{employee.deduction}</td>
                <td className="px-5 py-4 font-semibold">
                  {employee.net}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      employee.status === "Paid"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                    }`}
                  >
                    {employee.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}