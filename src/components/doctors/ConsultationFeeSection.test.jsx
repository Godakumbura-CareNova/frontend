import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultationFeeSection from './ConsultationFeeSection';
import {
  getMyFeeChangeRequests,
  submitFeeChangeRequest,
} from '../../services/doctorService';

const showToast = vi.fn();

vi.mock('../../services/doctorService', () => ({
  getMyFeeChangeRequests: vi.fn(),
  submitFeeChangeRequest: vi.fn(),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../ConfirmDialog', () => ({
  default: ({ open, title, confirmLabel, onConfirm, onCancel }) => {
    if (!open) return null;

    return (
      <div role="dialog">
        <h2>{title}</h2>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  },
}));

const normalData = {
  currentFee: 2500,
  pendingRequest: null,
  requests: [],
};

const pendingData = {
  currentFee: 2500,
  pendingRequest: {
    id: 1,
    currentFee: 2500,
    requestedFee: 2600,
    status: 'Pending',
    rejectionReason: null,
    submittedAtUtc: '2026-09-26T08:35:34Z',
    reviewedAtUtc: null,
  },
  requests: [
    {
      id: 1,
      currentFee: 2500,
      requestedFee: 2600,
      status: 'Pending',
      rejectionReason: null,
      submittedAtUtc: '2026-09-26T08:35:34Z',
      reviewedAtUtc: null,
    },
  ],
};

const openFeeForm = async () => {
  const requestButton = await screen.findByRole('button', {
    name: /request fee change/i,
  });

  fireEvent.click(requestButton);

  fireEvent.click(
    screen.getByRole('button', {
      name: /yes, continue/i,
    })
  );
};

describe('ConsultationFeeSection - GCN-38', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyFeeChangeRequests.mockResolvedValue(normalData);
  });

  it('displays the doctor current consultation fee', async () => {
    render(<ConsultationFeeSection hasProfile />);

    expect(
      await screen.findByTestId('doctor-consultation-fee')
    ).toHaveTextContent('2,500');
  });

  it('shows a pending fee-change request and prevents another request', async () => {
    getMyFeeChangeRequests.mockResolvedValue(pendingData);

    render(<ConsultationFeeSection hasProfile />);

    expect(
      await screen.findByText(/pending admin review/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/you asked to change your fee/i)
    ).toHaveTextContent('2,600');

    expect(
      screen.getByRole('button', { name: /request fee change/i })
    ).toBeDisabled();
  });

  it('rejects an invalid consultation fee before submitting', async () => {
    render(<ConsultationFeeSection hasProfile />);

    await openFeeForm();

    fireEvent.change(
      screen.getByLabelText(/new consultation fee/i),
      { target: { value: '0' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /submit request/i })
    );

    expect(
      await screen.findByText(/greater than 0/i)
    ).toBeInTheDocument();

    expect(submitFeeChangeRequest).not.toHaveBeenCalled();
  });

  it('submits a valid consultation fee-change request', async () => {
    submitFeeChangeRequest.mockResolvedValue({
      id: 2,
      requestedFee: 2600,
      status: 'Pending',
    });

    getMyFeeChangeRequests
      .mockResolvedValueOnce(normalData)
      .mockResolvedValueOnce(pendingData);

    render(<ConsultationFeeSection hasProfile />);

    await openFeeForm();

    fireEvent.change(
      screen.getByLabelText(/new consultation fee/i),
      { target: { value: '2600' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /submit request/i })
    );

    fireEvent.click(
      screen.getByRole('button', { name: /yes, submit/i })
    );

    await waitFor(() => {
      expect(submitFeeChangeRequest).toHaveBeenCalledWith(2600);
    });

    expect(showToast).toHaveBeenCalledWith(
      'Fee change request submitted. An admin will review it.'
    );

    expect(
      await screen.findByText(/pending admin review/i)
    ).toBeInTheDocument();
  });

  it('shows request history including rejected admin feedback', async () => {
    getMyFeeChangeRequests.mockResolvedValue({
      currentFee: 2500,
      pendingRequest: null,
      requests: [
        {
          id: 1,
          currentFee: 2500,
          requestedFee: 2555,
          status: 'Rejected',
          rejectionReason: 'QA rejection reason',
          submittedAtUtc: '2026-09-26T08:27:23Z',
          reviewedAtUtc: '2026-09-26T08:31:51Z',
        },
      ],
    });

    render(<ConsultationFeeSection hasProfile />);

    const historyButton = await screen.findByRole('button', {
      name: /request history/i,
    });

    fireEvent.click(historyButton);

    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('QA rejection reason')).toBeInTheDocument();
    expect(screen.getByText(/2,555/)).toBeInTheDocument();
  });

  it('shows a retry option when fee submission cannot reach the service', async () => {
    submitFeeChangeRequest
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        id: 2,
        requestedFee: 2600,
        status: 'Pending',
      });

    getMyFeeChangeRequests
      .mockResolvedValueOnce(normalData)
      .mockResolvedValueOnce(pendingData);

    render(<ConsultationFeeSection hasProfile />);

    await openFeeForm();

    fireEvent.change(
      screen.getByLabelText(/new consultation fee/i),
      { target: { value: '2600' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /submit request/i })
    );

    fireEvent.click(
      screen.getByRole('button', { name: /yes, submit/i })
    );

    expect(
      await screen.findByText(/could not reach the doctor service/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /retry/i })
    );

    await waitFor(() => {
      expect(submitFeeChangeRequest).toHaveBeenCalledTimes(2);
    });

    expect(submitFeeChangeRequest).toHaveBeenLastCalledWith(2600);
  });
});