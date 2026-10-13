import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InventoryManagementPage from './InventoryManagementPage';
import { medicineApi } from '../api/medicineApi';
import { inventoryApi } from '../api/inventoryApi';

vi.mock('../api/medicineApi', () => ({ medicineApi: { list: vi.fn() } }));
vi.mock('../api/inventoryApi', () => ({
  inventoryApi: { list: vi.fn(), batches: vi.fn(), createBatch: vi.fn(), updateBatch: vi.fn() },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'Staff Member' }, role: 'PharmacyStaff', logout: vi.fn() }),
}));

const renderPage = () => render(<BrowserRouter><InventoryManagementPage /></BrowserRouter>);

const fillForm = async (user, quantity) => {
  await user.selectOptions(screen.getByLabelText('Medicine'), '1');
  await user.type(screen.getByLabelText('Batch number'), 'B-100');
  await user.type(screen.getByLabelText('Quantity'), quantity);
  await user.type(screen.getByLabelText('Purchase price'), '80');
  await user.type(screen.getByLabelText('Selling price'), '100');
  await user.type(screen.getByLabelText('Manufacturing date'), '2026-01-01');
  await user.type(screen.getByLabelText('Expiry date'), '2027-01-01');
};

describe('InventoryManagementPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/pharmacy/inventory');
    vi.clearAllMocks();
    medicineApi.list.mockResolvedValue({ data: [{ id: 1, name: 'Paracetamol', isActive: true }, { id: 2, name: 'Retired', isActive: false }] });
    inventoryApi.list.mockResolvedValue({
      data: [
        { medicineId: 1, medicineName: 'Paracetamol', totalQuantity: 3, availabilityStatus: 'Low stock', isLowStock: true },
      ],
    });
  });

  it('lists inventory with quantity and availability status, offering only active medicines', async () => {
    renderPage();

    expect(await screen.findByText('3 units · Low stock')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Paracetamol' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Retired' })).not.toBeInTheDocument();
  });

  it('opens the low stock filter when following the dashboard shortcut', async () => {
    window.history.replaceState({}, '', '/pharmacy/inventory?lowStockOnly=true');
    renderPage();
    expect(screen.getByLabelText('Low stock only')).toBeChecked();
    await screen.findByText('3 units · Low stock');
  });

  it('submits a new stock batch with numeric fields and shows the success message', async () => {
    const user = userEvent.setup();
    inventoryApi.createBatch.mockResolvedValue({ data: { id: 9 } });
    renderPage();
    await screen.findByText('3 units · Low stock');

    await fillForm(user, '50');
    await user.click(screen.getByRole('button', { name: /save stock batch/i }));

    await waitFor(() => expect(inventoryApi.createBatch).toHaveBeenCalledWith(expect.objectContaining({
      medicineId: 1, batchNumber: 'B-100', quantity: 50, purchasePrice: 80, sellingPrice: 100,
      manufacturingDate: '2026-01-01', expiryDate: '2027-01-01',
    })));
    expect(await screen.findByText('Stock batch saved successfully.')).toBeInTheDocument();
  });

  it('shows the API validation message when the batch is rejected', async () => {
    const user = userEvent.setup();
    inventoryApi.createBatch.mockRejectedValue({ response: { data: { message: 'Expiry date cannot be before manufacturing date.' } } });
    renderPage();
    await screen.findByText('3 units · Low stock');

    await fillForm(user, '5');
    await user.click(screen.getByRole('button', { name: /save stock batch/i }));

    expect(await screen.findByText('Expiry date cannot be before manufacturing date.')).toBeInTheDocument();
  });

  it('reloads the inventory with the low-stock filter when the checkbox is toggled', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('3 units · Low stock');
    expect(inventoryApi.list).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByLabelText(/low stock only/i));

    await waitFor(() => expect(inventoryApi.list).toHaveBeenLastCalledWith(true));
  });
});
