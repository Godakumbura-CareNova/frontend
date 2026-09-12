import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientMedicineDetailsPage from './PatientMedicineDetailsPage';

const { getMedicine } = vi.hoisted(() => ({ getMedicine: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { getMedicine } }));

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
});
