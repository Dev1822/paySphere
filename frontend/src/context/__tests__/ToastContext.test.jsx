import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider, useToast } from '../ToastContext';

let container = null;
let root = null;
import toast from 'react-hot-toast';

const TestComponent = () => {
  const { toast, addToast } = useToast();

  return (
    <div>
      <button id="btn-success" onClick={() => toast.success('Success message')}>
        Add Success
      </button>
      <button id="btn-error" onClick={() => toast.error('Error message')}>
        Add Error
      </button>
      <button id="btn-warning" onClick={() => toast.warning('Warning message')}>
        Add Warning
      </button>
      <button id="btn-info" onClick={() => toast.info('Info message')}>
        Add Info
      </button>
      <button
        id="btn-custom"
        onClick={() => addToast({ message: 'Custom Toast', duration: 0 })}
      >
        Add Persistent
      </button>
    </div>
  );
};

describe('ToastContext & ToastProvider', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia =
      window.matchMedia ||
      function () {
        return {
          matches: false,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        };
      };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    act(() => {
      toast.remove();
      vi.advanceTimersByTime(2000);
    });
    document.body.innerHTML = '';
    container = null;
    root = null;
    toast.remove();
    vi.useRealTimers();
  });

  test('renders children correctly', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <div id="test-child">Test Child</div>
        </ToastProvider>,
      );
    });

    expect(container.querySelector('#test-child')?.textContent).toBe(
      'Test Child',
    );
  });

  test('allows adding toasts via useToast helper methods', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );
    });

    const btnSuccess = container.querySelector('#btn-success');
    act(() => {
      btnSuccess.click();
    });
    expect(document.body.textContent).toContain('Success message');

    const btnError = container.querySelector('#btn-error');
    act(() => {
      btnError.click();
    });
    expect(document.body.textContent).toContain('Error message');
  });

  test('stacks multiple notifications simultaneously', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );
    });

    act(() => {
      container.querySelector('#btn-success').click();
      container.querySelector('#btn-error').click();
      container.querySelector('#btn-warning').click();
    });

    expect(document.body.textContent).toContain('Success message');
    expect(document.body.textContent).toContain('Error message');
    expect(document.body.textContent).toContain('Warning message');
  });

  test('handles manual removal via toast.remove / toast.dismiss', () => {
    let toastControls = null;
    const DismissTest = () => {
      const { toast } = useToast();
      toastControls = toast;
      return <div>Test</div>;
    };

    act(() => {
      root.render(
        <ToastProvider>
          <DismissTest />
        </ToastProvider>,
      );
    });

    let toastId = null;
    act(() => {
      toastId = toastControls.success('Dismiss me');
    });

    expect(document.body.textContent).toContain('Dismiss me');

    act(() => {
      toastControls.remove(toastId);
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(document.body.textContent).not.toContain('Dismiss me');
  });

  test('auto-dismisses toasts after duration', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );
    });

    act(() => {
      container.querySelector('#btn-success').click();
    });
    expect(document.body.textContent).toContain('Success message');

    act(() => {
      vi.advanceTimersByTime(5100);
    });

    expect(document.body.textContent).not.toContain('Success message');
  });

  test('listens to global window toast:show events', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>,
      );
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('toast:show', {
          detail: { message: 'Global Custom Event Toast', type: 'success' },
        }),
      );
    });

    expect(document.body.textContent).toContain('Global Custom Event Toast');
  });
});
