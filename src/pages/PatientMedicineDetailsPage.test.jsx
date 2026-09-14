import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientMedicineDetailsPage from './PatientMedicineDetailsPage';

const { getMedicine, addItem } = vi.hoisted(() => ({ getMedicine: vi.fn(), addItem: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { getMedicine } }));
vi.mock('../api/cartApi', () => ({ cartApi: { addItem } }));

describe('PatientMedicineDetailsPage', () => {
  beforeEach(() => getMedicine.mockResolvedValue({ data: { id: 1, name: 'Antibiotic', categoryName: 'Medicine', description: 'Details', price: 100, stockQuantity: 2, prescriptionRequired: true } }));
  it('limits quantity to stock and uses prescription action text', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/patient/medicines/1']}><Routes><Route path="/patient/medicines/:medicineId" element={<PatientMedicineDetailsPage />}/></Routes></MemoryRouter>);
    await screen.findByText('Antibiotic');
    await user.click(screen.getByLabelText('Increase quantity'));
    await user.click(screen.getByLabelText('Increase quantity'));
    expect(screen.getByText('Total: LKR 200.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to prescription upload/i })).toBeInTheDocument();
  });

  it('adds a non-prescription medicine to the saved cart', async () => {
    getMedicine.mockResolvedValue({ data: { id: 2, name: 'Ibuprofen', categoryName: 'Pain Relief', description: 'Details', price: 200, stockQuantity: 8, prescriptionRequired: false } });
    addItem.mockResolvedValue({ data: { readyItems: [{ medicineId: 2, quantity: 1 }] } });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/patient/medicines/2']}><Routes><Route path="/patient/medicines/:medicineId" element={<PatientMedicineDetailsPage />}/></Routes></MemoryRouter>);

    const addToCartButton = await screen.findByRole('button', { name: /add to cart/i });
    expect(addToCartButton).toHaveClass('details-add-to-cart');
    expect(addToCartButton.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Total: LKR 200.00')).toHaveClass('total-price');
    await user.click(addToCartButton);

    expect(addItem).toHaveBeenCalledWith({ medicineId: 2, quantity: 1 });
    expect(await screen.findByText(/added to your cart/i)).toBeInTheDocument();
  });
});
