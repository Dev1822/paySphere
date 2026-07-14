import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import { EmployeeBreakdownSkeleton, EmployeeCardSkeleton, StatCardSkeleton } from "../components/common/Skeleton";
import api from "../services/api";


// --- Dashboard Component ---
const DashboardOverview = ({ search, setSearch, filtered, getInitials, onAddUpdate, onAddEmployee, totalPayout, employeeCount, loading, payrolls }) => {
  // Build a map from employeeId to payroll data
  const payrollMap = {};
  (payrolls || []).forEach(p => { payrollMap[p.employeeId] = p; });

  const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN");

  return (
    <main className="p-4 sm:p-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-400">Monthly Overview</p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900">April 2026</h1>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold hover:shadow">
            Reports
          </button>

          <button 
            onClick={onAddUpdate}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold"
          >
            Run Payroll
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        {loading ? (
          <>
            <StatCardSkeleton />
            <div className="w-full sm:w-64">
              <StatCardSkeleton />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs uppercase text-gray-400 font-bold mb-2">
                Total Monthly Payout
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold">₹{totalPayout.toLocaleString("en-IN")}</h2>
              <p className="text-gray-400 text-sm mt-2">{employeeCount} employees on payroll</p>
            </div>

            <div className="w-full sm:w-64 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs uppercase text-gray-400 font-bold mb-2">
                Employees
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold">{employeeCount}</h2>
              <p className="text-gray-400 text-sm">Active this month</p>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-bold">Employee Directory</h2>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees..."
          className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 outline-none"
        />
      </div>

      {/* Grid */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 min-w-[280px]">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <EmployeeCardSkeleton key={i} />
            ))
          ) : filtered.length === 0 && !search ? (
            <EmptyState
              title="No employees yet"
              description="Add your first employee to get started with payroll."
              action={
                <button
                  onClick={onAddEmployee}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
                >
                  + Add Employee
                </button>
              }
            />
          ) : filtered.length === 0 && search ? (
            <EmptyState
              title="No employees found"
              description={`No employees match "${search}". Try a different name or role.`}
            />
          ) : (
            filtered.map((emp) => {
              const p = payrollMap[emp._id];
              return (
                <div key={emp._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: AVATAR_COLORS[emp.fullName.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length] }}
                      >
                        {getInitials(emp.fullName)}
                      </div>

                      <div>
                        <p className="font-bold text-sm">{emp.fullName}</p>
                        <p className="text-xs text-gray-400">{emp.role || "Employee"}</p>
                      </div>
                    </div>

                    <span className={`text-xs font-bold px-2 py-1 rounded-md border ${p ? "bg-green-50 text-green-600 border-green-200" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
                      {p ? "Finalized" : "Pending"}
                    </span>
                  </div>

                  {/* Salary */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-baseline">
                      <p className="text-xs text-gray-400 uppercase">
                        {p ? "Net Salary" : "Base Salary"}
                      </p>
                      {p && (p.leaveDays > 0 || p.overtimeHours > 0) && (
                        <span className="text-[10px] text-gray-400 font-medium">Incl. adjustments</span>
                      )}
                    </div>
                    <p className="text-lg font-bold">
                      {fmt(p ? p.netSalary : emp.monthlySalary)}
                    </p>
                  </div>

                  {/* Button */}
                  <button 
                    onClick={onAddUpdate}
                    className="border border-gray-200 rounded-lg py-2 text-blue-600 font-semibold hover:bg-indigo-50 transition-colors"
                  >
                    {p ? "Edit Updates" : "+ Add Update"}
                  </button>
                </div>
              );
            })
          )}

          {/* Add Card - only show when we have employees or not loading */}
          {!loading && (filtered.length > 0 || search) && (
            <div
              onClick={onAddEmployee}
              className="border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center min-h-45 hover:border-blue-500 hover:bg-indigo-50 cursor-pointer transition"
            >
              <p className="text-gray-400 font-semibold">+ Add Employee</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

// --- Avatar Colors ---
const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];

// --- Employees Component ---
const EmployeeManagement = ({ employees, loading, onAddEmployee, onAddUpdate, payrolls, currentPage, totalPages, setCurrentPage }) => {
  const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN");

  // Build a map from employeeId to payroll data
  const payrollMap = {};
  (payrolls || []).forEach(p => { payrollMap[p.employeeId] = p; });

  const totalNet = employees.reduce((s, e) => {
    const p = payrollMap[e._id];
    return s + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  const initials = (name) =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="p-4 sm:p-8">
      {/* Summary */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 mb-4">
            Payroll done in 30 seconds
          </span>

          <p className="text-sm text-gray-400 mb-1">Final Summary</p>

          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 mb-2">
            ₹{totalNet.toLocaleString("en-IN")}
          </h1>

          <p className="text-sm text-gray-400">
            Total Monthly Payout for <span className="text-gray-700 font-semibold">{employees.length} Employee{employees.length !== 1 ? "s" : ""}</span>
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={onAddUpdate}
            className="flex-1 sm:flex-none px-5 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:shadow"
          >
            Edit Updates
          </button>

          <button className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
            Finish & Pay
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 min-w-[280px]">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <EmployeeBreakdownSkeleton key={i} />
            ))
          ) : employees.length === 0 ? (
            <EmptyState
              title="No employees yet"
              description="Add employees to see their salary breakdown here."
              action={
                <button
                  onClick={onAddEmployee}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
                >
                  + Add Employee
                </button>
              }
            />
          ) : (
            employees.map(emp => {
              const p = payrollMap[emp._id];

              return (
                <div key={emp._id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold"
                        style={{ backgroundColor: AVATAR_COLORS[emp.fullName.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length] }}
                      >
                        {initials(emp.fullName)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{emp.fullName}</p>
                        <p className="text-xs text-gray-400">{emp.role || "Employee"}</p>
                      </div>
                    </div>

                    <span className={`text-xs font-bold px-2 py-1 rounded-md border ${p ? "bg-green-50 text-green-600 border-green-200" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
                      {p ? "Finalized" : "Pending"}
                    </span>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-2 text-sm mb-5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Base Salary</span>
                      <span className="font-semibold">{fmt(emp.monthlySalary)}</span>
                    </div>

                    {p && p.leaveDays > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-600">− {p.leaveDays} day{p.leaveDays > 1 ? "s" : ""} leave</span>
                        <span className="text-red-600 font-semibold">- {fmt(p.leaveDeduction)}</span>
                      </div>
                    )}

                    {p && p.overtimeHours > 0 && (
                      <div className="flex justify-between">
                        <span className="text-blue-600">+ {p.overtimeHours} hr{p.overtimeHours > 1 ? "s" : ""} overtime</span>
                        <span className="text-blue-600 font-semibold">+ {fmt(p.overtimePay)}</span>
                      </div>
                    )}

                    {p && p.bonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-green-600">+ Bonus</span>
                        <span className="text-green-600 font-semibold">+ {fmt(p.bonus)}</span>
                      </div>
                    )}

                    {p && p.deductions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-600">− Deductions</span>
                        <span className="text-red-600 font-semibold">- {fmt(p.deductions)}</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-gray-200 mb-4" />

                  {/* Net */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase text-gray-400 font-bold">
                      {p ? "Net Salary" : "Monthly Salary"}
                    </span>
                    <span className="text-2xl font-semibold text-blue-600">
                      {fmt(p ? p.netSalary : emp.monthlySalary)}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Add More */}
          {!loading && employees.length > 0 && (
            <div
              onClick={onAddEmployee}
              className="border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center min-h-50 hover:border-blue-500 hover:bg-indigo-50 cursor-pointer"
            >
              <p className="text-gray-400 font-semibold">
                + Add more employees
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 border rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 border rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
};

export default function PaySphereDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [payrolls, setPayrolls] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ defaultOvertimeRate: 0, defaultDailyRate: 0 });
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const companyName = localStorage.getItem("companyName") || "Acme Corp";
  const token = localStorage.getItem("token");

  // Fetch employees and payroll data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, payRes] = await Promise.all([
          api.get(`/api/employees?page=${currentPage}&limit=10`),
          api.get(`/api/payroll/summary`),
        ]);

        setEmployees(empRes.data.employees);
        setTotalPages(empRes.data.totalPages);
        setPayrolls(payRes.data.payrolls || []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
    else setLoading(false);
  }, [token, currentPage]);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get(`/api/auth/settings`);

        setSettings(res.data);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };
    if (token) fetchSettings();
  }, [token]);

  const saveSettings = async () => {
    setUpdatingSettings(true);
    try {
      await api.put(`/api/auth/settings`, settings);

      setShowSettings(false);
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setUpdatingSettings(false);
    }
  };

  const payrollMap = {};
  payrolls.forEach(p => { payrollMap[p.employeeId] = p; });

  const totalPayout = employees.reduce((sum, e) => {
    const p = payrollMap[e._id];
    return sum + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  const filtered = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans">
      <Helmet>
        <title>{activePage === "Dashboard" ? "Payroll Dashboard | PaySphere" : "Employee Management | PaySphere"}</title>
        <meta name="description" content={`Manage ${companyName}'s payroll and employees with ease.`} />
      </Helmet>

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-56 bg-white border-r border-gray-200 fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              ₹
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900">{companyName}</p>
              <p className="text-xs text-gray-400">Payroll ID: 8821</p>
            </div>
          </div>
          <button 
            className="md:hidden p-2 text-gray-400 hover:text-gray-600"
            onClick={() => setIsSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {["Dashboard", "Employees", "Payroll Settings"].map((item) => (
            <button
              key={item}
              onClick={() => {
                if (item === "Payroll Settings") {
                  setShowSettings(true);
                } else {
                  setActivePage(item);
                }
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition ${
                activePage === item
                  ? "bg-indigo-50 text-blue-600 font-semibold"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 space-y-2">
          <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm">
            Run Payroll
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">

        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 truncate">Ledger Payroll</span>
            <button className="hidden sm:block text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5 whitespace-nowrap">
              April 2026
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
              {getInitials(companyName)}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("companyName");
                navigate("/");
              }}
              className="px-3 py-1.5 text-sm font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        {activePage === "Dashboard" ? (
          <DashboardOverview 
            search={search} 
            setSearch={setSearch} 
            filtered={filtered} 
            getInitials={getInitials} 
            onAddUpdate={() => navigate("/monthly-updates")}
            onAddEmployee={() => navigate("/add-employee")}
            totalPayout={totalPayout}
            employeeCount={employees.length}
            loading={loading}
            payrolls={payrolls}
          />
        ) : (
          <EmployeeManagement employees={employees} loading={loading} onAddEmployee={() => navigate("/add-employee")} onAddUpdate={() => navigate("/monthly-updates")} payrolls={payrolls} currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage}/>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }} onClick={() => setShowSettings(false)}>
            <div style={{ background: "white", borderRadius: 20, width: "92%", maxWidth: 450, padding: 0, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "28px 28px 20px", borderBottom: "1.5px solid #F0F1F3" }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Payroll Settings</h2>
                <p style={{ fontSize: 14, color: "#6B7280", margin: "8px 0 0" }}>Set default rates for all employees.</p>
              </div>
              
              <div style={{ padding: "24px 28px" }}>
                <label style={{ display: "block", marginBottom: 20 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>
                    Default Overtime Rate (₹ / hr)
                  </span>
                  <input 
                    type="number"
                    value={settings.defaultOvertimeRate}
                    onChange={(e) => setSettings({ ...settings, defaultOvertimeRate: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "12px 16px", background: "#F3F4F6", border: "1.5px solid transparent", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#111827", outline: "none" }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>
                    Default Daily Deduction (₹ / day)
                  </span>
                  <input 
                    type="number"
                    value={settings.defaultDailyRate}
                    onChange={(e) => setSettings({ ...settings, defaultDailyRate: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", padding: "12px 16px", background: "#F3F4F6", border: "1.5px solid transparent", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#111827", outline: "none" }}
                  />
                </label>
              </div>

              <div style={{ padding: "16px 28px 24px", borderTop: "1.5px solid #F0F1F3", display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => setShowSettings(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "white", fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                <button onClick={saveSettings} disabled={updatingSettings} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#2563EB", color: "white", fontSize: 14, fontWeight: 700, cursor: updatingSettings ? "not-allowed" : "pointer" }}>
                  {updatingSettings ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
