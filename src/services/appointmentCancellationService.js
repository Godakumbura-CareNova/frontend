import { appointmentApi } from '../api/appointmentApi';
import { validUtcTimestamp } from '../utils/validUtcTimestamp';

const outcomeValid = data => ['NotRequired', 'Eligible', 'NotEligible'].includes(data.refundOutcome)
  && typeof data.refundAmount === 'number' && Number.isFinite(data.refundAmount)
  && (data.refundOutcome === 'Eligible' ? data.refundAmount > 0 : data.refundAmount === 0);
const resultValid = (data, id) => data && Number.isInteger(data.appointmentId) && String(data.appointmentId) === String(id)
  && data.status === 'Cancelled' && typeof data.appointmentReference === 'string' && data.appointmentReference.length > 0
  && validUtcTimestamp(data.cancelledAtUtc) && outcomeValid(data) && typeof data.message === 'string'
  && (data.refundOutcome === 'Eligible' ? data.refundStatus === 'PendingManualProcessing' : data.refundStatus === null)
  && (data.reason === null || typeof data.reason === 'string');
const path = id => `/api/patient/appointments/${encodeURIComponent(id)}/cancellation`;

export async function getAppointmentCancellationEligibility(id) {
  const { data, status } = await appointmentApi.get(path(id));
  if (status !== 200 || !data || Number(data.appointmentId) !== Number(id) || !Number.isInteger(data.appointmentId)
    || typeof data.allowed !== 'boolean' || typeof data.message !== 'string' || typeof data.reasonCode !== 'string'
    || !outcomeValid(data) || typeof data.requiresNoRefundAcknowledgement !== 'boolean' || !/^[a-fA-F0-9]{64}$/.test(data.version)
    || !(data.cancellation === null || resultValid(data.cancellation, id))) throw new Error('Could not load cancellation information. Please refresh.');
  return data;
}

export async function cancelAppointment(id, request) {
  const { data, status } = await appointmentApi.post(path(id), request);
  if (status !== 200 || !resultValid(data, id)) throw new Error('The API did not confirm cancellation. Refresh to check the appointment before trying again.');
  return data;
}
