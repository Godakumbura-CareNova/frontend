import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect } from 'vitest';
import HomePage from './HomePage';
import PatientDashboard from './PatientDashboard';
import { getHomeContent } from '../services/publicContentService';
vi.mock('../services/publicContentService', () => ({ getHomeContent: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null, role: null }) }));
const content = { introduction: 'Welcome to CareNova', services: [{ title: 'Pharmacy', description: 'Medicines and advice' }], notices: [], featuredMedicines: [{ id: 1, name: 'Vitamin C', price: 200 }], featuredDoctors: [{ doctorId: 'abc', fullName: 'Dr Silva', specialization: 'General medicine' }], sectionErrors: [] };
test('visitors see live featured content and public navigation', async () => {
  getHomeContent.mockResolvedValue(content);
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByText('Vitamin C')).toBeInTheDocument();
  expect(screen.getByText('Dr Silva')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  expect(screen.getByRole('link', { name: /Vitamin C/ })).toHaveAttribute('href', '/patient/medicines/1');
  expect(PatientDashboard).toBe(HomePage);
});
test('a failed home request can be retried', async () => {
  getHomeContent.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(content);
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Vitamin C')).toBeInTheDocument();
});
test('partial failures retain available content', async () => {
  getHomeContent.mockResolvedValue({ ...content, featuredDoctors: [], sectionErrors: ['Featured doctors are temporarily unavailable.'] });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByText('Vitamin C')).toBeInTheDocument();
  expect(screen.getByText('Featured doctors are temporarily unavailable.')).toBeInTheDocument();
});
