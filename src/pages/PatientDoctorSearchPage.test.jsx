import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PatientDoctorSearchPage from './PatientDoctorSearchPage';

const CurrentPath = () => <output data-testid="path">{useLocation().pathname}</output>;

const { mockSearchDoctors, mockGetSpecializations } = vi.hoisted(() => ({
  mockSearchDoctors: vi.fn(),
  mockGetSpecializations: vi.fn(),
}));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/doctorService', () => ({
  searchDoctors: mockSearchDoctors,
  getDoctorSpecializations: mockGetSpecializations,
}));

const nimal = {
  doctorId: '11111111-1111-1111-1111-111111111111',
  fullName: 'Nimal Perera',
  specialization: 'Cardiologist',
  registrationNumber: 'SLMC-1001',
  biography: 'Heart specialist.',
  qualifications: ['MBBS', 'MD Cardiology'],
  yearsOfExperience: 14,
  availability: { hasAvailableSlots: true, availableSlotCount: 2, nextAvailableSlotUtc: '2026-09-23T09:00:00Z' },
};

const kamala = {
  doctorId: '22222222-2222-2222-2222-222222222222',
  fullName: 'Kamala Silva',
  specialization: 'General Practitioner',
  registrationNumber: 'SLMC-1002',
  biography: null,
  qualifications: ['MBBS'],
  yearsOfExperience: 0,
  availability: { hasAvailableSlots: false, availableSlotCount: 0, nextAvailableSlotUtc: null },
};

const resultOf = (items, extra = {}) => ({ items, page: 1, pageSize: 12, totalCount: items.length, totalPages: items.length ? 1 : 0, ...extra });

const renderPage = () => render(<MemoryRouter><PatientDoctorSearchPage /><CurrentPath /></MemoryRouter>);

describe('PatientDoctorSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSpecializations.mockResolvedValue(['Cardiologist', 'General Practitioner']);
    mockSearchDoctors.mockResolvedValue(resultOf([nimal, kamala]));
  });

  it('lists every doctor on load with their basic information and availability', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Kamala Silva' })).toBeInTheDocument();
    expect(screen.getByText('2 doctors available to consult')).toBeInTheDocument();
    expect(screen.getByText('Cardiologist', { selector: '.pd-card-spec' })).toBeInTheDocument();
    expect(screen.getByText('Reg. No. SLMC-1001')).toBeInTheDocument();
    expect(screen.getByText('14 years of experience')).toBeInTheDocument();
    expect(screen.getByText('MD Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Heart specialist.')).toBeInTheDocument();
    expect(screen.getByText('2 open slots')).toBeInTheDocument();
    expect(screen.getByText('No open slots')).toBeInTheDocument();
    expect(mockSearchDoctors).toHaveBeenCalledWith({ search: '', specialization: '', availableOnly: false, page: 1, pageSize: 12 });
  });

  it('populates the specialization filter from the API', async () => {
    renderPage();

    const select = await screen.findByLabelText('Specialization');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    expect(within(select).getByRole('option', { name: 'Cardiologist' })).toBeInTheDocument();
  });

  it('searches with the entered criteria and shows the matching doctors', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });
    mockSearchDoctors.mockResolvedValueOnce(resultOf([nimal]));

    await user.type(screen.getByLabelText('Name or specialization'), 'Nimal');
    await user.selectOptions(await screen.findByLabelText('Specialization'), 'Cardiologist');
    await user.click(screen.getByLabelText(/open slots only/i));
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText('1 doctor matching "Nimal" in Cardiologist with open slots')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dr. Kamala Silva' })).not.toBeInTheDocument();
    expect(mockSearchDoctors).toHaveBeenLastCalledWith({ search: 'Nimal', specialization: 'Cardiologist', availableOnly: true, page: 1, pageSize: 12 });
  });

  it('shows "No doctors found" when nothing matches and can return to the full list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });
    mockSearchDoctors.mockResolvedValueOnce(resultOf([]));

    await user.type(screen.getByLabelText('Name or specialization'), 'Zzzz');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByRole('heading', { name: 'No doctors found' })).toBeInTheDocument();
    expect(screen.getByText(/No doctors match your search/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show all doctors/i }));

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name or specialization')).toHaveValue('');
  });

  it('shows a validation message for invalid criteria and does not call the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });
    mockSearchDoctors.mockClear();

    await user.type(screen.getByLabelText('Name or specialization'), 'N');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter at least 2 characters to search.');
    expect(mockSearchDoctors).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Name or specialization'));
    await user.type(screen.getByLabelText('Name or specialization'), 'Nimal<script>');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Use only letters, numbers/);
    expect(mockSearchDoctors).not.toHaveBeenCalled();
  });

  it('clears the validation message once the patient edits the field', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });

    await user.type(screen.getByLabelText('Name or specialization'), 'N');
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name or specialization'), 'i');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error with retry when doctors cannot be loaded', async () => {
    const user = userEvent.setup();
    mockSearchDoctors.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Doctor information could not be loaded right now.');
    expect(screen.queryByRole('heading', { name: 'No doctors found' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a network message when the service is unreachable', async () => {
    mockSearchDoctors.mockRejectedValueOnce(new Error('Network Error'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the doctor directory.');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows the server validation message when the API rejects the criteria', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });
    mockSearchDoctors.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Please check your search criteria.', errors: { Search: ['Search text must not exceed 100 characters.'] } } },
    });

    await user.type(screen.getByLabelText('Name or specialization'), 'Perera');
    await user.click(screen.getByRole('button', { name: /search/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent.includes('Please check your search criteria.'))).toBe(true);
    expect(alerts.some((alert) => alert.textContent.includes('Search text must not exceed 100 characters.'))).toBe(true);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('navigates to the doctor profile when a doctor is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = (await screen.findByRole('article', { name: 'Dr. Nimal Perera' }));

    await user.click(within(card).getByRole('button', { name: /view profile/i }));

    expect(screen.getByTestId('path')).toHaveTextContent('/patient/doctors/11111111-1111-1111-1111-111111111111');
  });

  it('pages through results', async () => {
    const user = userEvent.setup();
    mockSearchDoctors.mockResolvedValue(resultOf([nimal], { totalCount: 13, totalPages: 2 }));
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    mockSearchDoctors.mockResolvedValueOnce(resultOf([kamala], { page: 2, totalCount: 13, totalPages: 2 }));

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: 'Dr. Kamala Silva' })).toBeInTheDocument();
    expect(mockSearchDoctors).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('still lets patients search when the specialization list fails to load', async () => {
    mockGetSpecializations.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Specialization')).getAllByRole('option')).toHaveLength(1);
  });
});
