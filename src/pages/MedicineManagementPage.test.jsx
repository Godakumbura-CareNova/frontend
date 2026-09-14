import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MedicineManagementPage from './MedicineManagementPage';

const { listMedicines, listCategories, create, uploadImage } = vi.hoisted(() => ({ listMedicines: vi.fn(), listCategories: vi.fn(), create: vi.fn(), uploadImage: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../api/medicineApi', () => ({ medicineApi: { list: listMedicines, create, uploadImage } }));
vi.mock('../api/categoryApi', () => ({ categoryApi: { list: listCategories } }));

describe('MedicineManagementPage', () => {
  beforeEach(() => {
    listMedicines.mockResolvedValue({ data: [] });
    listCategories.mockResolvedValue({ data: [{ id: 1, name: 'Antibiotics' }] });
    create.mockResolvedValue({ data: { id: 9 } });
    uploadImage.mockResolvedValue({ data: {} });
  });

  it('clears the selected image after the medicine is saved', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><MedicineManagementPage /></MemoryRouter>);
    expect(screen.getByText('Medicine Management').closest('section')).toHaveClass('medicine-management-dashboard');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Azithromycin 500mg');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Antibiotic tablets');
    await user.selectOptions(screen.getByLabelText('Category'), '1');
    await user.type(screen.getByRole('spinbutton', { name: 'Price (LKR)' }), '450');
    const input = screen.getByLabelText('Medicine image');
    await user.upload(input, new File(['image'], 'azithromycin.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: 'Add medicine' }));
    await waitFor(() => expect(input.files).toHaveLength(0));
  });
});
