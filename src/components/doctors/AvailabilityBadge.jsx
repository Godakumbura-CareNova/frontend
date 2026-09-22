import React from 'react';
import { CalendarCheck2, CalendarX2 } from 'lucide-react';

// Slot times come from the API as UTC; a value without a zone suffix is still UTC, so pin it before parsing.
export const parseUtcDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const date = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatSlotTime = (value) => {
  const date = parseUtcDate(value);
  if (!date) return '';
  return date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/**
 * Green "available" / grey "no open slots" pill shown on search cards and the profile hero.
 * `availability` is the API object { hasAvailableSlots, availableSlotCount, nextAvailableSlotUtc }.
 */
const AvailabilityBadge = ({ availability, detailed = false, className = '' }) => {
  const hasSlots = Boolean(availability?.hasAvailableSlots);
  const count = availability?.availableSlotCount ?? 0;
  const next = formatSlotTime(availability?.nextAvailableSlotUtc);

  let label = 'No open slots';
  if (hasSlots) {
    label = detailed && next ? `Next slot ${next}` : `${count} open slot${count === 1 ? '' : 's'}`;
  }

  return (
    <span
      className={`pd-availability ${hasSlots ? 'pd-availability-open' : 'pd-availability-none'} ${className}`.trim()}
      data-testid="availability-badge"
      title={hasSlots && next ? `Next available: ${next}` : 'No available consultation slots right now'}
    >
      {hasSlots ? <CalendarCheck2 size={13} aria-hidden="true" /> : <CalendarX2 size={13} aria-hidden="true" />}
      {label}
    </span>
  );
};

export default AvailabilityBadge;
