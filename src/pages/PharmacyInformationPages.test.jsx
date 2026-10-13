import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AboutUsPage from './AboutUsPage';
import ContactUsPage from './ContactUsPage';
import { getPharmacyInformation, submitInquiry } from '../services/pharmacyInformationService';
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/pharmacyInformationService', () => ({ getPharmacyInformation: vi.fn(), submitInquiry: vi.fn(), pharmacyImageUrl: path => path }));
const info = { introduction: 'Welcome to CareNova', background: 'Pharmacy background', mission: 'Accessible care', vision: 'Healthier community', services: [{ title: 'Pharmacy advice', description: 'Expert support' }], openingHours: [{ day: 'Monday', hours: '9am–5pm' }], address: 'Pharmacy address', phone: '+94112345678', email: 'contact@example.test', locationDescription: 'Near the town centre', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test', images: [] };
beforeEach(() => { vi.clearAllMocks(); getPharmacyInformation.mockResolvedValue(info); });
test('About displays all sections with honest missing-photo information', async () => {
  render(<MemoryRouter><AboutUsPage /></MemoryRouter>);
  expect(await screen.findByText('Pharmacy background')).toBeInTheDocument();
  for (const text of ['Accessible care', 'Healthier community', 'Expert support', 'Monday', '9am–5pm', 'Pharmacy and staff photographs have not been published yet.']) expect(screen.getByText(text)).toBeInTheDocument();
});
test('information loading failures can be retried', async () => {
  getPharmacyInformation.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(info);
  render(<MemoryRouter><AboutUsPage /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Pharmacy background')).toBeInTheDocument();
});
test('map failure retains the readable location and map link', async () => {
  render(<MemoryRouter><ContactUsPage /></MemoryRouter>);
  fireEvent.error(await screen.findByTitle('Pharmacy location map'));
  expect(screen.getByText(/The map is unavailable/)).toBeInTheDocument();
  expect(screen.getByText('Near the town centre')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open location in maps' })).toBeInTheDocument();
});
test('invalid inquiry fields prevent submission', async () => {
  render(<MemoryRouter><ContactUsPage /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: 'Send inquiry' }));
  expect(screen.getByText('Name is required.')).toBeInTheDocument();
  expect(submitInquiry).not.toHaveBeenCalled();
});
test('failed inquiry keeps entered details and retry succeeds', async () => {
  submitInquiry.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ message: 'Inquiry saved successfully.' });
  render(<MemoryRouter><ContactUsPage /></MemoryRouter>);
  for (const [label, value] of [['Name', 'Visitor'], ['Email', 'visitor@example.test'], ['Subject', 'Hours'], ['Message', 'Please confirm hours.']]) await userEvent.type(screen.getByLabelText(label), value);
  await userEvent.click(screen.getByRole('button', { name: 'Send inquiry' }));
  expect(await screen.findByText('Unable to send your inquiry. Please try again.')).toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('Please confirm hours.');
  await userEvent.click(screen.getByRole('button', { name: 'Retry inquiry' }));
  expect(await screen.findByText('Inquiry saved successfully.')).toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('');
});
