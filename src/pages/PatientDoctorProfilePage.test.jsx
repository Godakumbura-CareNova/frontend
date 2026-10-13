import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientDoctorProfilePage from './PatientDoctorProfilePage';

const { mockGetDoctorPublicProfile } = vi.hoisted(() => ({ mockGetDoctorPublicProfile: vi.fn() }));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/doctorService', () => ({ getDoctorPublicProfile: mockGetDoctorPublicProfile }));

const doctorId = '11111111-1111-1111-1111-111111111111';

const profile = {
  doctorId,
  fullName: 'Nimal Perera',
  specialization: 'Cardiologist',
  registrationNumber: 'SLMC-1001',
  biography: 'Heart specialist with a focus on preventive care.',
  consultationFee: 4500,
  profilePicturePath: '/uploads/profile-pictures/nimal.jpg',
  yearsOfExperience: 14,
  qualifications: [
    { id: 1, degree: 'MBBS', institution: 'University of Colombo', startYear: 2006, endYear: 2011 },
    { id: 2, degree: 'MD Cardiology', institution: 'PGIM', startYear: 2016, endYear: 2020 },
  ],
  experiences: [{ id: 3, position: 'Consultant Cardiologist', organization: 'National Hospital', startYear: 2020, endYear: null }],
  otherDetails: [{ id: 4, title: 'Fellow, Sri Lanka Heart Association', details: 'Elected 2021', startYear: 2021, endYear: null }],
  availability: { hasAvailableSlots: true, availableSlotCount: 2, nextAvailableSlotUtc: '2026-09-23T09:00:00Z' },
  upcomingSlots: [
    { id: 10, startUtc: '2026-09-23T09:00:00Z', endUtc: '2026-09-23T09:20:00Z' },
    { id: 11, startUtc: '2026-09-25T09:00:00Z', endUtc: '2026-09-25T09:20:00Z' },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/patient/doctors/${doctorId}`]}>
      <Routes>
        <Route path="/patient/doctors/:doctorId" element={<PatientDoctorProfilePage />} />
        <Route path="/patient/doctors" element={<h1>Search page</h1>} />
      </Routes>
    </MemoryRouter>,
  );

describe('PatientDoctorProfilePage', () => {
  it('redirects a visitor booking attempt to login', async () => {
    mockGetDoctorPublicProfile.mockResolvedValue(profile);
    render(<MemoryRouter initialEntries={[`/patient/doctors/${doctorId}`]}><Routes><Route path="/patient/doctors/:doctorId" element={<PatientDoctorProfilePage canBook={false} />} /><Route path="/login" element={<h1>Login page</h1>} /></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('link', { name: 'Book appointment' }));
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDoctorPublicProfile.mockResolvedValue(profile);
  });

  it('shows the selected doctor profile with availability', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(mockGetDoctorPublicProfile).toHaveBeenCalledWith(doctorId);
    expect(screen.getByText('Cardiologist', { selector: '.dp-spec-pill' })).toBeInTheDocument();
    expect(screen.getByText('Reg. No. SLMC-1001')).toBeInTheDocument();
    expect(screen.getByText('14 years of experience')).toBeInTheDocument();
    expect(screen.getByText(/Heart specialist with a focus/)).toBeInTheDocument();
    expect(screen.getByText('MBBS')).toBeInTheDocument();
    expect(screen.getByText('University of Colombo')).toBeInTheDocument();
    expect(screen.getByText('2006 - 2011')).toBeInTheDocument();
    expect(screen.getByText('Consultant Cardiologist')).toBeInTheDocument();
    expect(screen.getByText('2020 - Present')).toBeInTheDocument();
    expect(screen.getByText('Fellow, Sri Lanka Heart Association')).toBeInTheDocument();
    expect(screen.getByText('Elected 2021')).toBeInTheDocument();
    expect(screen.getByTestId('consultation-fee')).toHaveTextContent('LKR 4,500.00');
    expect(screen.getByText('per person, per consultation')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dr. Nimal Perera' })).toHaveAttribute('src', expect.stringContaining('/uploads/profile-pictures/nimal.jpg'));
    expect(screen.getByText(/open consultation slots/)).toHaveTextContent('2 open consultation slots.');
    expect(screen.getByRole('list', { name: 'Upcoming consultation slots' }).children).toHaveLength(2);
    expect(screen.getByTestId('availability-badge')).toHaveTextContent('2 open slots');
    expect(screen.getByRole('link', { name: /back to doctor search/i })).toHaveAttribute('href', '/patient/doctors');
    // Read-only for patients: no edit/remove controls from the doctor's own profile page.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('shows a clear message when the doctor has no open slots', async () => {
    mockGetDoctorPublicProfile.mockResolvedValue({
      ...profile,
      consultationFee: null,
      biography: null,
      qualifications: [],
      experiences: [],
      otherDetails: [],
      yearsOfExperience: null,
      availability: { hasAvailableSlots: false, availableSlotCount: 0, nextAvailableSlotUtc: null },
      upcomingSlots: [],
    });
    renderPage();

    expect(await screen.findByText('This doctor has no open consultation slots at the moment.')).toBeInTheDocument();
    expect(screen.getByTestId('availability-badge')).toHaveTextContent('No open slots');
    expect(screen.getByText('This doctor has not specified a consultation fee yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('consultation-fee')).not.toBeInTheDocument();
    expect(screen.getByText('No professional summary provided.')).toBeInTheDocument();
    expect(screen.getByText('No qualifications listed.')).toBeInTheDocument();
    expect(screen.getByText('No experience listed.')).toBeInTheDocument();
    expect(screen.getByText('No other details listed.')).toBeInTheDocument();
  });

  it('renders the available information when optional sections are missing from the response', async () => {
    mockGetDoctorPublicProfile.mockResolvedValue({
      doctorId,
      fullName: 'Nimal Perera',
      specialization: 'Cardiologist',
      registrationNumber: 'SLMC-1001',
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(screen.getByText('This doctor has not specified a consultation fee yet.')).toBeInTheDocument();
    expect(screen.getByText('This doctor has no open consultation slots at the moment.')).toBeInTheDocument();
    // No picture recorded: the initials tile stands in, the page still renders.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('NP')).toBeInTheDocument();
    expect(screen.getByText('No qualifications listed.')).toBeInTheDocument();
  });

  it('explains when the doctor has not published a profile', async () => {
    mockGetDoctorPublicProfile.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Doctor profile not available' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /back to doctor search/i })[0]).toHaveAttribute('href', '/patient/doctors');
  });

  it('shows an error and retries when the profile cannot be loaded', async () => {
    const user = userEvent.setup();
    mockGetDoctorPublicProfile.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent("This doctor's profile could not be loaded right now.");

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { name: 'Dr. Nimal Perera' })).toBeInTheDocument();
    expect(mockGetDoctorPublicProfile).toHaveBeenCalledTimes(2);
  });

  it('shows a network message without retry loops when the service is unreachable', async () => {
    mockGetDoctorPublicProfile.mockRejectedValue(new Error('Network Error'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the doctor directory.');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('navigates back to the search page', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Dr. Nimal Perera' });

    await user.click(screen.getByRole('link', { name: /back to doctor search/i }));

    expect(await screen.findByRole('heading', { name: 'Search page' })).toBeInTheDocument();
  });
});
