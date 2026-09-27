import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BankTransferReceiptUpload from './BankTransferReceiptUpload';
import { uploadBankTransferReceipt } from '../../services/paymentService';

const showToast = vi.fn();

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../services/paymentService', () => ({
  uploadBankTransferReceipt: vi.fn(),
}));

describe('GCN-40 BankTransferReceiptUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the receipt upload controls for a bank transfer awaiting a receipt', () => {
    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="AwaitingBankTransfer"
      />
    );

    expect(screen.getByText('Upload your payment receipt')).toBeInTheDocument();
    expect(screen.getByText(/JPG, JPEG or PNG, up to 5 MB/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload receipt/i })).toBeInTheDocument();
  });

  it('shows an error when upload is clicked without a file', () => {
    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="AwaitingBankTransfer"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select a receipt to upload.'
    );
    expect(uploadBankTransferReceipt).not.toHaveBeenCalled();
  });

  it('rejects an unsupported file format', () => {
    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="AwaitingBankTransfer"
      />
    );

    const file = new File(['receipt'], 'receipt.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(screen.getByLabelText('Payment receipt'), {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unsupported file format. Only JPG, JPEG and PNG files are allowed.'
    );
    expect(uploadBankTransferReceipt).not.toHaveBeenCalled();
  });

  it('rejects a receipt larger than 5 MB', () => {
    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="AwaitingBankTransfer"
      />
    );

    const file = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'large.png',
      { type: 'image/png' }
    );

    fireEvent.change(screen.getByLabelText('Payment receipt'), {
      target: { files: [file] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The receipt is larger than 5 MB. Please upload a file of 5 MB or less.'
    );
    expect(uploadBankTransferReceipt).not.toHaveBeenCalled();
  });

  it('uploads a valid receipt and reports success', async () => {
    const onUploaded = vi.fn();

    uploadBankTransferReceipt.mockResolvedValue({
      data: {
        message:
          'Your receipt was uploaded and sent to the pharmacy for verification.',
      },
    });

    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="AwaitingBankTransfer"
        onUploaded={onUploaded}
      />
    );

    const file = new File(['image'], 'receipt.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(screen.getByLabelText('Payment receipt'), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole('button', { name: /upload receipt/i }));

    await waitFor(() => {
      expect(uploadBankTransferReceipt).toHaveBeenCalledWith(10, file);
    });

    expect(showToast).toHaveBeenCalledWith(
      'Receipt uploaded. Receipt has been sent to the pharmacy for verification.'
    );

    expect(onUploaded).toHaveBeenCalled();
  });

  it('shows that an uploaded receipt is still pending verification', () => {
    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="ReceiptUnderVerification"
        receipt={{
          fileName: 'receipt.png',
          sizeBytes: 125000,
          uploadedAtUtc: '2026-09-27T10:00:00Z',
        }}
      />
    );

    expect(screen.getByText('Receipt under verification')).toBeInTheDocument();
    expect(screen.getByText(/order stays Pending/i)).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows payment verified after pharmacy verification', () => {
    render(
      <BankTransferReceiptUpload
        orderId={10}
        paymentStatus="Paid"
        receipt={{ fileName: 'receipt.png' }}
      />
    );

    expect(screen.getByText('Payment verified')).toBeInTheDocument();
    expect(
      screen.getByText(/Your payment is confirmed/i)
    ).toBeInTheDocument();
  });
});