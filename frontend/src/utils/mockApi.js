/**
 * DEV-ONLY mock API interceptor.
 *
 * When the backend is unreachable, this interceptor catches network errors
 * and returns realistic mock data so the UI doesn't blank out.
 *
 * ⚠️  Only active in development mode (import.meta.env.DEV).
 */

const MOCK_EMPLOYEES = [
  { _id: '1', firstName: 'Alice', lastName: 'Johnson', fullName: 'Alice Johnson', email: 'alice@demo.com', role: 'Engineer', department: 'Engineering', salary: 85000, monthlySalary: 85000, overtimeRate: 500, status: 'active', joinDate: '2024-03-15' },
  { _id: '2', firstName: 'Bob', lastName: 'Smith', fullName: 'Bob Smith', email: 'bob@demo.com', role: 'Designer', department: 'Design', salary: 78000, monthlySalary: 78000, overtimeRate: 450, status: 'active', joinDate: '2024-05-20' },
  { _id: '3', firstName: 'Carol', lastName: 'Williams', fullName: 'Carol Williams', email: 'carol@demo.com', role: 'Manager', department: 'HR', salary: 92000, monthlySalary: 92000, overtimeRate: 600, status: 'active', joinDate: '2023-11-01' },
  { _id: '4', firstName: 'David', lastName: 'Brown', fullName: 'David Brown', email: 'david@demo.com', role: 'Analyst', department: 'Finance', salary: 72000, monthlySalary: 72000, overtimeRate: 400, status: 'active', joinDate: '2024-01-10' },
  { _id: '5', firstName: 'Eva', lastName: 'Davis', fullName: 'Eva Davis', email: 'eva@demo.com', role: 'Developer', department: 'Engineering', salary: 88000, monthlySalary: 88000, overtimeRate: 550, status: 'active', joinDate: '2024-07-01' },
];

const MOCK_PAYROLLS = MOCK_EMPLOYEES.map((emp, i) => ({
  _id: `payroll-${i + 1}`,
  employeeId: emp._id,
  employeeName: emp.fullName,
  month: 'July',
  year: 2024,
  basicSalary: emp.salary,
  netPay: emp.salary * 0.75,
  grossPay: emp.salary,
  status: 'paid',
  paidOn: '2024-07-28',
}));

const MOCK_ROUTES = {
  '/api/employee-portal/profile': () => ({
    user: {
      fullName: 'Alice Johnson',
      companyName: 'PaySphere',
      email: 'alice@demo.com',
    },
    employee: {
      role: 'Senior Engineer',
      monthlySalary: 85000,
      overtimeRate: 500,
    },
  }),

  '/api/employee-portal/payslips': () => ({
    payrolls: [
      {
        _id: 'payslip-1',
        month: 7,
        year: 2024,
        baseSalary: 85000,
        overtimePay: 2500,
        leaveDeduction: 0,
        netSalary: 87500,
        status: 'Paid',
      },
      {
        _id: 'payslip-2',
        month: 6,
        year: 2024,
        baseSalary: 85000,
        overtimePay: 1500,
        leaveDeduction: 1000,
        netSalary: 85500,
        status: 'Paid',
      },
    ],
  }),

  '/api/employees': (url) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const page = parseInt(params.get('page') || '1', 10);
    const limit = parseInt(params.get('limit') || '10', 10);
    const start = (page - 1) * limit;
    const sliced = MOCK_EMPLOYEES.slice(start, start + limit);
    return {
      employees: sliced,
      totalPages: Math.ceil(MOCK_EMPLOYEES.length / limit),
      totalEmployees: MOCK_EMPLOYEES.length,
      page,
    };
  },

  '/api/dashboard/summary': () => ({
    totalEmployees: MOCK_EMPLOYEES.length,
    totalPayroll: MOCK_EMPLOYEES.reduce((s, e) => s + e.salary, 0),
    activeEmployees: MOCK_EMPLOYEES.length,
    pendingPayrolls: 1,
    monthlyGrowth: 12.5,
    recentHires: 2,
  }),

  '/api/dashboard/recent-activity': () => ({
    activities: [
      { _id: '1', type: 'employee_added', message: 'Eva Davis joined Engineering', createdAt: new Date().toISOString() },
      { _id: '2', type: 'payroll_run', message: 'July 2024 payroll processed', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { _id: '3', type: 'employee_updated', message: 'Alice Johnson role updated', createdAt: new Date(Date.now() - 172800000).toISOString() },
    ],
  }),

  '/api/dashboard/layout': () => ({
    layout: null,
  }),

  '/api/reports/analytics': () => ({
    monthlyPayroll: [
      { month: 'Feb', total: 380000 },
      { month: 'Mar', total: 395000 },
      { month: 'Apr', total: 401000 },
      { month: 'May', total: 415000 },
      { month: 'Jun', total: 412000 },
      { month: 'Jul', total: 420000 },
    ],
    departmentBreakdown: [
      { department: 'Engineering', count: 2, totalSalary: 173000 },
      { department: 'Design', count: 1, totalSalary: 78000 },
      { department: 'HR', count: 1, totalSalary: 92000 },
      { department: 'Finance', count: 1, totalSalary: 72000 },
    ],
  }),

  '/api/payroll/summary': (url) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const page = parseInt(params.get('page') || '1', 10);
    const limit = parseInt(params.get('limit') || '10', 10);
    if (limit === 0) return { payrolls: MOCK_PAYROLLS, totalPages: 1, totalCount: MOCK_PAYROLLS.length };
    const start = (page - 1) * limit;
    const sliced = MOCK_PAYROLLS.slice(start, start + limit);
    return { payrolls: sliced, totalPages: Math.ceil(MOCK_PAYROLLS.length / limit), totalCount: MOCK_PAYROLLS.length };
  },

  '/api/settings': () => ({
    settings: {
      preferences: { language: 'English (US)', theme: 'system' },
      companyInfo: { payrollCycle: 'monthly' },
    },
    defaultOvertimeRate: 1.5,
    defaultDailyRate: 350,
  }),
};

/**
 * Installs the mock interceptor on an axios instance.
 * Only intercepts network errors (no response from server).
 */
export function installMockInterceptor(apiInstance) {
  if (!import.meta.env.DEV) return;

  apiInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      // Only intercept network errors (backend unreachable)
      if (error.response) {
        // Server responded with an error status — let it through
        return Promise.reject(error);
      }

      const url = error.config?.url || '';

      // Find matching mock route
      for (const [route, handler] of Object.entries(MOCK_ROUTES)) {
        if (url.includes(route)) {
          const mockData = handler(url);
          console.log(
            `%c🧪 Mock API → ${route}`,
            'color: #fbbf24; font-style: italic;',
          );
          return Promise.resolve({
            data: mockData,
            status: 200,
            statusText: 'OK (Mock)',
            headers: {},
            config: error.config,
          });
        }
      }

      // No mock available — reject as usual
      return Promise.reject(error);
    },
  );

  console.log(
    '%c🧪 Mock API interceptor active — backend calls will return demo data',
    'color: #fbbf24; font-weight: bold; font-size: 12px;',
  );
}
