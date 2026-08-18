import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '../../../store/useAppStore';
import CommandPalette from '../CommandPalette';

// Mock ResizeObserver for JSDOM
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock the API module
vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        employees: [
          { _id: 'emp1', fullName: 'John Doe', role: 'Developer' },
          { _id: 'emp2', fullName: 'Jane Smith', role: 'Designer' },
        ],
      },
    }),
  },
}));

const renderCommandPalette = (root, preloadedState = {}) => {
  useAppStore.setState({
    token: preloadedState.token || 'mock-token',
    toggleTheme: preloadedState.toggleTheme || vi.fn(),
    logout: preloadedState.logout || vi.fn(),
  });

  act(() => {
    root.render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
  });
};

describe('CommandPalette', () => {
  let container;
  let root;

  beforeEach(() => {
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

  it('does not render when token is absent', () => {
    renderCommandPalette(root, { token: null });
    expect(container.firstChild).toBeNull();
  });

  it('renders and opens when token is present and Ctrl+K is pressed', () => {
    renderCommandPalette(root, { token: 'valid-token' });

    // Command palette should be closed initially
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // Trigger Ctrl+K keydown event
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    // Command palette should now be open
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Command palette');
  });

  it('closes when Escape key is pressed', () => {
    renderCommandPalette(root, { token: 'valid-token' });

    // Open it
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // Press Escape
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('toggles the theme when Toggle Theme action is clicked', () => {
    const toggleThemeMock = vi.fn();
    renderCommandPalette(root, {
      token: 'valid-token',
      toggleTheme: toggleThemeMock,
    });

    // Open it
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    const input = document.querySelector('input');
    expect(input).not.toBeNull();

    // Type "Theme" to filter the items, bypassing React's setter override
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set;
    act(() => {
      nativeInputValueSetter.call(input, 'Theme');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Press Enter to select the action
    act(() => {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      input.dispatchEvent(enterEvent);
    });

    expect(toggleThemeMock).toHaveBeenCalled();
  });
});
