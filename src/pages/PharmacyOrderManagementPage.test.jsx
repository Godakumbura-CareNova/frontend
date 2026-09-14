import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PharmacyOrderManagementPage from './PharmacyOrderManagementPage';

const { listActive } = vi.hoisted(() => ({ listActive: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/staffOrderApi', () => ({ staffOrderApi: { listActive } }));

describe('PharmacyOrderManagementPage', () => {
  it('shows only actionable pharmacy orders', async () => {
    listActive.mockResolvedValue({ data: [{ id: 3, orderNumber: 'CN-000003', status: 'Pending', totalAmount: 600, items: [{ medicineName: 'Amoxicillin', quantity: 2, unitPrice: 300 }] }] });
    render(<MemoryRouter><PharmacyOrderManagementPage /></MemoryRouter>);
    expect(await screen.findByText('CN-000003')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin × 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark ready for collection' })).toBeInTheDocument();
  });
});
