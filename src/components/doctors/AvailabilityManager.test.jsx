import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilityManager from './AvailabilityManager';
import { ToastProvider } from '../../context/ToastContext';

// Confirmations are toasts now, so the manager is mounted under the provider that renders them.
const renderManager = (ui) => render(ui, { wrapper: ToastProvider });

/** Picks a time with the hour / minute / AM-PM selects. */
const chooseTime = async (user, legend, hour, minute, meridiem) => {
  await user.selectOptions(screen.getByLabelText(`${legend} hour`), hour);
  await user.selectOptions(screen.getByLabelText(`${legend} minutes`), minute);
  await user.selectOptions(screen.getByLabelText(`${legend} AM or PM`), meridiem);
};

const { mockGetMyAvailability, mockAddMyAvailability, mockDeleteMyAvailabilitySlot } = vi.hoisted(() => ({
  mockGetMyAvailability: vi.fn(),
  mockAddMyAvailability: vi.fn(),
  mockDeleteMyAvailabilitySlot: vi.fn(),
}));

vi.mock('../../services/doctorService', () => ({
  getMyAvailability: mockGetMyAvailability,
  addMyAvailability: mockAddMyAvailability,
  deleteMyAvailabilitySlot: mockDeleteMyAvailabilitySlot,
}));

// A fixed "now" so the future/past rules are deterministic; local time to match the date/time inputs.
const NOW = new Date(2026, 8, 22, 9, 0, 0);
const isoAt = (daysAhead, hour, minute = 0) => new Date(2026, 8, 22 + daysAhead, hour, minute).toISOString();

const slots = [
  { id: 1, startUtc: isoAt(1, 9), endUtc: isoAt(1, 9, 20), isBooked: false },
  { id: 2, startUtc: isoAt(1, 9, 20), endUtc: isoAt(1, 9, 40), isBooked: true },
  { id: 3, startUtc: isoAt(2, 14), endUtc: isoAt(2, 14, 30), isBooked: false },
];

