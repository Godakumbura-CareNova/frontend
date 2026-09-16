import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PatientPrescriptionsPage from './PatientPrescriptionsPage';

const { list, download, remove } = vi.hoisted(() => ({ list: vi.fn(), download: vi.fn(), remove: vi.fn() }));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/prescriptionApi', () => ({ prescriptionApi: { list, download, remove } }));

describe('PatientPrescriptionsPage', () => {
  beforeEach(() => {
    list.mockResolvedValue({ data: [{ id: 7, originalFileName: 'doctor-note.pdf', medicineName: 'Amoxicillin 250mg', quantity: 2, status: 'PendingVerification', uploadedAt: '2026-09-12T10:30:00Z' }] });
  });

  it('renders the patients uploaded prescription record', async () => {
    render(<MemoryRouter><PatientPrescriptionsPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Your uploaded prescriptions' })).toBeInTheDocument();
    expect(screen.getByText('1 prescription')).toBeInTheDocument();
    expect(await screen.findByText('doctor-note.pdf')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin 250mg')).toBeInTheDocument();
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete prescription' })).toBeInTheDocument();
  });

  it('shows the pharmacy rejection reason in its own response section', async () => {
    list.mockResolvedValue({ data: [{ id: 8, originalFileName: 'blurred.pdf', medicineName: 'Amoxicillin 250mg', quantity: 2, status: 'Rejected', decisionReason: 'Image is unreadable' }] });
    render(<MemoryRouter><PatientPrescriptionsPage /></MemoryRouter>);
    expect(await screen.findByText('Pharmacy response')).toBeInTheDocument();
    expect(screen.getByText('Image is unreadable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete prescription' })).not.toBeInTheDocument();
  });
});
