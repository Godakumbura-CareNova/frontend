import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PatientCartPage from './PatientCartPage';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/cartApi', () => ({ cartApi: { get, updateItem: vi.fn(), removeItem: vi.fn() } }));

describe('PatientCartPage', () => {
  it('shows the selected quantity for a pending prescription item', async () => {
    get.mockResolvedValue({ data: {
      readyItems: [],
      pendingItems: [{ id: 2, medicineName: 'Amoxicillin 250mg', unitPrice: 300, quantity: 4, lineTotal: 1200, prescriptionStatus: 'PendingVerification' }],
      attentionItems: [], readySubtotal: 0, pendingSubtotal: 1200, attentionSubtotal: 0, cartTotal: 1200,
    } });
    render(<MemoryRouter><PatientCartPage /></MemoryRouter>);

    expect(await screen.findByText('Quantity: 4')).toBeInTheDocument();
  });
});
