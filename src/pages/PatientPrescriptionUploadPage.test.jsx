import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PatientPrescriptionUploadPage from './PatientPrescriptionUploadPage';

// GCN-29 vitest 2–4: prescription upload page (vitest 1 for Scenario 1 is in PatientMedicineDetailsPage.test.jsx).

const { getMedicine, upload } = vi.hoisted(() => ({ getMedicine: vi.fn(), upload: vi.fn() }));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { getMedicine } }));
vi.mock('../api/prescriptionApi', () => ({ prescriptionApi: { upload } }));

const renderPage = () => render(<MemoryRouter><PatientPrescriptionUploadPage /></MemoryRouter>);
const pdf = () => new File(['%PDF-1.4 note'], 'doctor-note.pdf', { type: 'application/pdf' });

describe('PatientPrescriptionUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('carenova.pendingCartItem', JSON.stringify({ medicineId: 3, quantity: 2, prescriptionRequired: true }));
    getMedicine.mockResolvedValue({ data: { id: 3, name: 'Amoxicillin 250mg', prescriptionRequired: true, stockQuantity: 10 } });
    upload.mockResolvedValue({ data: { id: 11, originalFileName: 'doctor-note.pdf', medicineName: 'Amoxicillin 250mg', quantity: 2, status: 'PendingVerification' } });
  });

  // 2 — Scenario 3: proceeding without a prescription is blocked and a warning is shown
  it('blocks the upload and warns when no prescription file has been chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Amoxicillin 250mg × 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /upload prescription/i }));

    expect(await screen.findByText('Choose a prescription file before uploading.')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByText(/uploaded successfully/i)).not.toBeInTheDocument();
  });

  // 3 — unsupported file format → error message, nothing is sent
  it('rejects an unsupported file format with an error message', async () => {
    // applyAccept:false lets the .exe reach the page's own validation instead of being filtered by the input's accept list
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await screen.findByText(/Amoxicillin 250mg × 2/);

    await user.upload(screen.getByLabelText(/prescription file/i), new File(['MZ'], 'prescription.exe', { type: 'application/octet-stream' }));

    expect(await screen.findByText('Choose a PDF, JPG, JPEG, or PNG file.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /upload prescription/i }));
    expect(upload).not.toHaveBeenCalled();
  });

  // 4 — Scenario 2 + technical failure: a failed upload shows an error and can be retried; the retry
  //     sends medicine, quantity and file together and shows the confirmation
  it('shows an error on upload failure, allows retry, and stores medicine, quantity and file together on success', async () => {
    const user = userEvent.setup();
    upload.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Storage unavailable.' } } });
    renderPage();
    await screen.findByText(/Amoxicillin 250mg × 2/);

    await user.upload(screen.getByLabelText(/prescription file/i), pdf());
    await user.click(screen.getByRole('button', { name: /upload prescription/i }));

    expect(await screen.findByText('Storage unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload prescription/i })).toBeEnabled();
    expect(sessionStorage.getItem('carenova.pendingCartItem')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /upload prescription/i }));

    expect(await screen.findByText(/prescription uploaded successfully/i)).toBeInTheDocument();
    const formData = upload.mock.calls[1][0];
    expect(formData.get('medicineId')).toBe('3');
    expect(formData.get('quantity')).toBe('2');
    expect(formData.get('file').name).toBe('doctor-note.pdf');
    expect(screen.getByText('Amoxicillin 250mg')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem('carenova.pendingCartItem')).toBeNull());
  });
});
