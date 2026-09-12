import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PatientPrescriptionUploadPage from './PatientPrescriptionUploadPage';

const { getMedicine, upload } = vi.hoisted(() => ({ getMedicine: vi.fn(), upload: vi.fn() }));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { getMedicine } }));
vi.mock('../api/prescriptionApi', () => ({ prescriptionApi: { upload } }));

describe('PatientPrescriptionUploadPage', () => {
  beforeEach(() => {
    sessionStorage.setItem('carenova.pendingCartItem', JSON.stringify({ medicineId: 3, quantity: 2, prescriptionRequired: true }));
    getMedicine.mockResolvedValue({ data: { id: 3, name: 'Amoxicillin 250mg', prescriptionRequired: true, stockQuantity: 10 } });
    upload.mockResolvedValue({ data: { originalFileName: 'doctor-note.pdf', medicineName: 'Amoxicillin 250mg', quantity: 2, status: 'PendingVerification' } });
  });

  it('shows the selected medicine and confirms a successful PDF upload', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PatientPrescriptionUploadPage /></MemoryRouter>);

    expect(await screen.findByText(/Amoxicillin 250mg × 2/i)).toBeInTheDocument();
    await user.upload(screen.getByLabelText(/prescription file/i), new File(['pdf'], 'doctor-note.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /upload prescription/i }));

    expect(await screen.findByText(/prescription uploaded successfully/i)).toBeInTheDocument();
  });
});
