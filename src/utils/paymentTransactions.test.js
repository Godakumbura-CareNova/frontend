import { describe, expect, it } from 'vitest';

import {
  TRANSACTION_CATEGORIES,
  paymentStatusLabel,
  orderStatusLabel,
  transactionsBasePath,
  describeTransactionError,
  STATUS_ACTIONS,
  ORDER_STATUS_ACTIONS,
  EVENT_STATUS_TEXT,
  NOTIFICATION_STATUS_TEXT,
} from './paymentTransactions';

describe('GCN-43 payment transaction utilities', () => {
  it('defines all transaction categories', () => {
    expect(TRANSACTION_CATEGORIES.map((item) => item.value)).toEqual([
      'All',
      'Pending',
      'Successful',
      'Failed',
      'Rejected',
    ]);
  });

  it('formats medicine payment statuses', () => {
    expect(paymentStatusLabel('AwaitingBankTransfer'))
      .toBe('Awaiting bank transfer');

    expect(paymentStatusLabel('ReceiptUnderVerification'))
      .toBe('Receipt under verification');

    expect(paymentStatusLabel('Paid'))
      .toBe('Paid');

    expect(paymentStatusLabel('Failed'))
      .toBe('Failed');
  });

  it('formats medicine order statuses', () => {
    expect(orderStatusLabel('Pending'))
      .toBe('Pending');

    expect(orderStatusLabel('ReadyForCollection'))
      .toBe('Ready for collection');

    expect(orderStatusLabel('Collected'))
      .toBe('Collected');

    expect(orderStatusLabel('Rejected'))
      .toBe('Rejected');
  });

  it('uses the correct transaction route for pharmacy staff and admins', () => {
    expect(transactionsBasePath('/pharmacy/payment-transactions'))
      .toBe('/pharmacy/payment-transactions');

    expect(transactionsBasePath('/admin/payments'))
      .toBe('/admin/payments');
  });

  it('defines payment management actions', () => {
    expect(STATUS_ACTIONS.Paid.label)
      .toBe('Mark as paid');

    expect(STATUS_ACTIONS.Failed.label)
      .toBe('Mark as not paid');
  });

  it('defines GCN-43 medicine order status actions', () => {
    expect(ORDER_STATUS_ACTIONS.ReadyForCollection.label)
      .toBe('Mark ready for collection');

    expect(ORDER_STATUS_ACTIONS.Rejected.label)
      .toBe('Reject order');

    expect(ORDER_STATUS_ACTIONS.Collected.label)
      .toBe('Mark collected');
  });

  it('maps authorization and not-found errors correctly', () => {
    expect(
      describeTransactionError(
        { response: { status: 403 } },
        'Fallback'
      )
    ).toEqual({
      message: 'You do not have permission to manage payment transactions.',
      retryable: false,
    });

    expect(
      describeTransactionError(
        {
          response: {
            status: 404,
            data: {
              message: 'We could not find that payment transaction.',
            },
          },
        },
        'Fallback'
      )
    ).toEqual({
      message: 'We could not find that payment transaction.',
      retryable: false,
    });
  });

  it('allows retry for service or network failures', () => {
    expect(
      describeTransactionError(
        {},
        'We could not load payment transactions. Please try again.'
      )
    ).toEqual({
      message: 'We could not load payment transactions. Please try again.',
      retryable: true,
    });
  });

  it('maps Kafka event statuses', () => {
    expect(EVENT_STATUS_TEXT.Published)
      .toBe('Kafka event sent');

    expect(EVENT_STATUS_TEXT.Queued)
      .toBe('Kafka event queued');

    expect(EVENT_STATUS_TEXT.Failed)
      .toBe('Kafka event failed to send');
  });

  it('maps patient notification statuses', () => {
    expect(NOTIFICATION_STATUS_TEXT.Delivered)
      .toBe('Patient notified');

    expect(NOTIFICATION_STATUS_TEXT.Pending)
      .toBe('Notification pending');

    expect(NOTIFICATION_STATUS_TEXT.Failed)
      .toBe('Notification failed');
  });
});