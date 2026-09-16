import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PatientMedicineCataloguePage from './PatientMedicineCataloguePage';

const CurrentPath = () => <output>{useLocation().pathname}</output>;

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

  const renderPage = () => render(<MemoryRouter><PatientMedicineCataloguePage /><CurrentPath /></MemoryRouter>);

  it('allows patients to view details for an out-of-stock medicine', async () => {
    renderPage();

    expect(await screen.findByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Out of stock', { selector: '.stock-status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view details/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(screen.getByText('/patient/medicines/5')).toBeInTheDocument();
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

  it('clears active filters from an empty search result', async () => {
    listMedicines.mockResolvedValue({ data: { items: [], page: 1, totalPages: 1, totalCount: 0 } });
    renderPage();

    const searchInput = await screen.findByRole('textbox', { name: 'Search medicines' });
    fireEvent.change(searchInput, { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('button', { name: 'Show all medicines' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all medicines' }));

    await waitFor(() => expect(listMedicines).toHaveBeenLastCalledWith({ search: '', categoryId: '', inStock: '', page: 1 }));
    expect(searchInput).toHaveValue('');
  });
});
