import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PatientAppointmentBookingPage from '../../pages/PatientAppointmentBookingPage';

const api = vi.hoisted(() => ({ getDoctorPublicProfile: vi.fn(), bookAppointment: vi.fn() }));
vi.mock('../../services/doctorService', () => ({ getDoctorPublicProfile: api.getDoctorPublicProfile }));
vi.mock('../../services/appointmentService', () => ({ bookAppointment: api.bookAppointment }));
vi.mock('../../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));

const Where = ({ label }) => <p data-testid="where">{label}:{useLocation().pathname}</p>;
const doctor = { fullName: 'Dr Test', upcomingSlots: [{ id: 31, startUtc: '2026-10-20T04:00:00Z', endUtc: '2026-10-20T04:30:00Z' }] };
const booked = { id: 42, appointmentReference: 'CN-APT-42', doctorName: 'Dr Test', appointmentStartUtc: '2026-10-20T04:00:00Z', status: 'Scheduled' };

beforeEach(() => { vi.resetAllMocks(); api.getDoctorPublicProfile.mockResolvedValue(doctor); api.bookAppointment.mockResolvedValue(booked); });
afterEach(cleanup);

it('V4 shows Continue to Payment after a successful booking and opens the payment page of that appointment', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter initialEntries={['/patient/doctors/5/book']}>
      <Routes>
        <Route path="/patient/doctors/:doctorId/book" element={<PatientAppointmentBookingPage />} />
        <Route path="/patient/appointments/:appointmentId/payment" element={<Where label="payment" />} />
        <Route path="/patient/doctors" element={<Where label="doctors" />} />
      </Routes>
    </MemoryRouter>);

  await screen.findByRole('heading', { name: 'Book Appointment' });
  expect(screen.queryByRole('button', { name: 'Continue to Payment' })).not.toBeInTheDocument();
  await user.click(container.querySelector('.pd-slot'));                 // the date
  await user.click(container.querySelectorAll('.pd-slot')[1]);           // the time slot
  await user.click(screen.getByRole('button', { name: 'Confirm Appointment' }));

  expect(api.bookAppointment).toHaveBeenCalledWith({ doctorId: '5', slotId: 31 });
  expect(await screen.findByRole('heading', { name: 'Appointment booked successfully' })).toBeInTheDocument();
  expect(screen.getByText('CN-APT-42')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Back to doctors' })).toBeInTheDocument();
  expect(screen.queryByTestId('where')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Continue to Payment' }));
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('payment:/patient/appointments/42/payment'));
});
