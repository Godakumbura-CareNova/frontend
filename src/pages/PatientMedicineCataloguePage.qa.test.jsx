import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PatientMedicineCataloguePage from './PatientMedicineCataloguePage';

const { listMedicines, listCategories } = vi.hoisted(() => ({ listMedicines: vi.fn(), listCategories: vi.fn() }));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { listMedicines, listCategories } }));

const page = (items) => ({ data: { items, page: 1, totalPages: items.length ? 1 : 0, totalCount: items.length } });
const paracetamol = { id: 5, name: 'Paracetamol', description: 'Fever relief', categoryName: 'Pain Relief', price: 150, prescriptionRequired: false, availabilityStatus: 'Available', stockQuantity: 20 };
const ibuprofen = { id: 6, name: 'Ibuprofen', description: 'Anti-inflammatory', categoryName: 'Pain Relief', price: 220.5, prescriptionRequired: true, availabilityStatus: 'Out of stock', stockQuantity: 0 };

describe('PatientMedicineCataloguePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategories.mockResolvedValue({ data: [{ id: 1, name: 'Pain Relief' }, { id: 2, name: 'Vitamins' }] });
    listMedicines.mockResolvedValue(page([paracetamol, ibuprofen]));
  });

  // 1 — listing shows name, price, category and stock status; out-of-stock stays viewable (GCN-32 change)
  it('lists medicines with name, price, category and stock status', async () => {
    render(<MemoryRouter><PatientMedicineCataloguePage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Paracetamol' })).toBeInTheDocument();
    expect(screen.getByText('LKR 150.00')).toBeInTheDocument();
    expect(screen.getAllByText('Pain Relief').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0); // badge + availability filter option
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(screen.getByText('Prescription required')).toBeInTheDocument();

    const detailButtons = screen.getAllByRole('button', { name: /view details/i });
    expect(detailButtons[0]).toBeEnabled();
    expect(detailButtons[1]).toBeEnabled(); // dev allows viewing out-of-stock details since GCN-32
  });

  // 2 — Scenario 1 + Scenario 3: search sends the term; no matches shows the empty message
  it('searches by name and shows "no results" when nothing matches', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PatientMedicineCataloguePage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Paracetamol' });

    listMedicines.mockResolvedValueOnce(page([]));
    await user.type(screen.getByLabelText('Search medicines'), 'unicorn tablets');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(listMedicines).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'unicorn tablets', page: 1 })));
    expect(await screen.findByText('No medicines found')).toBeInTheDocument(); // empty state with active filters (dev redesign)
    expect(screen.getByText('No results match your current search or filters.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Paracetamol' })).not.toBeInTheDocument();
  });

  // 3 — Scenario 2: category filter is sent to the API
  it('filters by the selected category', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PatientMedicineCataloguePage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Paracetamol' });
    expect(await screen.findByRole('option', { name: 'Vitamins' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Category'), '2');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(listMedicines).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: '2', page: 1 })));
  });

  // 4 — "Medicine list fails to load → show an appropriate error message" and Retry reloads
  it('shows an error message when the catalogue fails to load and retries on demand', async () => {
    const user = userEvent.setup();
    listMedicines.mockRejectedValueOnce(new Error('network down'));
    render(<MemoryRouter><PatientMedicineCataloguePage /></MemoryRouter>);

    expect(await screen.findByText(/Unable to load medicines/)).toBeInTheDocument();
    expect(screen.queryByText('No medicines match your search.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Paracetamol' })).toBeInTheDocument();
    expect(screen.queryByText(/Unable to load medicines/)).not.toBeInTheDocument();
    expect(listMedicines).toHaveBeenCalledTimes(2);
  });

  // 5 - REQUIREMENT (user story: "Filter medicines by stock availability").
  //     The page must offer a stock-availability control and hide out-of-stock medicines when it is applied.
  //     Implemented on dev as the "Availability" select sending inStock=true (GCN-32).
  it('offers a stock-availability filter that hides out-of-stock medicines', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PatientMedicineCataloguePage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Paracetamol' });

    const availabilityFilter = screen.queryByLabelText(/availability|in stock/i);
    expect(availabilityFilter, 'Stock-availability filter is not implemented: no control labelled "Availability" / "In stock" on the catalogue page').not.toBeNull();

    await user.selectOptions(availabilityFilter, 'true');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(listMedicines).toHaveBeenLastCalledWith(expect.objectContaining({ inStock: 'true' })));
  });
});
