import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '../../../store/useAppStore';
import OnboardingTour from '../OnboardingTour';

const renderOnboardingTour = (root, preloadedState = {}) => {
  useAppStore.setState({
    token:
      preloadedState.token !== undefined ? preloadedState.token : 'mock-token',
  });

  act(() => {
    root.render(
      <MemoryRouter>
        <OnboardingTour />
      </MemoryRouter>,
    );
  });
};

describe('OnboardingTour', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('does not render when user is not authenticated', () => {
    renderOnboardingTour(root, { token: null });
    expect(document.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('renders and auto-starts for first-time login when paysphere_tour_completed is absent', () => {
    renderOnboardingTour(root, { token: 'mock-token' });

    const tourHeading = document.querySelector('h3');
    expect(tourHeading).not.toBeNull();
    expect(tourHeading.textContent).toContain('Welcome to PaySphere!');
  });

  it('saves completed flag to localStorage when Skip Tour is clicked', () => {
    renderOnboardingTour(root, { token: 'mock-token' });

    const skipButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Skip Tour',
    );
    expect(skipButton).not.toBeNull();

    act(() => {
      skipButton.click();
    });

    expect(localStorage.getItem('paysphere_tour_completed')).toBe('true');
  });

  it('progresses to the next step when Next Step is clicked', () => {
    renderOnboardingTour(root, { token: 'mock-token' });

    const nextButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent.includes('Next Step'),
    );

    act(() => {
      nextButton.click();
    });

    const tourHeading = document.querySelector('h3');
    expect(tourHeading.textContent).toContain('My Employee Portal');
  });
});
