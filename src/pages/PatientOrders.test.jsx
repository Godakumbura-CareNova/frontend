import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PatientCheckoutPage from './PatientCheckoutPage';
import PatientOrdersPage from './PatientOrdersPage';
import PatientOrderDetailsPage from './PatientOrderDetailsPage';

const api = vi.hoisted(() => ({ review: vi.fn(), place: vi.fn(), list: vi.fn(), get: vi.fn() }));
vi.mock('../api/orderApi', () => ({ orderApi: api }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'patient-one' } }) }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const item = { cartItemId: 1, medicineName: 'Ibuprofen', quantity: 2, unitPrice: 200, lineTotal: 400 };
const order = { id: 12, orderNumber: 'CN-000012', status: 'Pending', totalAmount: 400, items: [item] };
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); api.review.mockResolvedValue({ data: { items: [item], totalAmount: 400 } }); });
it('reviews pickup items then confirms the saved order', async () => {
  api.place.mockResolvedValue({ data: order });
  render(<MemoryRouter><PatientCheckoutPage /></MemoryRouter>);
  expect(await screen.findByText('Ibuprofen')).toBeInTheDocument();
  expect(screen.getByText('Pharmacy pickup')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and place order' }));
  expect(await screen.findByText('Order placed successfully')).toBeInTheDocument();
  expect(api.place.mock.calls[0][0].items).toEqual([{ cartItemId: 1, quantity: 2, unitPrice: 200 }]);
});
it('retains the exact request after an uncertain failure and reload', async () => {
  api.place.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: order });
  const first = render(<MemoryRouter><PatientCheckoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm and place order' }));
  await screen.findByRole('button', { name: 'Retry order placement' });
  const submitted = api.place.mock.calls[0][0];
  first.unmount();
  render(<MemoryRouter><PatientCheckoutPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry order placement' }));
  await screen.findByText('Order placed successfully');
  expect(api.place.mock.calls[1][0]).toEqual(submitted);
  expect(api.review).toHaveBeenCalledTimes(1);
});
it('blocks checkout with no ready items', async () => {
  api.review.mockResolvedValue({ data: { items: [], totalAmount: 0 } });
  render(<MemoryRouter><PatientCheckoutPage /></MemoryRouter>);
  expect(await screen.findByText('No medicines are ready to order yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm and place order' })).not.toBeInTheDocument();
});
it('blocks a fresh request if persisted checkout cannot be recovered', async () => {
  sessionStorage.setItem('carenova-checkout:patient-one', '{invalid');
  render(<MemoryRouter><PatientCheckoutPage /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'View My orders' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry loading checkout' })).not.toBeInTheDocument();
  expect(api.review).not.toHaveBeenCalled();
});
it('shows history with readable status and order links', async () => {
  api.list.mockResolvedValue({ data: [{ ...order, status: 'ReadyForCollection' }] });
  render(<MemoryRouter><PatientOrdersPage /></MemoryRouter>);
  expect(await screen.findByText('Ready for Collection')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'CN-000012' })).toHaveAttribute('href', '/patient/orders/12');
});
it('shows rejection reason and saved item quantity', async () => {
  api.get.mockResolvedValue({ data: { ...order, status: 'Rejected', rejectionReason: 'Unavailable' } });
  render(<MemoryRouter initialEntries={['/patient/orders/12']}><Routes><Route path='/patient/orders/:orderId' element={<PatientOrderDetailsPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Unavailable')).toBeInTheDocument();
  expect(screen.getByText('Quantity: 2')).toBeInTheDocument();
});
