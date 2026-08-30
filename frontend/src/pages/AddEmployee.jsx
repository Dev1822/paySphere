import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import ThemeToggle from "../components/ThemeToggle";
import EmployeeForm from "../components/EmployeeForm";
import NotificationCenter from "../components/common/NotificationCenter";
import { useAppStore } from "../store/useAppStore";
import useCtrlEnterSubmit from "../hooks/useCtrlEnterSubmit";
import api from "../services/api";
import { getCurrencySymbol } from "../utils/currency";

// ── Icons ──────────────────────────────────────────────────────────────────
const GridIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const PeopleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const PersonPlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const HelpCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const SupportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];

const COUNTRY_CODE_OPTIONS = [
  { label: "+91 (India)", value: "+91" },
  { label: "+1 (USA/Canada)", value: "+1" },
  { label: "+44 (UK)", value: "+44" },
  { label: "+61 (Australia)", value: "+61" },
  { label: "+65 (Singapore)", value: "+65" },
  { label: "+971 (UAE)", value: "+971" },
];

const Avatar = ({ name, size = 36 }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: AVATAR_COLORS[colorIndex],
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: 700, color: "white", flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

const normalizePhoneValue = (value) =>
  value.trim().replace(/[()\s-]/g, "");

export default function AddEmployee() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const logout = useAppStore((state) => state.logout);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const companyName = localStorage.getItem("companyName") || "Acme Corp";
  const [currency] = useState("INR"); // Kept for sidebar currency symbol display

  // CSV Upload State (Preserved as not instructed to remove)
  const [csvFile, setCsvFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  // Recently added employees (Preserved as not instructed to remove)
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const token = localStorage.getItem("token");

  // Fetch recent employees
  const fetchRecent = async () => {
    try {
      const res = await api.get(`/api/employees?page=1&limit=5`);
      setRecentEmployees(res.data.employees || []);
    } catch (err) {
      console.error("Failed to fetch recent employees:", err);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    if (token) {
      setTimeout(() => { fetchRecent(); }, 0);
    } else {
      setTimeout(() => setLoadingRecent(false), 0);
    }
  }, [token]);

  // New Form Submission Handler
  const handleFormSubmit = async (values) => {
    try {
      await api.post('/api/employees', values);
      // Refresh recent list after successful add
      fetchRecent();
      navigate('/dashboard?tab=employees');
    } catch (error) {
      throw error; // Let Formik/EmployeeForm catch and map errors
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setError("Please select a CSV file.");
      return;
    }

    setUploadingCsv(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await api.post(
        "/api/employees/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSuccess(`${res.data.imported} employees imported successfully.`);
      setCsvFile(null);

      const recent = await api.get("/api/employees/recent");
      setRecentEmployees(recent.data.employees || []);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.response?.data?.message || "CSV import failed.");
    } finally {
      setUploadingCsv(false);
    }
  };

  const validatePhone = (countryCode, localNumber) => {
    const trimmedCountryCode = (countryCode || "+91").trim();
    const trimmedLocalNumber = normalizePhoneValue(localNumber || "");

    if (!trimmedLocalNumber) {
      setPhoneError("");
      return true;
    }

    const normalized = normalizePhoneValue(`${trimmedCountryCode}${trimmedLocalNumber}`);
    if (!PHONE_REGEX.test(normalized)) {
      setPhoneError("Enter a valid international phone number, e.g. +91 98765 43210.");
      return false;
    }

    setPhoneError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const salaryNum = parseFloat(monthlySalary.replace(/,/g, ""));
    const otNum = overtimeRate ? parseFloat(overtimeRate.replace(/,/g, "")) : undefined;

    if (isNaN(salaryNum) || salaryNum <= 0) {
      setError("Monthly salary must be a positive number.");
      setLoading(false);
      return;
    }

    if (!validatePhone(phoneCountryCode, phone)) {
      setError("Please enter a valid international phone number.");
      setLoading(false);
      return;
    }

    const fullPhoneNumber = normalizePhoneValue(`${phoneCountryCode}${phone}`);

    try {
      const dobDate = dateOfBirth ? new Date(dateOfBirth + "T12:00:00.000Z") : undefined;
      const joiningDateDate = joiningDate ? new Date(joiningDate + "T12:00:00.000Z") : undefined;
      const response = await api.post(`/api/employees`, {
        fullName,
        role,
        department,
        monthlySalary: salaryNum,
        overtimeRate: otNum,
        currency,
        phone: fullPhoneNumber || undefined,
        dateOfBirth: dobDate,
        joiningDate: joiningDateDate,
      });
      if (response.status === 201) {
        setSuccess("Employee added successfully!");
        setFullName("");
        setRole("");
        setDepartment("");
        setMonthlySalary("");
        setOvertimeRate("");
        setCurrency("");
        setPhoneCountryCode("+91");
        setPhone("");
        setPhoneError("");
        setDateOfBirth("");
        setJoiningDate("");
        fetchRecent();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add employee.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFullName("");
    setRole("");
    setDepartment("");
    setMonthlySalary("");
    setOvertimeRate("");
    setDateOfBirth("");
    setJoiningDate("");
    setError("");
    setSuccess("");
    navigate("/dashboard");
  };

  const sidebarItems = [
    { id: "dashboard", label: t('nav.dashboard', 'Dashboard'), path: "/dashboard", icon: <GridIcon /> },
    { id: "employees", label: t('nav.employees', 'Employees'), path: "/dashboard?tab=employees", icon: <PeopleIcon /> },
    { id: "settings", label: t('nav.settings', 'Settings'), path: "/settings", icon: <SupportIcon /> },
  ];

  const getInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const fmt = (n, c = "INR") => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c }).format(n);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>{t('addEmployee.pageTitle', 'Add Employee | PaySphere')}</title>
        <meta name="description" content={t('addEmployee.pageMeta', 'Add a new employee to your company roster.')} />
      </Helmet>

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-200 dark:shadow-none">
              {getCurrencySymbol(currency)}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">{companyName}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">Payroll ID: 8821</p>
            </div>
          </div>
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={() => setIsSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition ${item.id === "employees"
                ? "bg-indigo-50 dark:bg-indigo-950/30 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
          <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
            <SupportIcon />
            Help & Support
          </button>
          <button onClick={() => navigate("/monthly-updates")} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-200 dark:shadow-none transition">
            {t('dashboard.runPayroll', 'Run Payroll')}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">

        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation sidebar"
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">{t('dashboard.ledgerPayroll', 'Ledger Payroll')}</span>
            <button className="hidden sm:block text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-blue-600 dark:border-blue-400 pb-0.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-500">
            <ThemeToggle />
            <NotificationCenter />
            <button aria-label="Help & Support" className="hidden sm:flex p-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"><HelpCircleIcon /></button>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {getInitials(companyName)}
            </div>
            <button
              onClick={() => {
                logout();
                localStorage.removeItem("companyName");
                navigate("/auth");
              }}
              aria-label="Sign Out"
              className="px-3 py-1.5 text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">

           {/* ── LEFT: Form Section ── */}
            <div className="flex-1">
              <div data-tour="add-employee-form" className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 transition-colors duration-200">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('addEmployee.title', 'Add New Employee')}</h1>
                <EmployeeForm
                  onSubmit={handleFormSubmit}
                  onCancel={() => navigate(-1)}
                  isEdit={false}
                />
              </div>
              {/* Bulk CSV Upload Card (Preserved) */}
              <div className="mt-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 transition-colors duration-200">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {t('addEmployee.bulkUpload', 'Bulk Upload Employees')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
                  {t('addEmployee.bulkUploadDesc', 'Upload a CSV file to add multiple employees at once.')}
                </p>

                {/* CSV Messages */}
                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {success}
                  </div>
                )}

                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition ${csvFile
                    ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                    : "border-gray-300 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800/50"
                    }`}
                >
                  {!csvFile ? (
                    <>
                      <div className="text-3xl mb-2">📄</div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        {t('addEmployee.chooseCsvFile', 'Choose CSV file')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 mb-3">
                        {t('addEmployee.csvOnly', 'Only .csv files are supported')}
                      </p>
                      <label className="inline-block cursor-pointer px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                        {t('addEmployee.browseFile', 'Browse File')}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          hidden
                          onChange={(e) =>
                            setCsvFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-4 py-3 border border-green-200 dark:border-green-900/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-2xl">📄</div>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {csvFile.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-500">
                            {(csvFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCsvUpload}
                          disabled={uploadingCsv}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {uploadingCsv ? t('addEmployee.uploading', 'Uploading...') : t('addEmployee.upload', 'Upload')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCsvFile(null)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Recent Employees ── */}
            <div className="w-full lg:w-80 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-serif font-bold text-gray-900 dark:text-white">{t('addEmployee.recentAdditions', 'Recent Additions')}</h2>
                  <button
                    onClick={() => navigate("/dashboard?tab=employees")}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {t('addEmployee.viewAll', 'View All')} <ArrowRightIcon />
                  </button>
                </div>

                {loadingRecent ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-2">
                        <div className="w-9 h-9 bg-gray-200 dark:bg-slate-800 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded w-24" />
                          <div className="h-2 bg-gray-100 dark:bg-slate-800/60 rounded w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentEmployees.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-slate-500 text-center py-4">
                    {t('addEmployee.noEmployeesYet', 'No employees added yet.')}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {recentEmployees.map((emp) => (
                      <div key={emp._id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={emp.fullName} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {emp.fullName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500 truncate">
                              {emp.role} {emp.department ? `• ${emp.department}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-900 dark:text-slate-200">
                            {fmt(emp.monthlySalary, emp.currency)}
                          </p>
                          {emp.userId && (
                            <button
                              onClick={async () => {
                                try {
                                  const { impersonateUser } = await import('../features/auth/services/authService');
                                  const res = await impersonateUser(emp.userId);
                                  useAppStore.getState().startImpersonation({
                                    user: res.user,
                                    token: res.token,
                                    impersonator: res.impersonator,
                                  });
                                  window.location.href = '/';
                                } catch (err) {
                                  alert(err.response?.data?.message || 'Failed to impersonate user');
                                }
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded hover:bg-indigo-100 transition"
                              title={`${t('addEmployee.impersonate', 'Impersonate')} ${emp.fullName}`}
                            >
                              {t('addEmployee.impersonate', 'Impersonate')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
