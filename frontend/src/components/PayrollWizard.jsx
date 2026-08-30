import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import api from '../services/api';
import { useAutoSaveDraft, getDraft } from '../hooks/useAutoSaveDraft';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

const Avatar = ({ name, color, size = 38 }) => {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || '#3B82F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

const fmt = (n) => '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');

export default function PayrollWizard() {
  const navigate = useNavigate();
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';

  // Navigation / Focus references for accessibility
  const headingRef = useRef(null);

  // Core Wizard States
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(6);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [includedEmployees, setIncludedEmployees] = useState({});
  const [adjustments, setAdjustments] = useState({}); // empId -> { leaveDays, overtimeHours, bonus, deductions }
  const [warnings, setWarnings] = useState({}); // empId -> { field -> message }

  const [comparisonData, setComparisonData] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [approvedAnomalies, setApprovedAnomalies] = useState({}); // empId -> boolean

  // Submit / Finalize states
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  const [payrollResults, setPayrollResults] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Email status state
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const socketRef = useRef(null); // "success" | "error"

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/api/employees');
        const list = res.data.employees || [];
        setEmployees(list);

        // Include all active employees by default
        const initialIncluded = {};
        const initialAdjustments = {};
        list.forEach((emp) => {
          if (emp.isActive) {
            initialIncluded[emp._id] = true;
          }
          initialAdjustments[emp._id] = {
            leaveDays: '',
            overtimeHours: '',
            bonus: '',
            deductions: '',
          };
        });
        setIncludedEmployees(initialIncluded);
        setAdjustments(initialAdjustments);
      } catch (err) {
        console.error('Failed to load employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  const { lastSaved, clearDraft } = useAutoSaveDraft(
    'payrollWizardDraft',
    {
      includedEmployees,
      adjustments,
    },
    2000,
  );

  useEffect(() => {
    getDraft('payrollWizardDraft').then((draft) => {
      if (draft && draft.data) {
        if (
          window.confirm(
            'You have an unsaved draft of your payroll batch. Do you want to restore it?',
          )
        ) {
          setIncludedEmployees(draft.data.includedEmployees || {});
          setAdjustments(draft.data.adjustments || {});
        } else {
          clearDraft();
        }
      }
    });
  }, [clearDraft]);

  // Handle focus transition on step changes
  useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, [step]);

  // Handle beforeunload logic to prevent accidental exit
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!showSuccess && step > 1) {
        e.preventDefault();
        e.returnValue =
          'Are you sure you want to discard your payroll wizard progress?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step, showSuccess]);

  // Helper validation
  const getIncludedEmployeesList = () => {
    return employees.filter((emp) => includedEmployees[emp._id]);
  };

  const isStepValid = () => {
    if (step === 1) return true;
    if (step === 2) return getIncludedEmployeesList().length > 0;
    if (step === 3) return true;
    if (step === 4) {
      // Anomaly review step.
      if (loadingComparison) return false;
      const criticalAnomalies =
        comparisonData?.categories?.anomalies?.filter((a) =>
          a.anomalies.some((an) => an.type === 'CRITICAL'),
        ) || [];
      const unapproved = criticalAnomalies.filter(
        (a) => !approvedAnomalies[a.employeeId],
      );
      return unapproved.length === 0;
    }
    if (step === 5) return true;
    if (step === 6) return confirmed;
    return false;
  };

  // Safe numerical input handlers
  const handleAdjustmentChange = (empId, field, value) => {
    // Basic scrubbing of non-numerical inputs (allows positive numbers and decimals)
    let scrubbed = value.replace(/[^0-9.]/g, '');

    // Guard against multiple decimals
    const parts = scrubbed.split('.');
    if (parts.length > 2) {
      scrubbed = parts[0] + '.' + parts.slice(1).join('');
    }

    let numericVal = parseFloat(scrubbed) || 0;
    let warningMsg = '';

    // Boundaries clamping
    if (field === 'leaveDays') {
      if (numericVal > 31) {
        scrubbed = '31';
        warningMsg = 'Clamped to max 31 days';
      }
    } else if (field === 'overtimeHours') {
      if (numericVal > 744) {
        scrubbed = '744';
        warningMsg = 'Clamped to max 744 hours';
      }
    } else if (field === 'bonus' || field === 'deductions') {
      if (numericVal > 10000000) {
        scrubbed = '10000000';
        warningMsg = 'Clamped to max ₹10,000,000';
      }
    }

    setAdjustments((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: scrubbed,
      },
    }));

    setWarnings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: warningMsg,
      },
    }));
  };

  // Submit Payroll
  const handleFinalize = async () => {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setFinalizeError('');

    const targetEmployees = getIncludedEmployeesList();
    const activities = targetEmployees.map((emp) => {
      const adj = adjustments[emp._id] || {};
      const tags = [];

      const leave = parseFloat(adj.leaveDays) || 0;
      if (leave > 0) {
        tags.push({
          label: `– ${leave} day${leave > 1 ? 's' : ''} leave`,
          bg: '#FEF2F2',
          color: '#DC2626',
        });
      }

      const overtime = parseFloat(adj.overtimeHours) || 0;
      if (overtime > 0) {
        tags.push({
          label: `+ ${overtime} hr overtime`,
          bg: '#EFF6FF',
          color: '#2563EB',
        });
      }

      const bonusVal = parseFloat(adj.bonus) || 0;
      if (bonusVal > 0) {
        tags.push({
          label: `+ \u20b9${bonusVal.toLocaleString('en-IN')} bonus`,
          bg: '#F0FDF4',
          color: '#16A34A',
        });
      }

      const deductionVal = parseFloat(adj.deductions) || 0;
      if (deductionVal > 0) {
        tags.push({
          label: `– \u20b9${deductionVal.toLocaleString('en-IN')} deduction`,
          bg: '#FEF2F2',
          color: '#DC2626',
        });
      }

      return {
        employeeId: emp._id,
        name: emp.fullName,
        tags,
      };
    });

    try {
      const res = await api.post('/api/payroll/finalize', {
        activities,
        month: selectedMonth,
        year: selectedYear,
      });
      setPayrollResults(res.data);
      setShowSuccess(true);
      await clearDraft();
    } catch (err) {
      setFinalizeError(
        err.response?.data?.message ||
          'Failed to finalize payroll. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Email Dispatch
  const handleSendEmails = async () => {
    if (sendingEmails) return;
    setSendingEmails(true);
    setEmailMsg('');
    setEmailStatus('');

    try {
      const res = await api.post('/api/payroll/send-all-emails', {
        month: selectedMonth,
        year: selectedYear,
      });
      setEmailMsg(
        res.data.message ||
          'Payslip emails successfully sent to all employees!',
      );
      setEmailStatus('success');
    } catch (err) {
      setEmailMsg(
        err.response?.data?.message ||
          'Failed to send payslip emails. Please try again.',
      );
      setEmailStatus('error');
    } finally {
      setSendingEmails(false);
    }
  };

  // Calculation helpers for Step 4 summary
  const getTotals = () => {
    let totalBase = 0;
    let includedCount = 0;
    let totalAdjustmentsCount = 0;

    employees.forEach((emp) => {
      if (includedEmployees[emp._id]) {
        includedCount++;
        totalBase += Number(emp.monthlySalary) || 0;

        const adj = adjustments[emp._id] || {};
        if (parseFloat(adj.leaveDays) > 0) totalAdjustmentsCount++;
        if (parseFloat(adj.overtimeHours) > 0) totalAdjustmentsCount++;
        if (parseFloat(adj.bonus) > 0) totalAdjustmentsCount++;
        if (parseFloat(adj.deductions) > 0) totalAdjustmentsCount++;
      }
    });

    return {
      includedCount,
      totalBase,
      totalAdjustmentsCount,
    };
  };

  // Success view layout
  if (showSuccess && payrollResults) {
    const resultsList = payrollResults.results || [];
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 16px 120px 16px',
          fontFamily: "'DM Sans', sans-serif",
          color: isDark ? 'white' : '#1F2937',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              margin: '0 auto 16px auto',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            }}
          >
            ✓
          </div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            style={{
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 8,
              fontFamily: "'DM Serif Display', serif",
              outline: 'none',
            }}
          >
            Payroll Finalized
          </h2>
          <p style={{ fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280' }}>
            {payrollResults.message ||
              'Payroll run has been finalized successfully!'}
          </p>
        </div>

        {/* Individual Net Salaries */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 30,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: isDark ? '#9CA3AF' : '#6B7280',
            }}
          >
            Final Payout Breakdown
          </h3>
          <div
            style={{
              background: isDark ? '#111827' : 'white',
              borderRadius: 16,
              border: isDark ? '1.5px solid #1E293B' : '1.5px solid #E5E7EB',
              overflow: 'hidden',
            }}
          >
            {resultsList.map((res, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderBottom:
                    i < resultsList.length - 1
                      ? isDark
                        ? '1px solid #1E293B'
                        : '1px solid #E5E7EB'
                      : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={res.employeeName} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {res.employeeName}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Base: {fmt(res.baseSalary)}
                    </div>
                  </div>
                </div>
                <div
                  style={{ fontWeight: 700, fontSize: 16, color: '#3B82F6' }}
                >
                  {fmt(res.netSalary)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email send options */}
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: isDark ? '#1E293B' : '#F3F4F6',
            marginBottom: 30,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            Email digital payslips to all employees?
          </p>
          <button
            onClick={handleSendEmails}
            disabled={sendingEmails}
            aria-label="Send digital payslips to all employees"
            style={{
              width: '100%',
              padding: '12px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: sendingEmails ? 'not-allowed' : 'pointer',
              opacity: sendingEmails ? 0.7 : 1,
              minHeight: 44,
            }}
          >
            {sendingEmails ? 'Sending...' : '✉ Send Payslips'}
          </button>
          {emailMsg && (
            <p
              style={{
                fontSize: 13,
                marginTop: 10,
                color: emailStatus === 'success' ? '#10B981' : '#EF4444',
                fontWeight: 600,
              }}
            >
              {emailMsg}
            </p>
          )}
        </div>

        {/* Done Actions */}
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Done, go to dashboard"
          style={{
            width: '100%',
            padding: '14px',
            background: isDark ? '#374151' : '#1F2937',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Done (Go to Dashboard)
        </button>
      </div>
    );
  }

  const { includedCount, totalBase, totalAdjustmentsCount } = getTotals();

  return (
    <div
      data-tour="generate-payroll-section"
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        padding: '0 0 100px 0',
        fontFamily: "'DM Sans', sans-serif",
        color: isDark ? 'white' : '#1F2937',
      }}
    >
      {/* Sticky Progress Bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: isDark ? '#090D16' : '#F3F4F6',
          padding: '16px 16px 12px 16px',
          borderBottom: isDark ? '1px solid #1E293B' : '1px solid #E5E7EB',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#3B82F6',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Step {step} of 5
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isDark ? '#9CA3AF' : '#6B7280',
            }}
          >
            {step === 1 && 'Pay Period'}
            {step === 2 && 'Review Team'}
            {step === 3 && 'Adjustments'}
            {step === 4 && 'Summary'}
            {step === 5 && 'Finalize'}
          </span>
        </div>
        <div
          style={{
            height: 4,
            background: isDark ? '#1E293B' : '#E5E7EB',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: '#3B82F6',
              width: `${(step / 5) * 100}%`,
              transition: 'width 0.25s ease-in-out',
            }}
            aria-label={`Progress bar: ${step} of 5`}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin="1"
            aria-valuemax="5"
          />
        </div>
      </div>

      {/* Steps Content Area */}
      <div style={{ padding: '24px 16px 0 16px' }}>
        {/* STEP 1: Select Pay Period */}
        {step === 1 && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                outline: 'none',
              }}
            >
              Select Pay Period
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginBottom: 24,
              }}
            >
              Choose the calendar month and year to run payroll.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="Pay period month"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: isDark ? '#111827' : 'white',
                    color: isDark ? 'white' : '#1F2937',
                    border: isDark
                      ? '1.5px solid #1E293B'
                      : '1.5px solid #E5E7EB',
                    borderRadius: 10,
                    fontSize: 15,
                    minHeight: 44,
                  }}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Pay period year"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: isDark ? '#111827' : 'white',
                    color: isDark ? 'white' : '#1F2937',
                    border: isDark
                      ? '1.5px solid #1E293B'
                      : '1.5px solid #E5E7EB',
                    borderRadius: 10,
                    fontSize: 15,
                    minHeight: 44,
                  }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Review Employees */}
        {step === 2 && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                outline: 'none',
              }}
            >
              Include Employees
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginBottom: 20,
              }}
            >
              Toggle the employees to include in this payroll batch.
            </p>

            {loadingEmployees ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#9CA3AF',
                }}
              >
                Loading employee directory...
              </div>
            ) : employees.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#9CA3AF',
                }}
              >
                No active employees found. Please add employees in dashboard.
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: isDark ? '#1E293B' : '#F3F4F6',
                    border: isDark
                      ? '1.5px solid #334155'
                      : '1.5px solid #D1D5DB',
                    cursor: 'pointer',
                    minHeight: 48,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <span>👥</span>
                    <span>Select All Employees ({employees.length})</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={
                      employees.length > 0 &&
                      employees.every((emp) => !!includedEmployees[emp._id])
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const nextIncluded = { ...includedEmployees };
                      employees.forEach((emp) => {
                        nextIncluded[emp._id] = checked;
                      });
                      setIncludedEmployees(nextIncluded);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      cursor: 'pointer',
                    }}
                  />
                </label>

                {employees.map((emp) => (
                  <label
                    key={emp._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px',
                      borderRadius: 14,
                      background: isDark ? '#111827' : 'white',
                      border: isDark
                        ? '1.5px solid #1E293B'
                        : '1.5px solid #E5E7EB',
                      cursor: 'pointer',
                      minHeight: 52,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <Avatar name={emp.fullName} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {emp.fullName}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {emp.role || 'Employee'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!includedEmployees[emp._id]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIncludedEmployees((prev) => ({
                          ...prev,
                          [emp._id]: checked,
                        }));
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Review Deductions & Adjustments */}
        {step === 3 && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                outline: 'none',
              }}
            >
              Add Adjustments
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginBottom: 20,
              }}
            >
              Input any overtime, leaves, bonuses, or deductions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {getIncludedEmployeesList().map((emp) => {
                const adj = adjustments[emp._id] || {};
                const empWarn = warnings[emp._id] || {};

                return (
                  <div
                    key={emp._id}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: isDark ? '#111827' : 'white',
                      border: isDark
                        ? '1.5px solid #1E293B'
                        : '1.5px solid #E5E7EB',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <Avatar name={emp.fullName} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                          {emp.fullName}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          Base: {fmt(emp.monthlySalary)}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                      }}
                    >
                      {/* Leave Days */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          Leave Days
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={adj.leaveDays || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleAdjustmentChange(
                              emp._id,
                              'leaveDays',
                              e.target.value,
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: isDark ? '#090D16' : '#F3F4F6',
                            color: isDark ? 'white' : '#1F2937',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            minHeight: 44,
                          }}
                        />
                        {empWarn.leaveDays && (
                          <div
                            style={{
                              fontSize: 10,
                              color: '#F59E0B',
                              marginTop: 2,
                              fontWeight: 500,
                            }}
                          >
                            ⚠️ {empWarn.leaveDays}
                          </div>
                        )}
                      </div>

                      {/* Overtime Hours */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          Overtime Hrs
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={adj.overtimeHours || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleAdjustmentChange(
                              emp._id,
                              'overtimeHours',
                              e.target.value,
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: isDark ? '#090D16' : '#F3F4F6',
                            color: isDark ? 'white' : '#1F2937',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            minHeight: 44,
                          }}
                        />
                        {empWarn.overtimeHours && (
                          <div
                            style={{
                              fontSize: 10,
                              color: '#F59E0B',
                              marginTop: 2,
                              fontWeight: 500,
                            }}
                          >
                            ⚠️ {empWarn.overtimeHours}
                          </div>
                        )}
                      </div>

                      {/* Bonus */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          Bonus (₹)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={adj.bonus || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleAdjustmentChange(
                              emp._id,
                              'bonus',
                              e.target.value,
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: isDark ? '#090D16' : '#F3F4F6',
                            color: isDark ? 'white' : '#1F2937',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            minHeight: 44,
                          }}
                        />
                        {empWarn.bonus && (
                          <div
                            style={{
                              fontSize: 10,
                              color: '#F59E0B',
                              marginTop: 2,
                              fontWeight: 500,
                            }}
                          >
                            ⚠️ {empWarn.bonus}
                          </div>
                        )}
                      </div>

                      {/* Deductions */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          Deduction (₹)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={adj.deductions || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleAdjustmentChange(
                              emp._id,
                              'deductions',
                              e.target.value,
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: isDark ? '#090D16' : '#F3F4F6',
                            color: isDark ? 'white' : '#1F2937',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            minHeight: 44,
                          }}
                        />
                        {empWarn.deductions && (
                          <div
                            style={{
                              fontSize: 10,
                              color: '#F59E0B',
                              marginTop: 2,
                              fontWeight: 500,
                            }}
                          >
                            ⚠️ {empWarn.deductions}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Anomaly Review */}
        {step === 4 && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                outline: 'none',
              }}
            >
              Anomaly Review
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginBottom: 20,
              }}
            >
              Review significant deviations from previous payroll periods.
              Critical anomalies must be approved to proceed.
            </p>

            {loadingComparison ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                Checking anomalies...
              </div>
            ) : comparisonData?.categories?.anomalies?.length > 0 ? (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {comparisonData.categories.anomalies.map((record) => {
                  const isCritical = record.anomalies.some(
                    (a) => a.type === 'CRITICAL',
                  );
                  const isApproved = approvedAnomalies[record.employeeId];

                  return (
                    <div
                      key={record.employeeId}
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        border:
                          isCritical && !isApproved
                            ? '1.5px solid #FCA5A5'
                            : '1.5px solid #E5E7EB',
                        background:
                          isCritical && !isApproved
                            ? '#FEF2F2'
                            : isDark
                              ? '#111827'
                              : 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color:
                              isCritical && !isApproved ? '#B91C1C' : 'inherit',
                          }}
                        >
                          {record.employeeName}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                          {record.anomalies.map((a, i) => (
                            <div key={i}>
                              {a.type}: {a.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        {isCritical && (
                          <label
                            style={{
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!isApproved}
                              onChange={(e) =>
                                setApprovedAnomalies((prev) => ({
                                  ...prev,
                                  [record.employeeId]: e.target.checked,
                                }))
                              }
                            />
                            Approve
                          </label>
                        )}
                        <button
                          onClick={() => setSelectedAnomaly(record)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid #D1D5DB',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  border: '1px dashed #D1D5DB',
                  borderRadius: 8,
                }}
              >
                No anomalies detected. You can proceed.
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Summary & Totals */}
        {step === 5 && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                outline: 'none',
              }}
            >
              Batch Summary
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginBottom: 20,
              }}
            >
              Review the batch size and adjustments count.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: isDark ? '#111827' : 'white',
                  border: isDark
                    ? '1.5px solid #1E293B'
                    : '1.5px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  Included Employees
                </span>
                <span
                  style={{ fontSize: 18, fontWeight: 700, color: '#3B82F6' }}
                >
                  {includedCount}
                </span>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: isDark ? '#111827' : 'white',
                  border: isDark
                    ? '1.5px solid #1E293B'
                    : '1.5px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  Total Base Salary
                </span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                  {fmt(totalBase)}
                </span>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: isDark ? '#111827' : 'white',
                  border: isDark
                    ? '1.5px solid #1E293B'
                    : '1.5px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  Adjustments Logged
                </span>
                <span
                  style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B' }}
                >
                  {totalAdjustmentsCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Confirm & Submit */}
        {step === 6 && (
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                outline: 'none',
              }}
            >
              Final Confirmation
            </h2>
            <p
              style={{
                fontSize: 14,
                color: isDark ? '#9CA3AF' : '#6B7280',
                marginBottom: 24,
              }}
            >
              Confirm and finalize payroll for{' '}
              {MONTHS.find((m) => m.value === selectedMonth)?.label}{' '}
              {selectedYear}.
            </p>

            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: isDark ? '#7F1D1D20' : '#FEF2F2',
                border: isDark ? '1.5px solid #7F1D1D' : '1.5px solid #FCA5A5',
                marginBottom: 24,
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#EF4444',
                  marginBottom: 6,
                }}
              >
                ⚠️ Important Notice
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: isDark ? '#FCA5A5' : '#B91C1C',
                  lineHeight: 1.5,
                }}
              >
                Finalizing payroll will commit transactions to the database and
                lock payroll calculations for this cycle. Ensure all adjustments
                are correct.
              </p>
            </div>

            {/* Error Message */}
            {finalizeError && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 20,
                  border: '1.5px solid #FCA5A5',
                }}
              >
                {finalizeError}
              </div>
            )}

            {/* Checkbox Gate */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
                marginBottom: 24,
                padding: 10,
              }}
            >
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{
                  width: 20,
                  height: 20,
                  marginTop: 2,
                  cursor: 'pointer',
                }}
              />
              <span
                style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4 }}
              >
                I confirm that the payroll data is correct and ready to be
                finalized.
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Sticky Navigation Action Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: isDark ? '#111827' : 'white',
          borderTop: isDark ? '1.5px solid #1E293B' : '1.5px solid #E5E7EB',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => {
            if (step > 1) {
              setStep((s) => s - 1);
            } else {
              navigate('/dashboard');
            }
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            color: isDark ? '#CBD5E1' : '#4B5563',
            border: isDark ? '1.5px solid #374151' : '1.5px solid #D1D5DB',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {step === 1 ? 'Exit' : 'Back'}
        </button>

        <button
          onClick={async () => {
            if (step === 3) {
              // Load comparison data before moving to step 4
              setLoadingComparison(true);
              setStep(4);
              try {
                const monthA = selectedMonth === 1 ? 12 : selectedMonth - 1;
                const yearA =
                  selectedMonth === 1 ? selectedYear - 1 : selectedYear;
                const res = await api.get('/api/payroll-comparison/compare', {
                  params: {
                    monthA,
                    yearA,
                    monthB: selectedMonth,
                    yearB: selectedYear,
                  },
                });
                setComparisonData(res.data.data);
              } catch (err) {
                console.error(err);
              } finally {
                setLoadingComparison(false);
              }
            } else if (step < 6) {
              setStep((s) => s + 1);
            } else {
              handleFinalize();
            }
          }}
          disabled={!isStepValid() || submitting}
          style={{
            flex: 2,
            padding: '12px',
            background:
              !isStepValid() || submitting
                ? isDark
                  ? '#1E293B'
                  : '#E5E7EB'
                : '#3B82F6',
            color:
              !isStepValid() || submitting
                ? isDark
                  ? '#4B5563'
                  : '#9CA3AF'
                : 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: !isStepValid() || submitting ? 'not-allowed' : 'pointer',
            minHeight: 44,
          }}
        >
          {submitting
            ? 'Processing...'
            : step === 6
              ? 'Submit Payroll'
              : 'Next'}
        </button>
      </div>

      {/* Dynamic import for drilldown to avoid circular dep issues in this component. In real app, import at top. */}
      {selectedAnomaly && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              bottom: 20,
              width: 600,
              background: 'white',
              borderRadius: 8,
              padding: 20,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <h3>{selectedAnomaly.employeeName} Comparison</h3>
              <button
                onClick={() => setSelectedAnomaly(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <div>
                <h4>Previous Period</h4>
                <div>Net Pay: ₹{selectedAnomaly.periodA?.netSalary}</div>
                <div>Base Salary: ₹{selectedAnomaly.periodA?.baseSalary}</div>
              </div>
              <div>
                <h4>Current Period</h4>
                <div>Net Pay: ₹{selectedAnomaly.periodB?.netSalary}</div>
                <div>Base Salary: ₹{selectedAnomaly.periodB?.baseSalary}</div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <h4>Differences</h4>
              <div>
                Net Pay Diff: {selectedAnomaly.diff.netSalaryPct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
