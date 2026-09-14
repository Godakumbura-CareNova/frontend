import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PatientMedicineCataloguePage from './PatientMedicineCataloguePage';

const { listMedicines, listCategories } = vi.hoisted(() => ({ listMedicines: vi.fn(), listCategories: vi.fn() }));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { listMedicines, listCategories } }));

describe('PatientMedicineCataloguePage', () => {
  beforeEach(() => {
    listCategories.mockResolvedValue({ data: [{ id: 1, name: 'Pain Relief' }] });
    listMedicines.mockResolvedValue({
      data: {
        items: [{ id: 5, name: 'Paracetamol', description: 'Pain relief', categoryName: 'Pain Relief', price: 150, prescriptionRequired: false, availabilityStatus: 'Out of stock', stockQuantity: 0 }],
        page: 1,
        totalPages: 1,
        totalCount: 1
      }
    });
  });

  const renderPage = () => render(<MemoryRouter><PatientMedicineCataloguePage /></MemoryRouter>);

  it('renders an out-of-stock medicine with disabled details action', async () => {
    renderPage();

    expect(await screen.findByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Out of stock', { selector: '.stock-status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view details/i })).toBeDisabled();
  });

  it('renders a highlighted non-prescription status badge', async () => {
    renderPage();

    const badge = await screen.findByText('No prescription required');
    expect(badge).toHaveClass('prescription-status', 'non-prescription');
  });

  it('uses a compact search action in the filter bar', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: 'Search' })).toHaveClass('catalogue-search-action');
  });
});
