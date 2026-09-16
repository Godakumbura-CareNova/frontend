import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PharmacyPrescriptionReviewPage from './PharmacyPrescriptionReviewPage';

const { listPending } = vi.hoisted(() => ({ listPending: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/staffPrescriptionApi', () => ({ staffPrescriptionApi: { listPending } }));

describe('PharmacyPrescriptionReviewPage', () => {
  it('shows prescriptions awaiting pharmacy verification', async () => {
    listPending.mockResolvedValue({ data: [{ id: 7, originalFileName: 'doctor-note.pdf', medicineName: 'Amoxicillin 250mg', quantity: 2, status: 'PendingVerification' }] });
    render(<MemoryRouter><PharmacyPrescriptionReviewPage /></MemoryRouter>);
    expect(await screen.findByText('doctor-note.pdf')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin 250mg × 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify prescription' })).toBeInTheDocument();
    expect(screen.getByText('doctor-note.pdf').closest('article')).toHaveClass('staff-prescription-card');
  });
});
