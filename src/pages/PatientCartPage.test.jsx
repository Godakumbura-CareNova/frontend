import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PatientCartPage from './PatientCartPage';

// GCN-30 vitest 1–4: cart view, quantity update, remove, and the over-stock error.

const { get, updateItem, removeItem } = vi.hoisted(() => ({ get: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/cartApi', () => ({ cartApi: { get, updateItem, removeItem } }));

const item = (id, name, unitPrice, quantity) => ({ id, medicineId: id, medicineName: name, unitPrice, quantity, lineTotal: unitPrice * quantity });
const cart = (readyItems, extra = {}) => ({
  readyItems, pendingItems: [], attentionItems: [],
  readySubtotal: readyItems.reduce((sum, i) => sum + i.lineTotal, 0), pendingSubtotal: 0, attentionSubtotal: 0,
  cartTotal: readyItems.reduce((sum, i) => sum + i.lineTotal, 0), ...extra,
});
const paracetamol = item(1, 'Paracetamol', 150, 2);
const vitaminC = item(2, 'Vitamin C', 300, 1);

const renderPage = () => render(<MemoryRouter><PatientCartPage /></MemoryRouter>);
const row = (name) => screen.getByRole('heading', { name, level: 3 }).closest('.cart-item');

describe('PatientCartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: cart([paracetamol, vitaminC]) });
  });

  // 1 — Scenario 1: all items, quantities, line totals and the running total are displayed
  it('shows every cart item with quantity, line total and the cart total', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Paracetamol' })).toBeInTheDocument();
    expect(within(row('Paracetamol')).getByText('Quantity: 2')).toBeInTheDocument();
    expect(within(row('Paracetamol')).getByText('LKR 150.00 each')).toBeInTheDocument();
    expect(within(row('Paracetamol')).getByText('LKR 300.00')).toBeInTheDocument();
    expect(within(row('Vitamin C')).getByText('Quantity: 1')).toBeInTheDocument();
    const total = screen.getByText('Cart total').closest('.cart-total');
    expect(within(total).getByText('LKR 600.00')).toBeInTheDocument();
  });

  // 2 — Scenario 2: increasing a quantity calls the API and the total updates from the response
  it('updates the quantity and recalculates the total', async () => {
    const user = userEvent.setup();
    updateItem.mockResolvedValue({ data: cart([item(1, 'Paracetamol', 150, 3), vitaminC]) });
    renderPage();
    await screen.findByRole('heading', { name: 'Paracetamol' });

    await user.click(screen.getByLabelText('Increase Paracetamol'));

    await waitFor(() => expect(updateItem).toHaveBeenCalledWith(1, { quantity: 3 }));
    expect(await within(row('Paracetamol')).findByText('Quantity: 3')).toBeInTheDocument();
    expect(within(row('Paracetamol')).getByText('LKR 450.00')).toBeInTheDocument();
    expect(within(screen.getByText('Cart total').closest('.cart-total')).getByText('LKR 750.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease Vitamin C')).toBeDisabled(); // quantity 1 cannot go lower
  });

  // 3 — Scenario 3: removing an item drops it and recalculates; removing the last one shows the empty-cart message
  it('removes an item, recalculates the total, and shows the empty-cart message when nothing is left', async () => {
    const user = userEvent.setup();
    updateItem.mockResolvedValue({ data: cart([]) });
    removeItem
      .mockResolvedValueOnce({ data: cart([paracetamol]) })
      .mockResolvedValueOnce({ data: cart([]) });
    renderPage();
    await screen.findByRole('heading', { name: 'Vitamin C' });

    await user.click(within(row('Vitamin C')).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(removeItem).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Vitamin C' })).not.toBeInTheDocument());
    expect(within(screen.getByText('Cart total').closest('.cart-total')).getByText('LKR 300.00')).toBeInTheDocument();

    await user.click(within(row('Paracetamol')).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.queryByText('Cart total')).not.toBeInTheDocument();
  });

  // 4 — "Updated quantity exceeds available stock → error message and prevent the update"
  it('shows the stock error and keeps the old quantity when the update exceeds stock', async () => {
    const user = userEvent.setup();
    updateItem.mockRejectedValue({ response: { status: 400, data: { message: 'Quantity must be between 1 and 2.' } } });
    renderPage();
    await screen.findByRole('heading', { name: 'Paracetamol' });

    await user.click(screen.getByLabelText('Increase Paracetamol'));

    expect(await screen.findByText('Quantity must be between 1 and 2.')).toBeInTheDocument();
    expect(within(row('Paracetamol')).getByText('Quantity: 2')).toBeInTheDocument();
    expect(within(screen.getByText('Cart total').closest('.cart-total')).getByText('LKR 600.00')).toBeInTheDocument();
  });
});
