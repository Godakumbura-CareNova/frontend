import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import AvailabilityManager from './AvailabilityManager';
import {
  addMyAvailability,
  deleteMyAvailabilitySlot,
  getMyAvailability,
  updateMyAvailabilitySlot,
} from '../../services/doctorService';

vi.mock('../../services/doctorService', () => ({
  getMyAvailability: vi.fn(),
  addMyAvailability: vi.fn(),
  updateMyAvailabilitySlot: vi.fn(),
  deleteMyAvailabilitySlot: vi.fn(),
}));

const showToast = vi.fn();

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../ConfirmDialog', () => ({
  default: ({
    open,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{message}</p>

        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>

        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('./ProfileSection', () => ({
  default: ({ title, action, children }) => (
    <section>
      <h2>{title}</h2>
      {action}
      {children}
    </section>
  ),
}));

const slot1 = {
  id: 1,
  startUtc: '2026-09-26T03:50:00Z',
  endUtc: '2026-09-26T04:10:00Z',
  isBooked: false,
};

const slot2 = {
  id: 2,
  startUtc: '2026-09-26T04:10:00Z',
  endUtc: '2026-09-26T04:30:00Z',
  isBooked: false,
};

const bookedSlot = {
  id: 3,
  startUtc: '2026-09-27T08:30:00Z',
  endUtc: '2026-09-27T08:50:00Z',
  isBooked: true,
};

const renderManager = (props = {}) =>
  render(
    <AvailabilityManager
      hasProfile
      {...props}
    />,
  );

const findAvailabilitySummary = async (text) =>
  screen.findByText((_, element) => {
    return (
      element?.classList?.contains('dp-availability-summary') &&
      element.textContent.includes(text)
    );
  });

const openAddForm = async () => {
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole('button', {
      name: /add availability/i,
    }),
  );

  return user;
};

const fillAddForm = async ({
  date = '2026-09-28',
  startHour = '10',
  startMinute = '00',
  startMeridiem = 'AM',
  endHour = '11',
  endMinute = '00',
  endMeridiem = 'AM',
} = {}) => {
  const user = userEvent.setup();

  fireEvent.change(screen.getByLabelText(/^date$/i), {
    target: { value: date },
  });

  await user.type(
    screen.getByLabelText(/^from hour$/i),
    startHour,
  );

  await user.type(
    screen.getByLabelText(/^from minutes$/i),
    startMinute,
  );

  await user.selectOptions(
    screen.getByLabelText(/^from am or pm$/i),
    startMeridiem,
  );

  await user.type(
    screen.getByLabelText(/^to hour$/i),
    endHour,
  );

  await user.type(
    screen.getByLabelText(/^to minutes$/i),
    endMinute,
  );

  await user.selectOptions(
    screen.getByLabelText(/^to am or pm$/i),
    endMeridiem,
  );
};

describe('AvailabilityManager - GCN-37', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getMyAvailability.mockResolvedValue([]);
  });

  it('loads and displays the current consultation schedule', async () => {
    getMyAvailability.mockResolvedValue([
      slot1,
      slot2,
      bookedSlot,
    ]);

    renderManager();

    expect(
      screen.getByText(/loading your availability/i),
    ).toBeInTheDocument();

    expect(
      await findAvailabilitySummary('2 open slots'),
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Booked', {
        selector: '.dp-slot-status',
      }),
    ).toBeInTheDocument();

    expect(getMyAvailability).toHaveBeenCalledTimes(1);
  });

  it('shows an empty schedule message when no availability exists', async () => {
    getMyAvailability.mockResolvedValue([]);

    renderManager();

    expect(
      await screen.findByText(
        /no upcoming consultation slots/i,
      ),
    ).toBeInTheDocument();
  });

  it('prevents adding availability when the end time is before the start time', async () => {
    renderManager();

    await openAddForm();

    await fillAddForm({
      startHour: '10',
      startMinute: '00',
      startMeridiem: 'AM',
      endHour: '9',
      endMinute: '00',
      endMeridiem: 'AM',
    });

    await userEvent.click(
      screen.getByRole('button', {
        name: /publish slots/i,
      }),
    );

    expect(
      await screen.findByText(
        /end time must be after the start time/i,
      ),
    ).toBeInTheDocument();

    expect(addMyAvailability).not.toHaveBeenCalled();
  });

  it('prevents a conflicting availability window', async () => {
    getMyAvailability.mockResolvedValue([slot1]);

    renderManager();

    expect(
      await findAvailabilitySummary('1 open slot'),
    ).toBeInTheDocument();

    await openAddForm();

    /*
      slot1:
      03:50 UTC -> 09:20 Sri Lanka time

      Proposed:
      09:30 -> 09:50

      Therefore it overlaps the existing slot.
    */
    await fillAddForm({
      date: '2026-09-26',
      startHour: '9',
      startMinute: '30',
      startMeridiem: 'AM',
      endHour: '9',
      endMinute: '50',
      endMeridiem: 'AM',
    });

    await userEvent.click(
      screen.getByRole('button', {
        name: /publish slots/i,
      }),
    );

    expect(
      await screen.findByText(
        /overlaps your existing slot/i,
      ),
    ).toBeInTheDocument();

    expect(addMyAvailability).not.toHaveBeenCalled();
  });

  it('publishes valid availability after confirmation', async () => {
    const createdSlots = [
      {
        id: 10,
        startUtc: '2026-09-28T04:30:00Z',
        endUtc: '2026-09-28T04:50:00Z',
        isBooked: false,
      },
      {
        id: 11,
        startUtc: '2026-09-28T04:50:00Z',
        endUtc: '2026-09-28T05:10:00Z',
        isBooked: false,
      },
      {
        id: 12,
        startUtc: '2026-09-28T05:10:00Z',
        endUtc: '2026-09-28T05:30:00Z',
        isBooked: false,
      },
    ];

    addMyAvailability.mockResolvedValue(createdSlots);

    renderManager();

    await openAddForm();
    await fillAddForm();

    await userEvent.click(
      screen.getByRole('button', {
        name: /publish slots/i,
      }),
    );

    expect(
      await screen.findByRole('dialog', {
        name: /publish these consultation slots/i,
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /yes, publish/i,
      }),
    );

    await waitFor(() => {
      expect(addMyAvailability).toHaveBeenCalledTimes(1);
    });

    expect(showToast).toHaveBeenCalledWith(
      '3 consultation slots published.',
    );

    expect(
      await findAvailabilitySummary('3 open slots'),
    ).toBeInTheDocument();
  });

  it('updates an existing open consultation slot', async () => {
    getMyAvailability.mockResolvedValue([slot1]);

    updateMyAvailabilitySlot.mockResolvedValue({
      ...slot1,
      startUtc: '2026-09-26T03:20:00Z',
      endUtc: '2026-09-26T03:40:00Z',
    });

    renderManager();

    expect(
      await findAvailabilitySummary('1 open slot'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /edit slot/i,
      }),
    );

    expect(
      screen.getByRole('form', {
        name: /edit consultation slot/i,
      }),
    ).toBeInTheDocument();

    const startHour =
      screen.getByLabelText(/^new start hour$/i);

    const startMinutes =
      screen.getByLabelText(/^new start minutes$/i);

    const endHour =
      screen.getByLabelText(/^new end hour$/i);

    const endMinutes =
      screen.getByLabelText(/^new end minutes$/i);

    await userEvent.clear(startHour);
    await userEvent.type(startHour, '8');

    await userEvent.clear(startMinutes);
    await userEvent.type(startMinutes, '50');

    await userEvent.clear(endHour);
    await userEvent.type(endHour, '9');

    await userEvent.clear(endMinutes);
    await userEvent.type(endMinutes, '10');

    await userEvent.click(
      screen.getByRole('button', {
        name: /save changes/i,
      }),
    );

    await waitFor(() => {
      expect(
        updateMyAvailabilitySlot,
      ).toHaveBeenCalledTimes(1);
    });

    expect(showToast).toHaveBeenCalledWith(
      'Consultation slot updated.',
    );
  });

  it('removes an existing open consultation slot after confirmation', async () => {
    getMyAvailability.mockResolvedValue([slot1]);

    deleteMyAvailabilitySlot.mockResolvedValue();

    renderManager();

    expect(
      await findAvailabilitySummary('1 open slot'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /remove slot/i,
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: /remove this consultation slot/i,
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /yes, remove/i,
      }),
    );

    await waitFor(() => {
      expect(
        deleteMyAvailabilitySlot,
      ).toHaveBeenCalledWith(slot1.id);
    });

    expect(showToast).toHaveBeenCalledWith(
      'Slot removed.',
      'danger',
    );

    expect(
      await screen.findByText(
        /no upcoming consultation slots/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows a retry option when loading availability fails', async () => {
    getMyAvailability
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([slot1]);

    renderManager();

    expect(
      await screen.findByText(
        /we could not reach the doctor service/i,
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /retry/i,
      }),
    );

    expect(
      await findAvailabilitySummary('1 open slot'),
    ).toBeInTheDocument();

    expect(getMyAvailability).toHaveBeenCalledTimes(2);
  });

  it('does not allow booked slots to be edited or removed', async () => {
    getMyAvailability.mockResolvedValue([bookedSlot]);

    renderManager();

    expect(
      await screen.findByText('Booked', {
        selector: '.dp-slot-status',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: /edit slot/i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: /remove slot/i,
      }),
    ).not.toBeInTheDocument();
  });
});