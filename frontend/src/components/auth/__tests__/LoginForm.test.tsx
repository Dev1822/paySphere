import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../LoginForm';

describe('LoginForm Component (TypeScript)', () => {
  it('renders login form fields correctly', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByText('Welcome back')).toBeDefined();
    expect(screen.getByPlaceholderText('name@company.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
    expect(screen.getByText('Sign In')).toBeDefined();
  });

  it('displays validation errors on empty submit', () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    const submitBtn = screen.getByText('Sign In');
    fireEvent.click(submitBtn);

    expect(screen.getByText('Email address is required')).toBeDefined();
    expect(screen.getByText('Password is required')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits form when email and password are provided', () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'alex@company.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'SecurePass123!' },
    });

    const submitBtn = screen.getByText('Sign In');
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alex@company.com',
        password: 'SecurePass123!',
        rememberMe: false,
      })
    );
  });

  it('switches to forgot password mode and triggers handler', () => {
    const onForgotPassword = vi.fn();
    render(<LoginForm onSubmit={vi.fn()} onForgotPassword={onForgotPassword} />);

    const forgotBtn = screen.getByText('Forgot Password?');
    fireEvent.click(forgotBtn);

    expect(screen.getByText('Reset Password')).toBeDefined();

    const forgotInput = screen.getByPlaceholderText('name@company.com');
    fireEvent.change(forgotInput, {
      target: { value: 'user@domain.com' },
    });

    const sendLinkBtn = screen.getByText('Send Reset Link');
    fireEvent.click(sendLinkBtn);

    expect(onForgotPassword).toHaveBeenCalledWith('user@domain.com');
  });
});
