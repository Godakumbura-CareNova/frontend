import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import authApi from '../api/authApi';

vi.mock('../api/authApi', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

const toBase64Url = (obj) => {
  const base64 = btoa(JSON.stringify(obj));
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const createTestJwt = (expiresInSeconds) => {
  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = toBase64Url({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  return `${header}.${payload}.signature`;
};

const TestConsumer = () => {
  const { user, role, isAuthenticated, loading, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'yes' : 'no'}</div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="role">{role || ''}</div>
      <div data-testid="email">{user?.email || ''}</div>
      <button onClick={() => login('patient@carenova.org', 'SecurePass123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    authApi.login.mockReset();
  });

  it('restores valid session from localStorage', async () => {
    localStorage.setItem('carenova_token', createTestJwt(300));
    localStorage.setItem('carenova_user', JSON.stringify({ email: 'restored@carenova.org', role: 'Patient' }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('email')).toHaveTextContent('restored@carenova.org');
    });
  });

  it('clears expired token during bootstrap', async () => {
    localStorage.setItem('carenova_token', createTestJwt(-300));
    localStorage.setItem('carenova_user', JSON.stringify({ email: 'expired@carenova.org', role: 'Patient' }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
      expect(localStorage.getItem('carenova_token')).toBeNull();
      expect(localStorage.getItem('carenova_user')).toBeNull();
    });
  });

  it('stores JWT and user on successful login', async () => {
    const user = userEvent.setup();
    const token = createTestJwt(300);

    authApi.login.mockResolvedValue({
      token,
      user: {
        email: 'patient@carenova.org',
        fullName: 'Patient Demo',
        role: 'Patient',
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('role')).toHaveTextContent('Patient');
      expect(localStorage.getItem('carenova_token')).toBe(token);
      expect(JSON.parse(localStorage.getItem('carenova_user'))).toMatchObject({
        email: 'patient@carenova.org',
        role: 'Patient',
      });
    });
  });

  it('clears state and storage on logout', async () => {
    const user = userEvent.setup();
    const token = createTestJwt(300);

    authApi.login.mockResolvedValue({
      token,
      user: {
        email: 'patient@carenova.org',
        fullName: 'Patient Demo',
        role: 'Patient',
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('yes');
    });

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('no');
      expect(localStorage.getItem('carenova_token')).toBeNull();
      expect(localStorage.getItem('carenova_user')).toBeNull();
    });
  });
});
