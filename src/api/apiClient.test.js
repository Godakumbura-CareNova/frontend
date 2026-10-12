import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from './apiClient';

describe('apiClient interceptors', () => {
  it('leaves session handling to dashboard requests so a late 401 cannot clear a newer login', async () => {
    localStorage.setItem('carenova_token', 'new-admin-token');
    localStorage.setItem('carenova_user', JSON.stringify({ id: 'new-admin' }));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const error = { config: { handleUnauthorizedLocally: true }, response: { status: 401 } };
    await expect(apiClient.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error);
    expect(localStorage.getItem('carenova_token')).toBe('new-admin-token');
    expect(localStorage.getItem('carenova_user')).toContain('new-admin');
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches Authorization Bearer header when token exists', async () => {
    localStorage.setItem('carenova_token', 'jwt-token-value');

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer jwt-token-value');
  });

  it('does not attach Authorization header when token is missing', async () => {
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('clears auth storage and emits unauthorized event on 401 response', async () => {
    localStorage.setItem('carenova_token', 'token');
    localStorage.setItem('carenova_user', JSON.stringify({ email: 'user@carenova.org' }));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/login',
      },
    });

    const error = { response: { status: 401 } };

    await expect(apiClient.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error);

    expect(localStorage.getItem('carenova_token')).toBeNull();
    expect(localStorage.getItem('carenova_user')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
