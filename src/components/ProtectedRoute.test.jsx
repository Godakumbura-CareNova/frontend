import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const authState = {
  isAuthenticated: false,
  loading: false,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

const renderWithRoutes = () => {
  render(
    <MemoryRouter initialEntries={['/secure']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/secure" element={<div>Secure Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.loading = false;
  });

  it('redirects unauthenticated users to login', () => {
    renderWithRoutes();

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders protected content for authenticated users', () => {
    authState.isAuthenticated = true;
    renderWithRoutes();

    expect(screen.getByText('Secure Content')).toBeInTheDocument();
  });

  it('shows loading indicator while authentication state is loading', () => {
    authState.loading = true;
    renderWithRoutes();

    expect(screen.getByText('Loading authentication...')).toBeInTheDocument();
  });
});
