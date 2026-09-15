import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PharmacyOrderManagementPage from './PharmacyOrderManagementPage';
import PharmacyPrescriptionReviewPage from './PharmacyPrescriptionReviewPage';

// GCN-32 pharmacy order review — Vitest component tests for the staff workspace pages.

const orders = vi.hoisted(() => ({ listActive: vi.fn(), updateStatus: vi.fn() }));
const prescriptions = vi.hoisted(() => ({ listPending: vi.fn(), decide: vi.fn(), download: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/staffOrderApi', () => ({ staffOrderApi: orders }));
vi.mock('../api/staffPrescriptionApi', () => ({ staffPrescriptionApi: prescriptions }));

const pendingOrder = { id: 5, orderNumber: 'CN-000005', status: 'Pending', totalAmount: 4200, items: [{ medicineName: 'Gaviscon', quantity: 2, unitPrice: 2100 }] };
const readyOrder = { id: 6, orderNumber: 'CN-000006', status: 'ReadyForCollection', totalAmount: 2100, items: [{ medicineName: 'Gaviscon', quantity: 1, unitPrice: 2100 }] };

beforeEach(() => vi.clearAllMocks());

describe('PharmacyOrderManagementPage (GCN-32)', () => {
  it('marks a pending order ready for collection and reloads the queue', async () => {
    const user = userEvent.setup();
    orders.listActive
      .mockResolvedValueOnce({ data: [pendingOrder] })
      .mockResolvedValueOnce({ data: [{ ...pendingOrder, status: 'ReadyForCollection' }] });
    orders.updateStatus.mockResolvedValue({ data: {} });

    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Mark ready for collection' }));

    await waitFor(() => expect(orders.updateStatus).toHaveBeenCalledWith(5, { status: 'ReadyForCollection' }));
    expect(await screen.findByRole('button', { name: 'Mark collected' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject order' })).not.toBeInTheDocument();
    expect(orders.listActive).toHaveBeenCalledTimes(2);
  });

  it('marks a ready order as collected and only offers collection for ready orders', async () => {
    const user = userEvent.setup();
    orders.listActive.mockResolvedValueOnce({ data: [readyOrder] }).mockResolvedValueOnce({ data: [] });
    orders.updateStatus.mockResolvedValue({ data: {} });

    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    expect(await screen.findByText('CN-000006')).toBeInTheDocument();
    expect(screen.getByText('ReadyForCollection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark ready for collection' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark collected' }));

    await waitFor(() => expect(orders.updateStatus).toHaveBeenCalledWith(6, { status: 'Collected' }));
    expect(await screen.findByText('No orders need pharmacy action.')).toBeInTheDocument();
  });

  it('shows an error with retry when the queue or a status change fails', async () => {
    const user = userEvent.setup();
    orders.listActive.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ data: [pendingOrder] });
    orders.updateStatus.mockRejectedValue({ response: { status: 409 } });

    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load medicine orders.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('CN-000005')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark ready for collection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to update this order. Please try again.');
  });
});

describe('PharmacyPrescriptionReviewPage (GCN-32)', () => {
  it('verifies a prescription and only enables rejection once a reason is typed', async () => {
    const user = userEvent.setup();
    const item = { id: 9, originalFileName: 'rx.pdf', medicineName: 'Amoxicillin', quantity: 1, status: 'PendingVerification' };
    prescriptions.listPending.mockResolvedValueOnce({ data: [item] }).mockResolvedValue({ data: [] });
    prescriptions.decide.mockResolvedValue({ data: {} });

    render(<MemoryRouter><PharmacyPrescriptionReviewPage /></MemoryRouter>);
    expect(await screen.findByText('rx.pdf')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin × 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const confirm = screen.getByRole('button', { name: 'Confirm rejection' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Rejection reason'), 'Unreadable scan');
    expect(confirm).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Rejection reason')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify prescription' }));
    await waitFor(() => expect(prescriptions.decide).toHaveBeenCalledWith(9, { decision: 'Verified', reason: undefined }));
    expect(await screen.findByText('No prescriptions are waiting for verification.')).toBeInTheDocument();
  });
});
