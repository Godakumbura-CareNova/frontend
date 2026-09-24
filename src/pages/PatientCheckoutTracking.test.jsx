import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { money, statusLabel, OrderItems } from './orderPresentation';
import PatientCheckoutPage from './PatientCheckoutPage';
import PatientOrderDetailsPage from './PatientOrderDetailsPage';

// GCN-31 checkout & order tracking — Vitest component/helper tests.

const api = vi.hoisted(() => ({ review: vi.fn(), place: vi.fn(), list: vi.fn(), get: vi.fn() }));
vi.mock('../api/orderApi', () => ({ orderApi: api }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'patient-qa' } }) }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const payments = vi.hoisted(() => ({ getMedicinePaymentMethods: vi.fn(), getMedicinePaymentOptions: vi.fn(), selectMedicinePaymentMethod: vi.fn(), getMedicinePayment: vi.fn() }));
vi.mock('../services/paymentService', () => payments);
const paymentMethods = ['Online', 'BankTransfer', 'Cash'].map((method) => ({ method, label: method === 'BankTransfer' ? 'Bank transfer' : method === 'Online' ? 'Online payment' : 'Cash', description: '', available: true, unavailableReason: null }));

const ibuprofen = { cartItemId: 1, medicineName: 'Ibuprofen', quantity: 2, unitPrice: 200, lineTotal: 400 };
const paracetamol = { cartItemId: 2, medicineName: 'Paracetamol', quantity: 5, unitPrice: 20, lineTotal: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('order presentation helpers', () => {
  it('formats money as LKR with two decimals and maps every order status to a label', () => {
    expect(money(400)).toBe('LKR 400.00');
    expect(money('99.5')).toBe('LKR 99.50');
    expect(money(undefined)).toBe('LKR 0.00');

    expect(statusLabel('Pending')).toBe('Pending');
    expect(statusLabel('ReadyForCollection')).toBe('Ready for Collection');
    expect(statusLabel('Collected')).toBe('Collected');
    expect(statusLabel('Rejected')).toBe('Rejected');
    expect(statusLabel('SomethingNew')).toBe('SomethingNew');
  });

  it('renders each order line with quantity, unit price, line total and the grand total', () => {
    render(<OrderItems items={[ibuprofen, paracetamol]} totalAmount={500} />);

    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Quantity: 2')).toBeInTheDocument();
    expect(screen.getByText('Quantity: 5')).toBeInTheDocument();
    expect(screen.getByText('LKR 200.00 each')).toBeInTheDocument();
    expect(screen.getByText('LKR 400.00')).toBeInTheDocument();
    expect(screen.getByText('LKR 100.00')).toBeInTheDocument();
    expect(screen.getByText('LKR 500.00')).toBeInTheDocument();
  });
});

describe('checkout and order tracking pages', () => {
  it('shows the server message when the order is rejected with a conflict', async () => {
    api.review.mockResolvedValue({ data: { items: [ibuprofen], totalAmount: 400 } });
    api.place.mockRejectedValue({
      response: { status: 409, data: { message: 'Insufficient stock for Ibuprofen. Please update your cart.' } },
    });

    payments.getMedicinePaymentMethods.mockResolvedValue({ data: paymentMethods });

    render(<MemoryRouter><PatientCheckoutPage /></MemoryRouter>);
    fireEvent.click(await screen.findByLabelText(/^Cash/));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and place order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByText(/Insufficient stock for Ibuprofen/)).toBeInTheDocument();
    expect(payments.selectMedicinePaymentMethod).not.toHaveBeenCalled();
    expect(screen.queryByText('Order placed successfully')).not.toBeInTheDocument();
    expect(api.place).toHaveBeenCalledTimes(1);
  });

  it('shows order number, readable status, pickup note and items on the tracking page', async () => {
    api.get.mockResolvedValue({
      data: {
        id: 7,
        orderNumber: 'CN-000007',
        status: 'ReadyForCollection',
        totalAmount: 500,
        rejectionReason: null,
        items: [ibuprofen, paracetamol],
      },
    });

    render(
      <MemoryRouter initialEntries={['/patient/orders/7']}>
        <Routes><Route path="/patient/orders/:orderId" element={<PatientOrderDetailsPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Order CN-000007' })).toBeInTheDocument();
    expect(screen.getByText('Ready for Collection')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy pickup')).toBeInTheDocument(); // GCN-32 split the label and value
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('LKR 500.00')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('7');
  });
});
