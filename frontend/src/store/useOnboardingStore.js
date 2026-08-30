import { create } from 'zustand';

export const TOUR_STEPS = [
  {
    id: 'dashboard-overview',
    target: '[data-tour="dashboard-overview"]',
    title: 'Welcome to PaySphere Dashboard',
    content: 'Here is your central overview for total monthly payouts, employee roster statistics, and quick payroll actions.',
    path: '/dashboard',
  },
  {
    id: 'add-employee',
    target: '[data-tour="add-employee-form"], [data-tour="add-employee-btn"]',
    title: 'Add Employees to your Roster',
    content: 'Manage your workforce by adding new team members, specifying their role, monthly base salary, overtime rate, and bank details.',
    path: '/add-employee',
  },
  {
    id: 'generate-payroll',
    target: '[data-tour="generate-payroll-section"], [data-tour="run-payroll-btn"]',
    title: 'Generate & Finalize Payroll',
    content: 'Run monthly payroll in minutes. Review employee updates, verify net salaries & deductions, and finalize payouts effortlessly.',
    path: '/monthly-updates',
  },
];

const COMPLETED_KEY = 'paySphere_onboarding_completed';
const DISMISSED_KEY = 'paySphere_onboarding_dismissed';

export const useOnboardingStore = create((set, get) => ({
  isActive: false,
  currentStep: 0,
  hasCompleted: typeof window !== 'undefined' && localStorage.getItem(COMPLETED_KEY) === 'true',
  hasDismissed: typeof window !== 'undefined' && localStorage.getItem(DISMISSED_KEY) === 'true',

  startTour: (navigate) => {
    set({ isActive: true, currentStep: 0 });
    const step = TOUR_STEPS[0];
    if (navigate && step && window.location.pathname !== step.path) {
      navigate(step.path);
    }
  },

  nextStep: (navigate) => {
    const { currentStep, completeTour } = get();
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextIndex = currentStep + 1;
      set({ currentStep: nextIndex });
      const step = TOUR_STEPS[nextIndex];
      if (navigate && step && window.location.pathname !== step.path) {
        navigate(step.path);
      }
    } else {
      completeTour();
    }
  },

  prevStep: (navigate) => {
    const { currentStep } = get();
    if (currentStep > 0) {
      const prevIndex = currentStep - 1;
      set({ currentStep: prevIndex });
      const step = TOUR_STEPS[prevIndex];
      if (navigate && step && window.location.pathname !== step.path) {
        navigate(step.path);
      }
    }
  },

  goToStep: (stepIndex, navigate) => {
    if (stepIndex >= 0 && stepIndex < TOUR_STEPS.length) {
      set({ currentStep: stepIndex, isActive: true });
      const step = TOUR_STEPS[stepIndex];
      if (navigate && step && window.location.pathname !== step.path) {
        navigate(step.path);
      }
    }
  },

  dismissTour: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
    set({ isActive: false, hasDismissed: true });
  },

  completeTour: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMPLETED_KEY, 'true');
    }
    set({ isActive: false, hasCompleted: true });
  },

  resetTour: (navigate) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(COMPLETED_KEY);
      localStorage.removeItem(DISMISSED_KEY);
    }
    set({ hasCompleted: false, hasDismissed: false });
    get().startTour(navigate);
  },
}));
