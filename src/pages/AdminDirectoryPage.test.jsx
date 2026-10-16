import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminDirectoryPage from './AdminDirectoryPage';
import { loadAdminDirectory } from '../services/adminDirectoryService';
const auth = vi.hoisted(() => ({ user: { id: 'admin', role: 'Admin' }, token: 'token', isAuthenticated: true }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/adminDirectoryService', () => ({ loadAdminDirectory: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'admin', role: 'Admin' }; auth.token = 'token'; });
const result = items => ({ items, totalCount: items.length, totalPages: 1, warning: null });
const show = kind => render(<MemoryRouter><AdminDirectoryPage kind={kind} /></MemoryRouter>);
it('shows doctor contact and inactive status with no mutation controls', async () => {
  loadAdminDirectory.mockResolvedValue(result([{ id: 'd', fullName: 'Dr Green', email: 'doctor@example.test', mobileNumber: '0771234567', isActive: false }]));
  show('doctors'); expect(await screen.findByText('Dr Green')).toBeInTheDocument();
  expect(screen.getByText('Inactive')).toBeInTheDocument(); expect(screen.getByText('0771234567')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /edit|delete|activate/i })).not.toBeInTheDocument();
});
it('shows medicine category, price, zero stock and inactive status', async () => {
  loadAdminDirectory.mockResolvedValue(result([{ id: 1, name: 'Medicine A', categoryName: 'Pain relief', price: 100, stockQuantity: 0, isActive: false, prescriptionRequired: true }]));
  show('medicines'); expect(await screen.findByText('Medicine A')).toBeInTheDocument();
  expect(screen.getByText('Pain relief')).toBeInTheDocument(); expect(screen.getByText('Out of stock')).toBeInTheDocument();
  expect(screen.getByText('Inactive')).toBeInTheDocument();
});
it('shows appointment patient, doctor and unavailable payment plus lookup warning', async () => {
  loadAdminDirectory.mockResolvedValue({ ...result([{ id: 1, reference: 'APT-1', doctorName: 'Dr Green', patientName: 'Patient One',
    startUtc: '2026-10-12T06:00:00Z', status: 'Booked', paymentMethod: null, paymentStatus: null }]), warning: 'Some patient names are unavailable.' });
  show('appointments'); expect(await screen.findByText('Patient One')).toBeInTheDocument();
  expect(screen.getByText('APT-1')).toBeInTheDocument(); expect(screen.getByText(/Some patient names/)).toBeInTheDocument();
  expect(screen.getByText('Dr Green')).toBeInTheDocument();
});
it('preserves appointment paging and search, and clears back to page one', async () => {
  loadAdminDirectory.mockResolvedValue({ ...result([{ id: 1, reference: 'APT-1', doctorName: 'Dr Green', patientName: 'Patient One', startUtc: '2026-10-12T06:00:00Z', status: 'Cancelled', paymentMethod: 'PaymentGateway', paymentStatus: 'Failed' }]), totalCount: 21, totalPages: 2 });
  show('appointments'); await screen.findByText('APT-1');
  expect(screen.getByText('Cancelled')).toBeInTheDocument();
  expect(screen.getByText('Failed')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(loadAdminDirectory).toHaveBeenLastCalledWith('appointments', expect.objectContaining({ page: 2 })));
  await userEvent.type(screen.getByRole('searchbox'), 'Green');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(loadAdminDirectory).toHaveBeenLastCalledWith('appointments', expect.objectContaining({ page: 1, search: 'Green' })));
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('searchbox')).toHaveFocus();
  await waitFor(() => expect(loadAdminDirectory).toHaveBeenLastCalledWith('appointments', expect.objectContaining({ page: 1, search: '' })));
});
it('searches, pages, resets page for new search and refreshes without losing criteria', async () => {
  loadAdminDirectory.mockResolvedValue({ ...result([{ id: 1, name: 'Medicine A', price: 1, stockQuantity: 1, isActive: true }]), totalCount: 21, totalPages: 2 });
  show('medicines'); await screen.findByText('Medicine A'); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(loadAdminDirectory).toHaveBeenLastCalledWith('medicines', expect.objectContaining({ page: 2, search: '' })));
  await user.type(screen.getByRole('searchbox'), 'Pain'); await user.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(loadAdminDirectory).toHaveBeenLastCalledWith('medicines', expect.objectContaining({ page: 1, search: 'Pain' })));
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(loadAdminDirectory).toHaveBeenLastCalledWith('medicines', expect.objectContaining({ page: 1, search: 'Pain' }));
});
it('shows failure rather than false empty state and allows retry', async () => {
  loadAdminDirectory.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result([])); show('doctors');
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  expect(screen.queryByText(/No doctors found/)).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' })); expect(await screen.findByText('No doctors found.')).toBeInTheDocument();
});
it('denies non-admins without issuing directory requests', async () => {
  auth.user = { id: 'patient', role: 'Patient' }; show('doctors');
  expect(screen.getByRole('alert')).toHaveTextContent('Access denied'); expect(loadAdminDirectory).not.toHaveBeenCalled();
});
it('ignores old account responses after switching A to B to A', async () => {
  let resolveOld;
  loadAdminDirectory.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(result([{ id: 'b', fullName: 'Doctor B', isActive: true }]))
    .mockResolvedValueOnce(result([{ id: 'a', fullName: 'Doctor A current', isActive: true }]));
  const view = show('doctors');
  auth.user = { id: 'b', role: 'Admin' }; auth.token = 'token-b';
  view.rerender(<MemoryRouter><AdminDirectoryPage kind="doctors" /></MemoryRouter>);
  expect(await screen.findByText('Doctor B')).toBeInTheDocument();
  auth.user = { id: 'admin', role: 'Admin' }; auth.token = 'token';
  view.rerender(<MemoryRouter><AdminDirectoryPage kind="doctors" /></MemoryRouter>);
  expect(screen.queryByText('Doctor B')).not.toBeInTheDocument();
  expect(await screen.findByText('Doctor A current')).toBeInTheDocument();
  resolveOld(result([{ id: 'old', fullName: 'Doctor A obsolete', isActive: true }]));
  await waitFor(() => expect(screen.queryByText('Doctor A obsolete')).not.toBeInTheDocument());
});
