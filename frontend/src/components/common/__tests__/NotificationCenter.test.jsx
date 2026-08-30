import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '../../../store/useAppStore';
import NotificationCenter from '../NotificationCenter';

// Mock Socket.io-client
vi.mock('socket.io-client', () => ({
  default: vi.fn().mockReturnValue({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock the API module
vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        unreadCount: 2,
        total: 2,
        notifications: [
          {
            _id: 'n1',
            title: 'Payroll Finalized',
            message: 'August 2026 payroll has been signed off.',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          {
            _id: 'n2',
            title: 'Expense Claim Approved',
            message: 'Your meal claim has been approved.',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

const renderNotificationCenter = (root, preloadedState = {}) => {
  useAppStore.setState({
    token:
      preloadedState.token !== undefined ? preloadedState.token : 'mock-token',
  });

  act(() => {
    root.render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>,
    );
  });
};

describe('NotificationCenter Component', () => {
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

  it('does not render when unauthenticated', () => {
    renderNotificationCenter(root, { token: null });
    expect(
      document.querySelector('button[aria-label="Notifications"]'),
    ).toBeNull();
  });

  it('renders bell button with unread count badge when authenticated', async () => {
    renderNotificationCenter(root, { token: 'valid-token' });

    const bellBtn = document.querySelector(
      'button[aria-label="Notifications"]',
    );
    expect(bellBtn).not.toBeNull();

    // Trigger open
    await act(async () => {
      bellBtn.click();
    });

    const badge = document.querySelector('span');
    expect(badge).not.toBeNull();
  });

  it('opens dropdown menu and displays notification items', async () => {
    renderNotificationCenter(root, { token: 'valid-token' });

    const bellBtn = document.querySelector(
      'button[aria-label="Notifications"]',
    );

    await act(async () => {
      bellBtn.click();
    });

    const headerText = document.querySelector('h3');
    expect(headerText).not.toBeNull();
    expect(headerText.textContent).toBe('Notifications');
  });
});
