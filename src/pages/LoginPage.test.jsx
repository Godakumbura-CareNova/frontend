import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();
let mockLocationState = null;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  };
});

const renderPage = () => {
  render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
    mockLocationState = null;
  });

  it('renders login form fields and submit button', () => {
    renderPage();

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows required email and password validation messages', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(await screen.findByText('Password is required.')).toBeInTheDocument();
  });

  it('shows email format validation message', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Email Address'), 'invalid-email');
    await user.type(screen.getByLabelText('Password'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('navigates to role dashboard on successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'Doctor' });
    renderPage();

    await user.type(screen.getByLabelText('Email Address'), 'doctor@carenova.org');
    await user.type(screen.getByLabelText('Password'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('doctor@carenova.org', 'SecurePass123');
      expect(mockNavigate).toHaveBeenCalledWith('/doctor-dashboard', { replace: true });
    });
  });

  it('shows invalid credentials message for 401', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue({ response: { status: 401 } });
    renderPage();

    await user.type(screen.getByLabelText('Email Address'), 'user@carenova.org');
    await user.type(screen.getByLabelText('Password'), 'WrongPassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('shows inactive account message when backend indicates inactive account', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue({
      response: {
        status: 403,
        data: { code: 'INACTIVE_ACCOUNT' },
      },
    });
    renderPage();

    await user.type(screen.getByLabelText('Email Address'), 'inactive@carenova.org');
    await user.type(screen.getByLabelText('Password'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Your account is inactive. Please contact support.')).toBeInTheDocument();
  });

  it('shows network failure message when api is unreachable', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Network Error'));
    renderPage();

    await user.type(screen.getByLabelText('Email Address'), 'user@carenova.org');
    await user.type(screen.getByLabelText('Password'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Unable to reach the server. Please check your connection and try again.')).toBeInTheDocument();
  });

  it('displays registration success message from navigation state', () => {
    mockLocationState = { message: 'Registration successful! Please log in.' };
    renderPage();

    expect(screen.getByText('Registration successful! Please log in.')).toBeInTheDocument();
  });
});
