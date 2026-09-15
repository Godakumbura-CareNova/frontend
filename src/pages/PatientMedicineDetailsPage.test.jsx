import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientMedicineDetailsPage from './PatientMedicineDetailsPage';

// GCN-29 vitest 1: the prescription-requirement check at the "Add to Cart" step.

const { getMedicine } = vi.hoisted(() => ({ getMedicine: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { getMedicine } }));

const base = { id: 7, name: 'Test Medicine', categoryName: 'General', description: 'Details', price: 100, stockQuantity: 5, prescriptionRequired: false };

const renderPage = () => render(
  <MemoryRouter initialEntries={['/patient/medicines/7']}>
    <Routes>
      <Route path="/patient/medicines/:medicineId" element={<PatientMedicineDetailsPage />} />
      <Route path="/patient/prescriptions/upload" element={<h1>Upload prescription page</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('PatientMedicineDetailsPage – prescription requirement check', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });

  // 1 — Scenario 1: a non-prescription medicine is added without any prescription prompt;
  //     a prescription medicine is routed to the upload step instead
  it('adds a non-prescription medicine without prompting for a prescription, but routes prescription medicines to upload', async () => {
    const user = userEvent.setup();
    getMedicine.mockResolvedValue({ data: base });
    const nonPrescription = renderPage();
    await screen.findByRole('heading', { name: 'Test Medicine' });

    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(screen.queryByText('Upload prescription page')).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('carenova.pendingCartItem'))).toEqual({ medicineId: 7, quantity: 1, prescriptionRequired: false });

    nonPrescription.unmount();
    sessionStorage.clear();
    getMedicine.mockResolvedValue({ data: { ...base, prescriptionRequired: true } });
    renderPage();
    await screen.findByRole('heading', { name: 'Test Medicine' });
    await user.click(screen.getByRole('button', { name: /continue to prescription upload/i }));

    expect(await screen.findByText('Upload prescription page')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('carenova.pendingCartItem'))).toEqual({ medicineId: 7, quantity: 1, prescriptionRequired: true });
  });
});
