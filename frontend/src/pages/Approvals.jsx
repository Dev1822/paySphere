import React, { useState, useEffect } from "react";
import api from "../services/api";

const Approvals = () => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [isDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/payroll/approvals");
      setPending(res.data.pending);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post("/api/payroll/approve", { payrollIds: [id] });
      setPending(prev => prev.filter(p => p._id !== id));
      alert("Payroll Approved successfully");
    } catch (err) {
      alert("Failed to approve payroll");
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/payroll/reject", { payrollIds: [selectedPayroll], reason: rejectReason });
      setPending(prev => prev.filter(p => p._id !== selectedPayroll));
      setSelectedPayroll(null);
      setRejectReason("");
      alert("Payroll Rejected");
    } catch (err) {
      alert("Failed to reject payroll");
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-3xl font-serif mb-6 text-gray-900 dark:text-white">Pending Approvals</h1>
      
      {loading ? (
        <p className="text-gray-500">Loading pending payrolls...</p>
      ) : pending.length === 0 ? (
        <p className="text-gray-500">No payrolls currently pending approval.</p>
      ) : (
        <div className="grid gap-4">
          {pending.map(p => (
            <div key={p._id} className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <p className="font-semibold text-lg text-gray-900 dark:text-white">{p.employeeName} ({p.month}/{p.year})</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">Net Salary: ₹{p.netSalary.toLocaleString('en-IN')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApprove(p._id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition">Approve</button>
                <button onClick={() => setSelectedPayroll(p._id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPayroll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Reject Payroll</h3>
            <form onSubmit={handleReject}>
              <textarea 
                className="w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent mb-4 text-gray-900 dark:text-white"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedPayroll(null)} className="px-4 py-2 text-gray-500">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg">Confirm Reject</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
