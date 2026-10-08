import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import AdminPharmacyInformationPage from './AdminPharmacyInformationPage';
import { getPharmacyInformation, savePharmacyInformation } from '../services/pharmacyInformationService';
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/pharmacyInformationService', () => ({ getPharmacyInformation: vi.fn(), savePharmacyInformation: vi.fn(), uploadPharmacyImage: vi.fn(), pharmacyImageUrl: path => path }));
const information = { introduction: 'CareNova', services: [], openingHours: [], images: [], revision: 'initial' };
beforeEach(() => { vi.clearAllMocks(); getPharmacyInformation.mockResolvedValue(information); });
test('admin saves information and receives the new revision', async () => {
  savePharmacyInformation.mockImplementation(async content => ({ ...content, revision: 'updated' }));
  render(<AdminPharmacyInformationPage />);
  await userEvent.type(await screen.findByLabelText('Mission'), 'Accessible care');
  await userEvent.click(screen.getByRole('button', { name: 'Save information' }));
  expect(await screen.findByText('Pharmacy information saved successfully.')).toBeInTheDocument();
  expect(savePharmacyInformation.mock.calls[0][0]).toMatchObject({ mission: 'Accessible care', revision: 'initial' });
});
test('stale save displays conflict without losing edits', async () => {
  savePharmacyInformation.mockRejectedValue({ response: { status: 409, data: { message: 'Reload before saving again.' } } });
  render(<AdminPharmacyInformationPage />);
  await userEvent.type(await screen.findByLabelText('Mission'), 'Keep this edit');
  await userEvent.click(screen.getByRole('button', { name: 'Save information' }));
  expect(await screen.findByText('Reload before saving again.')).toBeInTheDocument();
  expect(screen.getByLabelText('Mission')).toHaveValue('Keep this edit');
});
