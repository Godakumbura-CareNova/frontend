import React from 'react';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminReportsPage from './AdminReportsPage';
import * as api from '../services/adminReportService';
const auth = vi.hoisted(() => ({ user: { id: 'admin', role: 'Admin' }, token: 'token', isAuthenticated: true }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/adminReportService', async importOriginal => ({ ...await importOriginal(), loadMedicineReport: vi.fn(), loadAppointmentReport: vi.fn() }));
const medicine = { income: 100, buyingCost: 60, profit: 40, missingCostCount: 0, undatedSuccessfulCount: 0,
  days: [{ date: '2026-10-01', income: 100, buyingCost: 60, profit: 40 }] };
const appointment = { income: 500, count: 1, undatedSuccessfulCount: 0, days: [{ date: '2026-10-01', amount: 500, count: 1 }] };
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'admin', role: 'Admin' }; auth.token = 'token'; api.loadMedicineReport.mockResolvedValue(medicine); api.loadAppointmentReport.mockResolvedValue(appointment); });
const show = () => render(<MemoryRouter><AdminReportsPage /></MemoryRouter>);
it('shows separate medicine profit and consultation income graphs', async () => {
  show(); const meds = await screen.findByRole('region', { name: 'Medicine income and estimated profit' });
  await waitFor(() => expect(within(meds).getByText('Estimated gross profit', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/LKR.*40/));
  expect(screen.getByRole('img', { name: 'Medicine income, buying cost and estimated profit chart' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Total consultation fees collected chart' })).toBeInTheDocument();
  expect(screen.getByText(/pharmacy profit cannot be calculated/i)).toBeInTheDocument();
});
it('changes daily, weekly and monthly reporting periods', async () => {
  show(); await screen.findByRole('img', { name: 'Total consultation fees collected chart' }); const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Period'), 'weekly');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.loadMedicineReport.mock.calls.at(-1)[0].dates).toHaveLength(7));
  await user.selectOptions(screen.getByLabelText('Period'), 'daily'); await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.loadMedicineReport.mock.calls.at(-1)[0].dates).toHaveLength(1));
});
it('flags unknown cost and undated payments rather than inventing profit', async () => {
  api.loadMedicineReport.mockResolvedValue({ ...medicine, profit: null, missingCostCount: 1, undatedSuccessfulCount: 2, days: [{ ...medicine.days[0], profit: null }] });
  show(); expect(await screen.findByText(/1 paid order.*missing or unverifiable/i)).toBeInTheDocument();
  expect(screen.getByText(/2 successful medicine payments.*no confirmed date/i)).toBeInTheDocument();
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
});
it('keeps a healthy module visible when the other fails and allows retry', async () => {
  api.loadMedicineReport.mockRejectedValueOnce(new Error('offline')); show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Medicine report could not be loaded');
  expect(await screen.findByRole('img', { name: 'Total consultation fees collected chart' })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry medicine report' }));
  expect(await screen.findByRole('img', { name: 'Medicine income, buying cost and estimated profit chart' })).toBeInTheDocument();
});
it('denies non-admins without loading reports', () => {
  auth.user = { id: 'patient', role: 'Patient' }; show(); expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
  expect(api.loadMedicineReport).not.toHaveBeenCalled(); expect(api.loadAppointmentReport).not.toHaveBeenCalled();
});
it('ignores obsolete financial responses after switching A to B to A', async () => {
  let resolveOld;
  api.loadMedicineReport.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ ...medicine, profit: 20 }).mockResolvedValueOnce({ ...medicine, profit: 60 });
  const view = show();
  const profit = () => within(screen.getByRole('region', { name: 'Medicine income and estimated profit' }))
    .getByText('Estimated gross profit', { selector: 'dt' }).nextElementSibling;
  auth.user = { id: 'b', role: 'Admin' }; auth.token = 'b';
  view.rerender(<MemoryRouter><AdminReportsPage /></MemoryRouter>);
  await waitFor(() => expect(profit()).toHaveTextContent(/LKR.*20/));
  auth.user = { id: 'admin', role: 'Admin' }; auth.token = 'token';
  view.rerender(<MemoryRouter><AdminReportsPage /></MemoryRouter>);
  await waitFor(() => expect(profit()).toHaveTextContent(/LKR.*60/));
  await act(async () => resolveOld({ ...medicine, profit: 999 }));
  expect(profit()).toHaveTextContent(/LKR.*60/);
});
it('clears both financial sections if either module denies access', async () => {
  let rejectAppointment;
  api.loadAppointmentReport.mockReturnValueOnce(new Promise((_, reject) => { rejectAppointment = reject; }));
  show(); await screen.findByRole('img', { name: 'Medicine income, buying cost and estimated profit chart' });
  await act(async () => rejectAppointment({ response: { status: 403 } }));
  expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
