import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOUR_STEPS, useOnboardingStore } from '../../store/useOnboardingStore';
import './OnboardingTooltip.css';

export default function OnboardingTooltip() {
  const navigate = useNavigate();
  const isActive = useOnboardingStore((state) => state.isActive);
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const prevStep = useOnboardingStore((state) => state.prevStep);
  const dismissTour = useOnboardingStore((state) => state.dismissTour);
  const goToStep = useOnboardingStore((state) => state.goToStep);

  const [targetRect, setTargetRect] = useState(null);
  const cardRef = useRef(null);

  const step = TOUR_STEPS[currentStep] || TOUR_STEPS[0];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Find target element and compute bounding rect
  const updateTargetPosition = useCallback(() => {
    if (!isActive || !step) return;

    const selectors = step.target.split(',').map((s) => s.trim());
    let element = null;

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        element = el;
        break;
      }
    }

    if (element) {
      // Scroll element into view smoothly if needed
      const rect = element.getBoundingClientRect();
      const isVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth;

      if (!isVisible) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const updatedRect = element.getBoundingClientRect();
      setTargetRect({
        top: updatedRect.top,
        left: updatedRect.left,
        width: updatedRect.width,
        height: updatedRect.height,
        bottom: updatedRect.bottom,
        right: updatedRect.right,
      });
    } else {
      setTargetRect(null);
    }
  }, [isActive, step]);

  useEffect(() => {
    if (!isActive) return;

    updateTargetPosition();
    // Re-check target element position on resize & scroll
    const timer = setTimeout(updateTargetPosition, 300);
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
    };
  }, [isActive, currentStep, updateTargetPosition]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        dismissTour();
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && e.target.tagName !== 'BUTTON')) {
        nextStep(navigate);
      } else if (e.key === 'ArrowLeft') {
        prevStep(navigate);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, dismissTour, nextStep, prevStep, navigate]);

  if (!isActive || !step) return null;

  // Compute card position relative to target element or screen center
  const padding = 8;
  const cardWidth = 360;
  const cardHeight = 220;

  let cardStyle = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let topPos = targetRect.bottom + padding + 12;
    if (spaceBelow < cardHeight + 20 && spaceAbove > cardHeight + 20) {
      topPos = Math.max(16, targetRect.top - cardHeight - padding - 12);
    }

    let leftPos = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    // Boundary checks
    leftPos = Math.max(16, Math.min(leftPos, window.innerWidth - cardWidth - 16));

    cardStyle = {
      top: `${topPos}px`,
      left: `${leftPos}px`,
      transform: 'none',
    };
  }

  return (
    <div className="onboarding-tour-root" role="dialog" aria-modal="true" aria-label="Onboarding Tour">
      {/* SVG Backdrop Cutout Spotlight */}
      <svg className="onboarding-overlay-svg" onClick={() => dismissTour()}>
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.75)"
          mask="url(#onboarding-spotlight-mask)"
        />
      </svg>

      {/* Pulsing Outline Highlight Box */}
      {targetRect && (
        <div
          className="onboarding-highlight-box"
          style={{
            top: `${targetRect.top - padding}px`,
            left: `${targetRect.left - padding}px`,
            width: `${targetRect.width + padding * 2}px`,
            height: `${targetRect.height + padding * 2}px`,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        ref={cardRef}
        className="onboarding-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-left"
        style={cardStyle}
      >
        {/* Header Badge & Close */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            onClick={() => dismissTour()}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            aria-label="Skip tour"
            title="Skip tour (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Step Title & Description */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 leading-relaxed">
          {step.content}
        </p>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-4">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => goToStep(idx, navigate)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-blue-600 dark:bg-blue-500'
                    : 'w-2 bg-gray-300 dark:bg-slate-700 hover:bg-gray-400'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevStep(navigate)}
              disabled={isFirstStep}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isFirstStep
                  ? 'opacity-40 cursor-not-allowed text-gray-400 dark:text-slate-600'
                  : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              Back
            </button>

            <button
              onClick={() => nextStep(navigate)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95"
            >
              {isLastStep ? 'Finish Tour' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
