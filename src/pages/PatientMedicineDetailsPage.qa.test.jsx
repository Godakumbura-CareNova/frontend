import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientMedicineDetailsPage from './PatientMedicineDetailsPage';

// GCN-26 unit tests for the medicine details page and quantity selector.
// Positive P5–P8, negative N4–N6 (P1–P4 / N1–N3 are xunit tests on the details API).

const { getMedicine, addItem } = vi.hoisted(() => ({ getMedicine: vi.fn(), addItem: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/catalogueApi', () => ({ catalogueApi: { getMedicine } }));
vi.mock('../api/cartApi', () => ({ cartApi: { addItem } })); // dev adds to the saved cart since GCN-30

const amoxicillin = {
  id: 7, name: 'Amoxicillin 500mg', description: 'Broad-spectrum antibiotic capsules', categoryName: 'Antibiotics',
  price: 450.75, stockQuantity: 3, prescriptionRequired: false, availabilityStatus: 'Available',
};

const renderPage = (id = 7) => render(
  <MemoryRouter initialEntries={[`/patient/medicines/${id}`]}>
    <Routes><Route path="/patient/medicines/:medicineId" element={<PatientMedicineDetailsPage />} /></Routes>
  </MemoryRouter>,
);

// dev replaced the read-only counter with a typed input (GCN-32)
const quantityShown = () => Number(within(document.querySelector('.quantity-control')).getByLabelText('Quantity').value);

describe('PatientMedicineDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getMedicine.mockResolvedValue({ data: amoxicillin });
  });

  // P5 — detail view shows name, description, category, price, stock and prescription status
  it('shows name, description, category, price, available stock and prescription status', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Amoxicillin 500mg' })).toBeInTheDocument();
    expect(screen.getByText('Broad-spectrum antibiotic capsules')).toBeInTheDocument();
    expect(screen.getByText('Antibiotics')).toBeInTheDocument();
    expect(screen.getByText('LKR 450.75')).toBeInTheDocument();
    expect(screen.getByText('3 units available')).toBeInTheDocument();
    expect(screen.getByText('No prescription required')).toBeInTheDocument();
    expect(getMedicine).toHaveBeenCalledWith('7');
  });

  // P6 — Scenario 1: a valid quantity is accepted for adding to cart
  it('accepts a valid quantity, updates the total and stores it for the cart', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Amoxicillin 500mg' });

    await user.click(screen.getByLabelText('Increase quantity'));
    expect(quantityShown()).toBe(2);
    expect(screen.getByText('Total: LKR 901.50')).toBeInTheDocument();

    addItem.mockResolvedValue({ data: { readyItems: [{ medicineId: 7, quantity: 2 }] } });
    await user.click(screen.getByRole('button', { name: /add to cart/i }));

    // dev sends non-prescription items straight to the saved cart (GCN-30) instead of sessionStorage
    expect(addItem).toHaveBeenCalledWith({ medicineId: 7, quantity: 2 });
    expect(await screen.findByText(/added to your cart/i)).toBeInTheDocument();
  });

  // P7 — quantity selector is capped at the available stock
  it('does not let the quantity exceed the available stock', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Amoxicillin 500mg' });

    for (let i = 0; i < 6; i += 1) await user.click(screen.getByLabelText('Increase quantity'));

    expect(quantityShown()).toBe(3);
    expect(screen.getByText('Total: LKR 1352.25')).toBeInTheDocument();
  });

  // P8 — quantity selector never drops below 1, and prescription medicines route to prescription upload
  it('keeps the minimum quantity at 1 and switches the action for prescription medicines', async () => {
    const user = userEvent.setup();
    getMedicine.mockResolvedValue({ data: { ...amoxicillin, prescriptionRequired: true } });
    renderPage();
    await screen.findByRole('heading', { name: 'Amoxicillin 500mg' });

    await user.click(screen.getByLabelText('Decrease quantity'));
    await user.click(screen.getByLabelText('Decrease quantity'));

    expect(quantityShown()).toBe(1);
    expect(screen.getByText('Prescription required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to prescription upload/i })).toBeInTheDocument();
  });

  // N4 — "Medicine details fail to load → show an appropriate error message"
  it('shows an error message when the medicine details fail to load', async () => {
    getMedicine.mockRejectedValue({ response: { status: 404, data: { message: 'Medicine is unavailable.' } } });
    renderPage(999);

    expect(await screen.findByText('This medicine is unavailable.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Increase quantity')).not.toBeInTheDocument();
  });

  // N5 — REQUIREMENT, Scenario 2: "quantity greater than available stock → an error message is displayed".
  //      Implemented on dev: the + button shows "Only N units are available." (GCN-32).
  it('shows an error message when the customer tries to exceed the available stock', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Amoxicillin 500mg' });

    for (let i = 0; i < 3; i += 1) await user.click(screen.getByLabelText('Increase quantity'));

    expect(quantityShown()).toBe(3);
    expect(
      screen.queryByText(/only 3 units (are )?available|exceeds available stock|not enough stock|maximum quantity/i),
      'Scenario 2 not met: quantity was capped at stock but no error message was displayed to the customer',
    ).not.toBeNull();
  });

  // N6 — REQUIREMENT, Scenario 3: "zero, negative or non-numeric quantity → a validation message is displayed".
  //      Implemented on dev: a typed Quantity input with inline validation (GCN-32).
  it('validates a typed quantity of zero, negative or non-numeric with a message', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Amoxicillin 500mg' });

    const input = screen.queryByRole('spinbutton', { name: /quantity/i }) ?? screen.queryByLabelText(/^quantity$/i);
    expect(input, 'Scenario 3 not met: the page has no quantity input field, so zero/negative/non-numeric values cannot be entered or validated').not.toBeNull();

    for (const value of ['0', '-1', 'abc']) {
      await user.clear(input);
      await user.type(input, value);
      // validation is inline and the action button is disabled while the value is invalid
      expect(screen.getByRole('alert')).toHaveTextContent(/enter a quantity of at least 1|enter a whole number|enter a valid quantity|quantity must be|invalid quantity/i);
      expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
    }
  });
});
