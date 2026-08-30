import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from '../SettingsPanel';

describe('SettingsPanel Component', () => {
  it('renders settings tabs and fields correctly', () => {
    render(<SettingsPanel onSave={vi.fn()} />);

    expect(screen.getByText('Organization & System Settings')).toBeDefined();
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Payroll & Fiscal')).toBeDefined();
    expect(screen.getByText('Security & MFA')).toBeDefined();
    expect(screen.getByText('Attendance & TOIL')).toBeDefined();
    expect(screen.getByDisplayValue('PaySphere Enterprise')).toBeDefined();
  });

  it('switches between configuration tabs', () => {
    render(<SettingsPanel onSave={vi.fn()} />);

    const payrollTab = screen.getByText('Payroll & Fiscal');
    fireEvent.click(payrollTab);
    expect(screen.getByText('Fiscal Year Start Month')).toBeDefined();

    const securityTab = screen.getByText('Security & MFA');
    fireEvent.click(securityTab);
    expect(
      screen.getByText('Enforce Multi-Factor Authentication (MFA)'),
    ).toBeDefined();

    const attendanceTab = screen.getByText('Attendance & TOIL');
    fireEvent.click(attendanceTab);
    expect(screen.getByText('Biometric & Geo-Fence Clock-In')).toBeDefined();
  });

  it('calls onSave with updated configuration', () => {
    const onSave = vi.fn();
    render(<SettingsPanel onSave={onSave} />);

    const nameInput = screen.getAllByDisplayValue('PaySphere Enterprise')[0];
    fireEvent.change(nameInput, {
      target: { name: 'companyName', value: 'Global Horizon Tech' },
    });

    const saveBtn = screen.getAllByText('Save Configuration')[0];
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Global Horizon Tech',
      }),
    );
  });
});