describe('AvailabilityManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    mockGetMyAvailability.mockResolvedValue(slots);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists upcoming slots grouped by day with booked ones locked', async () => {
    renderManager(<AvailabilityManager hasProfile />);

    expect(await screen.findByText(/open slot/)).toHaveTextContent('2 open slots · 1 booked');
    expect(screen.getAllByRole('region', { name: /September/ })).toHaveLength(2);
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove slot/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /add availability/i })).toBeEnabled();
  });

  it('explains the profile requirement and disables adding when there is no profile', async () => {
    mockGetMyAvailability.mockResolvedValue([]);
    renderManager(<AvailabilityManager hasProfile={false} />);

    expect(await screen.findByText('No upcoming consultation slots.')).toBeInTheDocument();
    expect(screen.getByText(/create your professional profile first/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add availability/i })).toBeDisabled();
  });

  it('shows a retryable error when the slots fail to load', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockGetMyAvailability.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    renderManager(<AvailabilityManager hasProfile />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load your availability.');
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/open slot/)).toBeInTheDocument();
    expect(mockGetMyAvailability).toHaveBeenCalledTimes(2);
  });

  it('validates the window before calling the API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderManager(<AvailabilityManager hasProfile />);
    await screen.findByText(/open slot/);

    await user.click(screen.getByRole('button', { name: /add availability/i }));
    await user.click(screen.getByRole('button', { name: /publish slots/i }));

    expect(await screen.findByText('Date is required.')).toBeInTheDocument();
    expect(screen.getByText('Start time is required.')).toBeInTheDocument();
    expect(screen.getByText('End time is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Date'), '2026-09-23');
    await chooseTime(user, 'From', '10', '00', 'AM');
    await chooseTime(user, 'To', '9', '00', 'AM');
    await user.click(screen.getByRole('button', { name: /publish slots/i }));

    expect(await screen.findByText('End time must be after the start time.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockAddMyAvailability).not.toHaveBeenCalled();
  });

  it('publishes a window as UTC and appends the returned slots', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const created = [
      { id: 10, startUtc: isoAt(3, 10), endUtc: isoAt(3, 10, 30), isBooked: false },
      { id: 11, startUtc: isoAt(3, 10, 30), endUtc: isoAt(3, 11), isBooked: false },
    ];
    mockAddMyAvailability.mockResolvedValue(created);
    renderManager(<AvailabilityManager hasProfile />);
    await screen.findByText(/open slot/);

    await user.click(screen.getByRole('button', { name: /add availability/i }));
    await user.type(screen.getByLabelText('Date'), '2026-09-25');
    await chooseTime(user, 'From', '10', '00', 'AM');
    await chooseTime(user, 'To', '11', '00', 'AM');
    await user.selectOptions(screen.getByLabelText('Slot length'), '30');
    await user.click(screen.getByRole('button', { name: /publish slots/i }));

    // Nothing is published until the confirmation is accepted.
    const dialog = await screen.findByRole('dialog', { name: 'Publish these consultation slots?' });
    expect(dialog).toHaveTextContent('2 slots of 30 minutes');
    expect(mockAddMyAvailability).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Yes, Publish' }));

    await waitFor(() => expect(mockAddMyAvailability).toHaveBeenCalledTimes(1));
    expect(mockAddMyAvailability).toHaveBeenCalledWith({
      startUtc: new Date(2026, 8, 25, 10, 0).toISOString(),
      endUtc: new Date(2026, 8, 25, 11, 0).toISOString(),
      slotDurationMinutes: 30,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('2 consultation slots published.');
    expect(screen.getByText(/open slot/)).toHaveTextContent('4 open slots');
    expect(screen.queryByRole('form', { name: 'Add availability' })).not.toBeInTheDocument();
  });

  it('sends an afternoon window as PM, not as the same hour in the morning', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockAddMyAvailability.mockResolvedValue([]);
    renderManager(<AvailabilityManager hasProfile />);
    await screen.findByText(/open slot/);

    await user.click(screen.getByRole('button', { name: /add availability/i }));
    await user.type(screen.getByLabelText('Date'), '2026-09-25');
    await chooseTime(user, 'From', '2', '30', 'PM');
    await chooseTime(user, 'To', '4', '00', 'PM');
    await user.click(screen.getByRole('button', { name: /publish slots/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Publish' }));

    await waitFor(() => expect(mockAddMyAvailability).toHaveBeenCalledTimes(1));
    expect(mockAddMyAvailability).toHaveBeenCalledWith({
      startUtc: new Date(2026, 8, 25, 14, 30).toISOString(),
      endUtc: new Date(2026, 8, 25, 16, 0).toISOString(),
      slotDurationMinutes: 20,
    });
  });

  it('surfaces an overlap conflict from the API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockAddMyAvailability.mockRejectedValue({ response: { status: 409, data: { message: 'This window overlaps an existing slot.' } } });
    renderManager(<AvailabilityManager hasProfile />);
    await screen.findByText(/open slot/);

    await user.click(screen.getByRole('button', { name: /add availability/i }));
    await user.type(screen.getByLabelText('Date'), '2026-09-23');
    await chooseTime(user, 'From', '9', '00', 'AM');
    await chooseTime(user, 'To', '10', '00', 'AM');
    await user.click(screen.getByRole('button', { name: /publish slots/i }));
    await user.click(await screen.findByRole('button', { name: 'Yes, Publish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This window overlaps an existing slot.');
    expect(screen.getByRole('form', { name: 'Add availability' })).toBeInTheDocument();
  });

  it('removes an open slot after confirmation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockDeleteMyAvailabilitySlot.mockResolvedValue(undefined);
    renderManager(<AvailabilityManager hasProfile />);
    await screen.findByText(/open slot/);

    await user.click(screen.getAllByRole('button', { name: /remove slot/i })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Remove this consultation slot?' });
    await user.click(within(dialog).getByRole('button', { name: 'Yes, Remove' }));

    await waitFor(() => expect(mockDeleteMyAvailabilitySlot).toHaveBeenCalledWith(1));
    expect(await screen.findByRole('status')).toHaveTextContent('Slot removed.');
    expect(screen.getByText(/open slot/)).toHaveTextContent('1 open slot · 1 booked');
  });

  it('keeps the slot and explains when the API refuses the removal', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockDeleteMyAvailabilitySlot.mockRejectedValue({ response: { status: 409, data: { message: 'A patient has already booked this slot.' } } });
    renderManager(<AvailabilityManager hasProfile />);
    await screen.findByText(/open slot/);

    await user.click(screen.getAllByRole('button', { name: /remove slot/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Yes, Remove' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A patient has already booked this slot.');
    expect(screen.getAllByRole('button', { name: /remove slot/i })).toHaveLength(2);
  });
});
