import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MedicinePaymentMethodSelector from './MedicinePaymentMethodSelector';
import {
  getMedicinePaymentOptions,
  selectMedicinePaymentMethod,
} from '../../services/paymentService';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../services/paymentService', () => ({
  getMedicinePaymentOptions: vi.fn(),
  selectMedicinePaymentMethod: vi.fn(),
}));

const options = {
  orderId: 5,
  orderNumber: 'CN-000005',
  amount: 20,
  selectedPayment: null,
  methods: [
    {
      method: 'Online',
      label: 'Online payment',
      description: 'Pay online.',
      available: true,
      unavailableReason: null,
    },
    {
      method: 'BankTransfer',
      label: 'Bank transfer',
      description: 'Pay by bank transfer.',
      available: true,
      unavailableReason: null,
    },
    {
      method: 'Cash',
      label: 'Cash',
      description: 'Pay at collection.',
      available: true,
      unavailableReason: null,
    },
  ],
};

function renderSelector() {
  return render(
    <MemoryRouter>
      <MedicinePaymentMethodSelector orderId="5" />
    </MemoryRouter>,
  );
}

describe('GCN-39 MedicinePaymentMethodSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMedicinePaymentOptions.mockResolvedValue({ data: options });
  });

  it('loads and displays all available medicine payment methods', async () => {
    renderSelector();

    expect(
      await screen.findByRole('radio', { name: /online payment/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('radio', { name: /bank transfer/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('radio', { name: /^cash/i }),
    ).toBeInTheDocument();
  });

  it('prevents continuing when no payment method is selected', async () => {
    renderSelector();

    await screen.findByRole('radio', { name: /online payment/i });

    fireEvent.click(
      screen.getByRole('button', { name: /continue to payment/i }),
    );

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/select a payment method/i);

    expect(selectMedicinePaymentMethod).not.toHaveBeenCalled();
  });

  it('shows an unavailable cash method and prevents selecting it', async () => {
    getMedicinePaymentOptions.mockResolvedValue({
      data: {
        ...options,
        amount: 100000,
        methods: options.methods.map((method) =>
          method.method === 'Cash'
            ? {
                ...method,
                available: false,
                unavailableReason:
                  'Cash is only accepted for orders up to LKR 25,000.',
              }
            : method,
        ),
      },
    });

    renderSelector();

    const cash = await screen.findByRole('radio', { name: /^cash/i });

    expect(cash).toBeDisabled();

    expect(
      screen.getByText(/cash is only accepted for orders up to lkr 25,000/i),
    ).toBeInTheDocument();
  });

  it('shows a retry option when payment methods cannot be loaded', async () => {
    getMedicinePaymentOptions
      .mockRejectedValueOnce({
        request: {},
      })
      .mockResolvedValueOnce({ data: options });

    renderSelector();

    const retry = await screen.findByRole('button', { name: /retry/i });

    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent(/could not load the payment methods/i);

    fireEvent.click(retry);

    expect(
      await screen.findByRole('radio', { name: /online payment/i }),
    ).toBeInTheDocument();

    expect(getMedicinePaymentOptions).toHaveBeenCalledTimes(2);
  });

  it('confirms cash and allows the patient to continue without online payment', async () => {
    selectMedicinePaymentMethod.mockResolvedValue({
      data: {
        orderId: 5,
        orderNumber: 'CN-000005',
        amount: 20,
        method: 'Cash',
        nextStep: 'PayOnCollection',
      },
    });

    renderSelector();

    const cash = await screen.findByRole('radio', { name: /^cash/i });
    fireEvent.click(cash);

    fireEvent.click(
      screen.getByRole('button', { name: /continue to payment/i }),
    );

    const confirm = await screen.findByRole('button', {
      name: /confirm cash/i,
    });

    fireEvent.click(confirm);

    expect(
      await screen.findByText(/cash payment confirmed/i),
    ).toBeInTheDocument();

    expect(selectMedicinePaymentMethod).toHaveBeenCalledWith('5', 'Cash');

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('proceeds to the online payment process after online payment is confirmed', async () => {
    selectMedicinePaymentMethod.mockResolvedValue({
      data: {
        orderId: 5,
        orderNumber: 'CN-000005',
        amount: 20,
        method: 'Online',
        nextStep: 'OnlinePayment',
      },
    });

    renderSelector();

    const online = await screen.findByRole('radio', {
      name: /online payment/i,
    });

    fireEvent.click(online);

    fireEvent.click(
      screen.getByRole('button', { name: /continue to payment/i }),
    );

    const confirm = await screen.findByRole('button', {
      name: /confirm online payment/i,
    });

    fireEvent.click(confirm);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        '/patient/orders/5/payment/online',
      );
    });

    expect(selectMedicinePaymentMethod).toHaveBeenCalledWith('5', 'Online');
  });

  it('shows bank transfer instructions after bank transfer is confirmed', async () => {
    selectMedicinePaymentMethod.mockResolvedValue({
      data: {
        orderId: 5,
        orderNumber: 'CN-000005',
        amount: 20,
        method: 'BankTransfer',
        nextStep: 'BankTransferInstructions',
        bankTransfer: {
          bankName: 'CareNova Bank',
          branch: 'Colombo',
          accountName: 'CareNova Pharmacy',
          accountNumber: '1234567890',
          amount: 20,
          reference: 'CN-000005',
        },
      },
    });

    renderSelector();

    const bank = await screen.findByRole('radio', {
      name: /bank transfer/i,
    });

    fireEvent.click(bank);

    fireEvent.click(
      screen.getByRole('button', { name: /continue to payment/i }),
    );

    const confirm = await screen.findByRole('button', {
      name: /confirm bank transfer/i,
    });

    fireEvent.click(confirm);

    expect(
      await screen.findByText(/transfer to this account/i),
    ).toBeInTheDocument();

    expect(screen.getByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText(/upload your payment receipt/i)).toBeInTheDocument();
  });
});