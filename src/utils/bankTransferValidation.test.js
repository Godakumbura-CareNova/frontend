import { describe, expect, it } from 'vitest';

import {
  VALIDATION_GROUPS,
  GROUP_LABELS,
  REJECTION_REASONS,
  EVENT_TEXT,
  receiptGroup,
  describeValidationError,
} from './bankTransferValidation';

describe('GCN-42 bank transfer validation utilities', () => {
  it('defines all bank transfer validation groups', () => {
    expect(VALIDATION_GROUPS.map((item) => item.value)).toEqual([
      'All',
      'Pending',
      'Approved',
      'Rejected',
    ]);
  });

  it('maps verified receipts to Approved', () => {
    expect(receiptGroup({ status: 'Verified' }))
      .toBe('Approved');
  });

  it('maps rejected receipts to Rejected', () => {
    expect(receiptGroup({ status: 'Rejected' }))
      .toBe('Rejected');
  });

  it('maps pending receipts to Pending', () => {
    expect(receiptGroup({ status: 'PendingVerification' }))
      .toBe('Pending');
  });

  it('defines correct group labels', () => {
    expect(GROUP_LABELS.Pending)
      .toBe('Pending verification');

    expect(GROUP_LABELS.Approved)
      .toBe('Approved');

    expect(GROUP_LABELS.Rejected)
      .toBe('Rejected');
  });

  it('contains rejection reasons for invalid receipts', () => {
    expect(REJECTION_REASONS.length)
      .toBeGreaterThan(0);

    expect(REJECTION_REASONS)
      .toContain(
        'The transferred amount does not match the order total.'
      );
  });

  it('maps Kafka event statuses', () => {
    expect(EVENT_TEXT.Published)
      .toBe('Kafka event sent');

    expect(EVENT_TEXT.Queued)
      .toBe('Kafka event queued');

    expect(EVENT_TEXT.Failed)
      .toBe('Kafka event failed to send');
  });

  it('maps unauthorized validation errors correctly', () => {
    expect(
      describeValidationError(
        { response: { status: 403 } },
        'Fallback'
      )
    ).toEqual({
      message:
        'You do not have permission to validate bank transfer transactions. Only pharmacy staff can do this.',
      retryable: false,
    });
  });

  it('maps validation mismatch errors as non-retryable', () => {
    expect(
      describeValidationError(
        {
          response: {
            status: 422,
            data: {
              message: 'Transaction does not match the order.',
            },
          },
        },
        'Fallback'
      )
    ).toEqual({
      message: 'Transaction does not match the order.',
      retryable: false,
    });
  });

  it('maps service unavailable errors as retryable', () => {
    expect(
      describeValidationError(
        {
          response: {
            status: 503,
            data: {
              message: 'The pharmacy system could not be reached.',
            },
          },
        },
        'Fallback'
      )
    ).toEqual({
      message: 'The pharmacy system could not be reached.',
      retryable: true,
    });
  });
});