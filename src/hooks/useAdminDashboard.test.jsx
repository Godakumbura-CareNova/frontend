import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAdminDashboard } from './useAdminDashboard';
import * as service from '../services/adminDashboardService';
const { auth } = vi.hoisted(() => ({ auth: { current: null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('../services/adminDashboardService', () => ({ getAdminUserDashboard: vi.fn(), getAdminOperationsDashboard: vi.fn(), getAdminAppointmentDashboard: vi.fn(), getAdminMedicinePaymentDashboard: vi.fn(), getAdminAppointmentPaymentDashboard: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); auth.current = { user: { userId: 'A', role: 'Admin' }, token: 'A' };
  for (const loader of Object.values(service)) loader.mockResolvedValue({ total: 1 });
});
it('keeps successful data marked stale on refresh failure and retries only that module', async () => {
  const { result } = renderHook(() => useAdminDashboard());
  await waitFor(() => expect(result.current.sections.users.data).toEqual({ total: 1 }));
  const original = result.current.sections.users.lastRefreshed;
  service.getAdminUserDashboard.mockRejectedValueOnce(new Error());
  await act(async () => result.current.refreshSection('users'));
  expect(result.current.sections.users).toMatchObject({ data: { total: 1 }, stale: true, lastRefreshed: original });
  expect(result.current.sections.operations.data).toEqual({ total: 1 });
  service.getAdminUserDashboard.mockResolvedValue({ total: 2 });
  await act(async () => result.current.refreshSection('users'));
  expect(result.current.sections.users).toMatchObject({ data: { total: 2 }, stale: false, error: null });
  expect(service.getAdminOperationsDashboard).toHaveBeenCalledTimes(1);
});
it('shows an initial module failure without hiding other sections', async () => {
  service.getAdminAppointmentDashboard.mockRejectedValue(new Error());
  const { result } = renderHook(() => useAdminDashboard());
  await waitFor(() => expect(result.current.sections.appointments.error).toBeTruthy());
  expect(result.current.sections.appointments.data).toBeNull();
  expect(result.current.sections.users.data).toEqual({ total: 1 });
});
it('ignores old account results after A to B to A and clears on logout', async () => {
  let resolveOld; service.getAdminUserDashboard.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const { result, rerender } = renderHook(() => useAdminDashboard());
  auth.current = { user: { userId: 'B', role: 'Admin' }, token: 'B' }; rerender();
  await waitFor(() => expect(result.current.sections.users.data).toEqual({ total: 1 }));
  auth.current = { user: { userId: 'A', role: 'Admin' }, token: 'A' }; rerender();
  await waitFor(() => expect(result.current.sections.users.data).toEqual({ total: 1 }));
  await act(async () => resolveOld({ total: 999 }));
  expect(result.current.sections.users.data).toEqual({ total: 1 });
  auth.current = { user: null, token: null }; rerender(); expect(result.current.sections).toEqual({});
});
it.each([401, 403])('clears all private data on authorization failure %s', async status => {
  const { result } = renderHook(() => useAdminDashboard());
  await waitFor(() => expect(result.current.sections.users.data).toBeTruthy());
  service.getAdminUserDashboard.mockRejectedValueOnce({ response: { status } });
  await act(async () => result.current.refreshSection('users'));
  expect(Object.values(result.current.sections).every(s => s.data === null)).toBe(true);
});
it('does not issue requests for visitors or non-admins', () => {
  auth.current = { user: { userId: 'P', role: 'Patient' }, token: 'P' };
  renderHook(() => useAdminDashboard());
  expect(service.getAdminUserDashboard).not.toHaveBeenCalled();
});
it('ignores superseded refresh results', async () => {
  const { result } = renderHook(() => useAdminDashboard());
  await waitFor(() => expect(result.current.sections.users.data).toBeTruthy());
  let resolveOld; service.getAdminUserDashboard.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ total: 2 });
  act(() => { result.current.refreshSection('users'); result.current.refreshSection('users'); });
  await waitFor(() => expect(result.current.sections.users.data).toEqual({ total: 2 }));
  await act(async () => resolveOld({ total: 999 })); expect(result.current.sections.users.data).toEqual({ total: 2 });
});
