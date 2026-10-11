import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useRoleDashboard } from './useRoleDashboard';
import * as service from '../services/roleDashboardService';
const { auth } = vi.hoisted(() => ({ auth: { current: null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('../services/roleDashboardService', () => ({ getPatientOrderDashboard: vi.fn(), getPatientMedicinePaymentDashboard: vi.fn(), getPatientAppointmentDashboard: vi.fn(), getStaffOperationsDashboard: vi.fn(), getStaffMedicinePaymentDashboard: vi.fn(), getStaffAppointmentPaymentDashboard: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); auth.current = { user: { userId: 'A', role: 'Patient' }, token: 'A' };
  service.getPatientOrderDashboard.mockResolvedValue({ totalCount: 1 });
  service.getPatientMedicinePaymentDashboard.mockResolvedValue({ statusCounts: {} });
  service.getPatientAppointmentDashboard.mockRejectedValue(new Error('Unavailable'));
});
it('keeps healthy sections and retries only the failed section', async () => {
  const { result } = renderHook(() => useRoleDashboard('Patient'));
  await waitFor(() => expect(result.current.sections.appointments.error).toBeTruthy());
  expect(result.current.sections.orders.data.totalCount).toBe(1);
  service.getPatientAppointmentDashboard.mockResolvedValue({ upcomingCount: 2 });
  act(() => result.current.refreshSection('appointments'));
  await waitFor(() => expect(result.current.sections.appointments.data.upcomingCount).toBe(2));
  expect(service.getPatientOrderDashboard).toHaveBeenCalledTimes(1);
});
it('does not request private summaries for visitors or another role', () => {
  auth.current = { user: null, token: null };
  const { rerender } = renderHook(() => useRoleDashboard('Patient'));
  auth.current = { user: { userId: 'D', role: 'Doctor' }, token: 'D' }; rerender();
  expect(service.getPatientOrderDashboard).not.toHaveBeenCalled();
});
it('clears personal data and ignores responses from an earlier account even after switching back', async () => {
  let resolveOld;
  service.getPatientOrderDashboard.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const { result, rerender } = renderHook(() => useRoleDashboard('Patient'));
  auth.current = { user: { userId: 'B', role: 'Patient' }, token: 'B' }; rerender();
  await waitFor(() => expect(result.current.sections.orders.data.totalCount).toBe(1));
  auth.current = { user: null, token: null }; rerender();
  expect(result.current.sections).toEqual({});
  auth.current = { user: { userId: 'A', role: 'Patient' }, token: 'A' }; rerender();
  await waitFor(() => expect(result.current.sections.orders.data.totalCount).toBe(1));
  await act(async () => resolveOld({ totalCount: 999 }));
  expect(result.current.sections.orders.data.totalCount).toBe(1);
});
