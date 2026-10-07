import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientAppointmentBookingPage from './PatientAppointmentBookingPage';

// GCN-44 QA core suite (7 cases): doctor appointment booking and time slot selection.

const { getDoctorPublicProfile, bookAppointment } = vi.hoisted(() => ({
  getDoctorPublicProfile: vi.fn(),
  bookAppointment: vi.fn(),
}));

vi.mock('../components/DashboardLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../services/doctorService', () => ({ getDoctorPublicProfile }));
vi.mock('../services/appointmentService', () => ({ bookAppointment }));

const doctorId = '22222222-2222-2222-2222-222222222222';

// Midday UTC slots so the date is the same in every timezone from UTC-11 to UTC+11.
const slotA1 = { id: 101, startUtc: '2026-10-20T09:00:00Z', endUtc: '2026-10-20T09:20:00Z' };
const slotA2 = { id: 102, startUtc: '2026-10-20T10:00:00Z', endUtc: '2026-10-20T10:20:00Z' };
const slotB1 = { id: 201, startUtc: '2026-10-22T11:00:00Z', endUtc: '2026-10-22T11:20:00Z' };

const doctor = (slots = [slotA1, slotA2, slotB1]) => ({
  doctorId,
  fullName: 'Nimal Perera',
  availability: { hasAvailableSlots: slots.length > 0, availableSlotCount: slots.length, nextAvailableSlotUtc: slots[0]?.startUtc ?? null },
  upcomingSlots: slots,
});

// Same formatting the page uses, so assertions do not depend on the machine's locale/timezone.
const dateLabel = (iso) => new Date(iso).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' });
const slotLabel = (slot) => `${timeLabel(slot.startUtc)} – ${timeLabel(slot.endUtc)}`;

const booked = {
  id: 7,
  appointmentReference: 'CN-APT-ABCDEF1234',
  patientId: '11111111-1111-1111-1111-111111111111',
  doctorId,
  doctorName: 'Nimal Perera',
  slotId: slotA1.id,
  appointmentStartUtc: slotA1.startUtc,
  appointmentEndUtc: slotA1.endUtc,
  status: 'Booked',
  createdAtUtc: '2026-10-07T05:00:00Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/patient/doctors/${doctorId}/book`]}>
      <Routes>
        <Route path="/patient/doctors/:doctorId/book" element={<PatientAppointmentBookingPage />} />
      </Routes>
    </MemoryRouter>,
  );

const pickDate = async (user, iso) => user.click(await screen.findByRole('button', { name: dateLabel(iso) }));
const pickSlot = async (user, slot) => user.click(await screen.findByRole('button', { name: slotLabel(slot) }));
const confirm = (user) => user.click(screen.getByRole('button', { name: 'Confirm Appointment' }));

describe('PatientAppointmentBookingPage (GCN-44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDoctorPublicProfile.mockResolvedValue(doctor());
  });

  // GCN44-VT-01 (AC2)
  it('GCN44-VT-01: displays the available appointment dates and the time slots of a date', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Book Appointment' })).toBeInTheDocument();
    expect(getDoctorPublicProfile).toHaveBeenCalledWith(doctorId);
    expect(screen.getByRole('button', { name: dateLabel(slotA1.startUtc) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: dateLabel(slotB1.startUtc) })).toBeInTheDocument();

    await pickDate(user, slotA1.startUtc);
    expect(screen.getByRole('button', { name: slotLabel(slotA1) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: slotLabel(slotA2) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: slotLabel(slotB1) })).not.toBeInTheDocument();
  });

  // GCN44-VT-02 (AC1, AC2)
  it('GCN44-VT-02: lets the patient select an appointment date and time slot', async () => {
    const user = userEvent.setup();
    renderPage();

    await pickDate(user, slotA1.startUtc);
    expect(screen.getByRole('button', { name: dateLabel(slotA1.startUtc) })).toHaveClass('selected');

    await pickSlot(user, slotA2);
    expect(screen.getByRole('button', { name: slotLabel(slotA2) })).toHaveClass('selected');
    expect(screen.getByRole('button', { name: slotLabel(slotA1) })).not.toHaveClass('selected');
  });

  // GCN44-VT-03 (AC4)
  it('GCN44-VT-03: shows validation and does not call the booking API when required selections are missing', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'Book Appointment' });
    await confirm(user);
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a doctor, appointment date, and time slot.');

    await pickDate(user, slotA1.startUtc); // date only, still no slot
    await confirm(user);
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a doctor, appointment date, and time slot.');
    expect(bookAppointment).not.toHaveBeenCalled();
  });

  // GCN44-VT-04 (AC1)
  it('GCN44-VT-04: calls the appointment service with the correct doctorId and slotId', async () => {
    const user = userEvent.setup();
    bookAppointment.mockResolvedValue(booked);
    renderPage();

    await pickDate(user, slotA1.startUtc);
    await pickSlot(user, slotA1);
    await confirm(user);

    await waitFor(() => expect(bookAppointment).toHaveBeenCalledTimes(1));
    expect(bookAppointment).toHaveBeenCalledWith({ doctorId, slotId: slotA1.id });
  });

  // GCN44-VT-05 (AC5)
  it('GCN44-VT-05: displays reference, doctor name, date, time and status after a successful booking', async () => {
    const user = userEvent.setup();
    bookAppointment.mockResolvedValue(booked);
    renderPage();

    await pickDate(user, slotA1.startUtc);
    await pickSlot(user, slotA1);
    await confirm(user);

    expect(await screen.findByRole('heading', { name: 'Appointment booked successfully' })).toBeInTheDocument();
    const line = (label) => screen.getByText(new RegExp(`^${label}:`)).closest('p');
    expect(line('Appointment reference')).toHaveTextContent('CN-APT-ABCDEF1234');
    expect(line('Doctor')).toHaveTextContent('Nimal Perera');
    expect(line('Date')).toHaveTextContent(dateLabel(booked.appointmentStartUtc));
    expect(line('Time')).toHaveTextContent(timeLabel(booked.appointmentStartUtc));
    expect(line('Status')).toHaveTextContent('Booked');
  });

  // GCN44-VT-06 (AC3)
  it('GCN44-VT-06: shows the unavailable-slot message on HTTP 409 and does not show a successful booking', async () => {
    const user = userEvent.setup();
    const message = 'This appointment slot has already been booked.';
    bookAppointment.mockRejectedValue({ response: { status: 409, data: { message } } });
    renderPage();

    await pickDate(user, slotA1.startUtc);
    await pickSlot(user, slotA1);
    await confirm(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Appointment booked successfully' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Appointment reference/)).not.toBeInTheDocument();
  });

  // GCN44-VT-07 (technical failure)
  it('GCN44-VT-07: shows "Appointment creation failed. Please try again." on a technical booking failure', async () => {
    const user = userEvent.setup();
    bookAppointment.mockRejectedValue({ response: { status: 500, data: {} } });
    renderPage();

    await pickDate(user, slotA1.startUtc);
    await pickSlot(user, slotA1);
    await confirm(user);

    expect(await screen.findByText('Appointment creation failed. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Appointment booked successfully' })).not.toBeInTheDocument();
  });
});
