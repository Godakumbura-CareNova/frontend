import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MedicineManagementPage from './MedicineManagementPage';
import { medicineApi } from '../api/medicineApi';
import { categoryApi } from '../api/categoryApi';

vi.mock('../api/medicineApi', () => ({
  medicineApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), uploadImage: vi.fn() },
}));
vi.mock('../api/categoryApi', () => ({ categoryApi: { list: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'Staff Member' }, role: 'PharmacyStaff', logout: vi.fn() }),
}));

const renderPage = () => render(<BrowserRouter><MedicineManagementPage /></BrowserRouter>);

describe('MedicineManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    medicineApi.list.mockResolvedValue({ data: [] });
    categoryApi.list.mockResolvedValue({ data: [{ id: 1, name: 'Pain Relief' }] });
  });

  it('loads categories into the dropdown and medicines into the list', async () => {
    medicineApi.list.mockResolvedValue({
      data: [{ id: 1, name: 'Paracetamol', categoryName: 'Pain Relief', price: 25, prescriptionRequired: false, isActive: true }],
    });
    renderPage();
    expect(await screen.findByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pain Relief' })).toBeInTheDocument();
  });

  it('submits a valid new medicine', async () => {
    const user = userEvent.setup();
    medicineApi.create.mockResolvedValue({ data: { id: 5, name: 'Ibuprofen' } });
    renderPage();
    await screen.findByText('No medicines yet.');

    await user.type(screen.getByLabelText('Name'), 'Ibuprofen');
    await user.type(screen.getByLabelText('Description'), 'Pain relief tablets');
    await user.selectOptions(screen.getByLabelText('Category'), '1');
    await user.type(screen.getByLabelText(/Price/i), '25');
    await user.click(screen.getByRole('button', { name: /add medicine/i }));

    await waitFor(() => expect(medicineApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ibuprofen', categoryId: 1, price: 25 })));
    expect(await screen.findByText('Medicine saved successfully.')).toBeInTheDocument();
  });

  it('shows a warning for a duplicate medicine name', async () => {
    const user = userEvent.setup();
    medicineApi.create.mockRejectedValue({ response: { data: { message: 'An active medicine with this name already exists in the category.' } } });
    renderPage();
    await screen.findByText('No medicines yet.');

    await user.type(screen.getByLabelText('Name'), 'Paracetamol');
    await user.type(screen.getByLabelText('Description'), 'Pain relief tablets');
    await user.selectOptions(screen.getByLabelText('Category'), '1');
    await user.type(screen.getByLabelText(/Price/i), '25');
    await user.click(screen.getByRole('button', { name: /add medicine/i }));

    expect(await screen.findByText('An active medicine with this name already exists in the category.')).toBeInTheDocument();
  });

  it('edit populates the form, deactivate asks for confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    medicineApi.list.mockResolvedValue({
      data: [{ id: 1, name: 'Paracetamol', categoryName: 'Pain Relief', price: 25, prescriptionRequired: false, isActive: true }],
    });
    medicineApi.deactivate.mockResolvedValue({});
    renderPage();
    await screen.findByText('Paracetamol');

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue('Paracetamol')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /deactivate/i }));
    expect(window.confirm).toHaveBeenCalledWith('Deactivate Paracetamol?');
    await waitFor(() => expect(medicineApi.deactivate).toHaveBeenCalledWith(1));
  });
});
