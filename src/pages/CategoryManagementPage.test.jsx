import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CategoryManagementPage from './CategoryManagementPage';
import { categoryApi } from '../api/categoryApi';

vi.mock('../api/categoryApi', () => ({
  categoryApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'Staff Member' }, role: 'PharmacyStaff', logout: vi.fn() }),
}));

const renderPage = () => render(<BrowserRouter><CategoryManagementPage /></BrowserRouter>);

describe('CategoryManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    categoryApi.list.mockResolvedValue({ data: [] });
  });

  it('loads and displays existing categories', async () => {
    categoryApi.list.mockResolvedValue({ data: [{ id: 1, name: 'Pain Relief', medicineCount: 3 }] });
    renderPage();
    expect(await screen.findByText('Pain Relief')).toBeInTheDocument();
    expect(screen.getByText('3 medicines')).toBeInTheDocument();
  });

  it('adds a new category and shows success', async () => {
    const user = userEvent.setup();
    categoryApi.create.mockResolvedValue({ data: { id: 2, name: 'Vitamins', medicineCount: 0 } });
    renderPage();
    await screen.findByText('No categories yet.');

    await user.type(screen.getByLabelText('Category name'), 'Vitamins');
    await user.click(screen.getByRole('button', { name: /add category/i }));

    await waitFor(() => expect(categoryApi.create).toHaveBeenCalledWith({ name: 'Vitamins' }));
    expect(await screen.findByText('Category saved successfully.')).toBeInTheDocument();
  });

  it('shows a warning for a duplicate category name', async () => {
    const user = userEvent.setup();
    categoryApi.create.mockRejectedValue({ response: { data: { message: 'A category with this name already exists.' } } });
    renderPage();
    await screen.findByText('No categories yet.');

    await user.type(screen.getByLabelText('Category name'), 'Vitamins');
    await user.click(screen.getByRole('button', { name: /add category/i }));

    expect(await screen.findByText('A category with this name already exists.')).toBeInTheDocument();
  });

  it('edit populates the form, delete-in-use shows a warning', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    categoryApi.list.mockResolvedValue({ data: [{ id: 1, name: 'Pain Relief', medicineCount: 2 }] });
    categoryApi.remove.mockRejectedValue({ response: { data: { message: 'A category assigned to an active medicine cannot be deleted.' } } });
    renderPage();
    await screen.findByText('Pain Relief');

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue('Pain Relief')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(window.confirm).toHaveBeenCalledWith('Delete this category?');
    expect(await screen.findByText('A category assigned to an active medicine cannot be deleted.')).toBeInTheDocument();
  });
});