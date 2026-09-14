import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PharmacyOrderManagementPage from './PharmacyOrderManagementPage';

const { listActive, updateStatus } = vi.hoisted(() => ({ listActive: vi.fn(), updateStatus: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/staffOrderApi', () => ({ staffOrderApi: { listActive, updateStatus } }));

describe('PharmacyOrderManagementPage', () => {
  it('shows only actionable pharmacy orders', async () => {
    listActive.mockResolvedValue({ data: [{ id: 3, orderNumber: 'CN-000003', status: 'Pending', totalAmount: 600, items: [{ medicineName: 'Amoxicillin', quantity: 2, unitPrice: 300 }] }] });
    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    expect(await screen.findByText('CN-000003')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin × 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark ready for collection' })).toBeInTheDocument();
    expect(screen.getByText('CN-000003').closest('article')).toHaveClass('staff-order-card');
  });

  it('requires a reason before rejecting an order', async () => {
    const user = userEvent.setup();
    listActive.mockResolvedValue({ data: [{ id: 3, orderNumber: 'CN-000003', status: 'Pending', totalAmount: 600, items: [] }] });
    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Reject order' }));
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(updateStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Provide a rejection reason.')).toBeInTheDocument();
  });

  it('submits a rejection reason for a pending order', async () => {
    const user = userEvent.setup();
    listActive.mockResolvedValue({ data: [{ id: 3, orderNumber: 'CN-000003', status: 'Pending', totalAmount: 600, items: [] }] });
    updateStatus.mockResolvedValue({ data: {} });
    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Reject order' }));
    await user.type(screen.getByLabelText('Rejection reason'), 'Medicine is unavailable');
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(3, { status: 'Rejected', reason: 'Medicine is unavailable' }));
  });
});
