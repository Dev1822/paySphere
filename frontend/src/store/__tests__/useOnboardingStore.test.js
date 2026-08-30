import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnboardingStore, TOUR_STEPS } from '../useOnboardingStore';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({
      isActive: false,
      currentStep: 0,
      hasCompleted: false,
      hasDismissed: false,
    });
  });

  it('starts tour at step 0 and navigates to initial step path', () => {
    const navigate = vi.fn();
    useOnboardingStore.getState().startTour(navigate);

    const state = useOnboardingStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.currentStep).toBe(0);
    expect(navigate).toHaveBeenCalledWith(TOUR_STEPS[0].path);
  });

  it('advances through steps with nextStep() and completes at the end', () => {
    const navigate = vi.fn();
    const store = useOnboardingStore.getState();

    store.startTour(navigate);
    expect(useOnboardingStore.getState().currentStep).toBe(0);

    store.nextStep(navigate);
    expect(useOnboardingStore.getState().currentStep).toBe(1);
    expect(navigate).toHaveBeenCalledWith(TOUR_STEPS[1].path);

    store.nextStep(navigate);
    expect(useOnboardingStore.getState().currentStep).toBe(2);
    expect(navigate).toHaveBeenCalledWith(TOUR_STEPS[2].path);

    // Final step next completes tour
    store.nextStep(navigate);
    const finalState = useOnboardingStore.getState();
    expect(finalState.isActive).toBe(false);
    expect(finalState.hasCompleted).toBe(true);
    expect(localStorage.getItem('paySphere_onboarding_completed')).toBe('true');
  });

  it('navigates backwards with prevStep()', () => {
    const navigate = vi.fn();
    useOnboardingStore.setState({ isActive: true, currentStep: 2 });

    useOnboardingStore.getState().prevStep(navigate);
    expect(useOnboardingStore.getState().currentStep).toBe(1);
    expect(navigate).toHaveBeenCalledWith(TOUR_STEPS[1].path);

    useOnboardingStore.getState().prevStep(navigate);
    expect(useOnboardingStore.getState().currentStep).toBe(0);
    expect(navigate).toHaveBeenCalledWith(TOUR_STEPS[0].path);
  });

  it('dismisses tour and sets localStorage item', () => {
    useOnboardingStore.setState({ isActive: true, currentStep: 1 });

    useOnboardingStore.getState().dismissTour();
    const state = useOnboardingStore.getState();

    expect(state.isActive).toBe(false);
    expect(state.hasDismissed).toBe(true);
    expect(localStorage.getItem('paySphere_onboarding_dismissed')).toBe('true');
  });

  it('resets tour state when resetTour() is called', () => {
    localStorage.setItem('paySphere_onboarding_completed', 'true');
    useOnboardingStore.setState({ hasCompleted: true, isActive: false });

    const navigate = vi.fn();
    useOnboardingStore.getState().resetTour(navigate);

    const state = useOnboardingStore.getState();
    expect(state.hasCompleted).toBe(false);
    expect(state.isActive).toBe(true);
    expect(state.currentStep).toBe(0);
    expect(localStorage.getItem('paySphere_onboarding_completed')).toBeNull();
  });
});
