import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AboutUsPage from './AboutUsPage';
import ContactUsPage from './ContactUsPage';

// GCN-50 QA: five focused tests. PharmacyInformationPages.test.jsx already covers the About sections, the map
// failure, empty-form validation and failed-then-retry; these add the payload/reset, 429 retry and double-submit checks.

const { getPharmacyInformation, submitInquiry } = vi.hoisted(() => ({ getPharmacyInformation: vi.fn(), submitInquiry: vi.fn() }));
vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/pharmacyInformationService', () => ({ getPharmacyInformation, submitInquiry, pharmacyImageUrl: (path) => `http://api.test${path}` }));

const info = {
  introduction: 'Welcome to CareNova', background: 'Family pharmacy since 1998', mission: 'Accessible care', vision: 'Healthier community',
  services: [{ title: 'Pharmacy advice', description: 'Expert support' }], openingHours: [{ day: 'Monday', hours: '9am-5pm' }],
  address: '12 Galle Road', phone: '+94 11 234 5678', email: 'contact@example.test', locationDescription: '', mapEmbedUrl: '',
  images: [{ url: '/uploads/pharmacy-information/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', caption: 'Our team' }],
};
const entries = { Name: 'QA Visitor', Email: 'qa@example.test', Subject: 'Opening hours', Message: 'Please confirm your hours.' };
const contact = () => render(<MemoryRouter><ContactUsPage /></MemoryRouter>);
// The error text lives inside each <label>, so match the field by the start of its label.
const field = (label) => screen.getByLabelText(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
const send = () => screen.getByRole('button', { name: /send inquiry|retry inquiry/i });
const fill = async (user, values = entries) => { for (const [label, value] of Object.entries(values)) await user.type(field(label), value); };

describe('GCN-50 About Us and Contact Us (QA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPharmacyInformation.mockResolvedValue(info);
  });

  // 1. About Us rendering
  it('renders every About Us section from the public information, with photographs, and shows markup as plain text', async () => {
    getPharmacyInformation.mockResolvedValue({ ...info, introduction: '<img src=x onerror=alert(1)> Welcome' });
    const { container } = render(<MemoryRouter><AboutUsPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About CareNova');
    expect(await screen.findByText(/Welcome/)).toHaveTextContent('<img src=x onerror=alert(1)> Welcome');
    expect(getPharmacyInformation).toHaveBeenCalledWith(false);
    for (const text of ['Family pharmacy since 1998', 'Accessible care', 'Healthier community', 'Pharmacy advice', 'Expert support', 'Monday', '9am-5pm'])
      expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Our team' })).toHaveAttribute('src', 'http://api.test/uploads/pharmacy-information/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg');
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  // 2. Contact form validation
  it('blocks an incomplete or invalid inquiry with a message per field and never calls the API', async () => {
    const user = userEvent.setup();
    contact();
    await screen.findAllByText('12 Galle Road'); // shown in the contact details and the location section

    await user.click(send());
    for (const text of ['Name is required.', 'Email is required.', 'Subject is required.', 'Message is required.']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(field('Name')).toHaveAttribute('aria-invalid', 'true');

    await fill(user, { ...entries, Email: 'not-an-email', 'Phone (optional)': 'call me' });
    await user.click(send());
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument();
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument();
    expect(submitInquiry).not.toHaveBeenCalled();
  });

  // 3. Successful submission and reset
  it('sends the trimmed inquiry once, confirms with the server message and clears the form', async () => {
    const user = userEvent.setup();
    submitInquiry.mockResolvedValue({ id: '1', message: 'Your inquiry has been received. Thank you for contacting CareNova.' });
    contact();
    await fill(user, { Name: '  QA Visitor  ', Email: ' qa@example.test ', 'Phone (optional)': '+94 11 234 5678', Subject: ' Hours ', Message: '  Please confirm.  ' });

    await user.click(send());

    expect(await screen.findByRole('status')).toHaveTextContent('Your inquiry has been received. Thank you for contacting CareNova.');
    expect(submitInquiry).toHaveBeenCalledTimes(1);
    expect(submitInquiry).toHaveBeenCalledWith({ name: 'QA Visitor', email: 'qa@example.test', phone: '+94 11 234 5678', subject: 'Hours', message: 'Please confirm.' });
    for (const label of ['Name', 'Email', 'Phone (optional)', 'Subject', 'Message']) expect(field(label)).toHaveValue('');
  });

  // 4. API failure and retry: the visitor's text is never lost and a failure is never reported as success
  it('keeps the typed inquiry on a rate-limit or outage response, shows the server message, and a retry succeeds', async () => {
    const user = userEvent.setup();
    submitInquiry
      .mockRejectedValueOnce({ response: { status: 429, data: { message: 'Too many inquiries. Please wait a minute and try again.' } } })
      .mockRejectedValueOnce({ response: { status: 503, data: { message: 'This service is temporarily unavailable. Please try again.' } } })
      .mockResolvedValue({ message: 'Saved.' });
    contact();
    await fill(user);

    await user.click(send());
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many inquiries. Please wait a minute and try again.');
    expect(field('Message')).toHaveValue('Please confirm your hours.');

    await user.click(screen.getByRole('button', { name: 'Retry inquiry' }));
    expect(await screen.findByText('This service is temporarily unavailable. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    expect(field('Name')).toHaveValue('QA Visitor');

    await user.click(screen.getByRole('button', { name: 'Retry inquiry' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(submitInquiry).toHaveBeenCalledTimes(3);
  });

  // 5. Duplicate submission prevention
  it('sends a single request when the visitor clicks or submits repeatedly while it is in flight', async () => {
    const user = userEvent.setup();
    let finish;
    submitInquiry.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    contact();
    await fill(user);

    await user.click(send());
    const busy = await screen.findByRole('button', { name: 'Sending…' });
    expect(busy).toBeDisabled();
    expect(field('Name')).toBeDisabled();
    await user.click(busy);
    await user.click(busy);
    fireEvent.submit(busy.closest('form'));
    expect(submitInquiry).toHaveBeenCalledTimes(1);

    finish({ message: 'Saved.' });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send inquiry' })).toBeEnabled());
    expect(submitInquiry).toHaveBeenCalledTimes(1);
  });
});
