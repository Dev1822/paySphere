import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { MemoryRouter } from 'react-router-dom';
import OnboardingTooltip from '../OnboardingTooltip';
import { useOnboardingStore, TOUR_STEPS } from '../../../store/useOnboardingStore';

expect.extend(matchers);

const renderWithRouter = (ui) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('OnboardingTooltip Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({
      isActive: false,
      currentStep: 0,
      hasCompleted: false,
      hasDismissed: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render when tour is inactive', () => {
    renderWithRouter(<OnboardingTooltip />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders tour card and step info when active', () => {
    useOnboardingStore.setState({ isActive: true, currentStep: 0 });

    renderWithRouter(<OnboardingTooltip />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(TOUR_STEPS[0].content)).toBeInTheDocument();
  });

  it('navigates to next step on Next button click', () => {
    useOnboardingStore.setState({ isActive: true, currentStep: 0 });

    renderWithRouter(<OnboardingTooltip />);
    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);

    expect(useOnboardingStore.getState().currentStep).toBe(1);
  });

  it('dismisses tour on close button click', () => {
    useOnboardingStore.setState({ isActive: true, currentStep: 0 });

    renderWithRouter(<OnboardingTooltip />);
    const closeBtn = screen.getByRole('button', { name: /skip tour/i });
    fireEvent.click(closeBtn);

    expect(useOnboardingStore.getState().isActive).toBe(false);
    expect(useOnboardingStore.getState().hasDismissed).toBe(true);
  });

  it('dismisses tour when Escape key is pressed', () => {
    useOnboardingStore.setState({ isActive: true, currentStep: 0 });

    renderWithRouter(<OnboardingTooltip />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(useOnboardingStore.getState().isActive).toBe(false);
  });

  it('navigates through steps using step dots', () => {
    useOnboardingStore.setState({ isActive: true, currentStep: 0 });

    renderWithRouter(<OnboardingTooltip />);
    const step3Dot = screen.getByRole('button', { name: /go to step 3/i });
    fireEvent.click(step3Dot);

    expect(useOnboardingStore.getState().currentStep).toBe(2);
  });
});
