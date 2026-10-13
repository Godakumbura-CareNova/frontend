import React, { useEffect, useRef, useState } from 'react';
import useAppointmentCancellation from '../../hooks/useAppointmentCancellation';
import { appointmentDate } from '../../pages/appointmentPresentation';

export default function AppointmentCancellationPanel({ appointmentId, appointmentReference, appointmentStartUtc, onCancelled }) {
  const { eligibility, result, loading, submitting, error, uncertain, refresh, cancel, scope } = useAppointmentCancellation(appointmentId, onCancelled);
  const [form, setForm] = useState({ scope, open: false, reason: '', acknowledged: false });
  const current = form.scope === scope ? form : { open: false, reason: '', acknowledged: false };
  const reasonInput = useRef(null); const openButton = useRef(null);
  const restoreFocus = useRef(false);
  useEffect(() => { if (current.open) reasonInput.current?.focus(); else if (restoreFocus.current) { openButton.current?.focus(); restoreFocus.current = false; } }, [current.open]);
  const close = () => { if (submitting) return; restoreFocus.current = true; setForm({ ...current, scope, open: false }); };
  const reload = async () => { await refresh(); setForm(previous => ({ ...previous, scope, open: false, acknowledged: false })); };
  return <section className="appointment-cancellation" aria-label="Appointment cancellation">
    <h2>Cancellation</h2>
    {loading && <p>Checking cancellation information...</p>}
    {error && <div role="alert" className="order-error">{error}<button onClick={reload} disabled={loading || submitting}>Refresh cancellation information</button></div>}
    {result ? <div className="appointment-cancellation-success"><p role="status">Appointment cancelled</p><p>{result.message}</p>{result.refundOutcome === 'Eligible' && <p>Refund amount: LKR {result.refundAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}. Awaiting manual processing by pharmacy staff.</p>}</div> : eligibility && <>
      <p>{eligibility.message}</p>
      {eligibility.allowed && !current.open && <button ref={openButton} className="btn appointment-cancel-button" disabled={loading || submitting || !!error} onClick={() => setForm({ ...current, scope, open: true })}>Cancel appointment</button>}
      {current.open && <div className="appointment-cancellation-confirmation" role="group" aria-label="Confirm appointment cancellation" onKeyDown={event => { if (event.key === 'Escape') close(); }}>
        <h3>Cancel this appointment?</h3><p>{appointmentReference} · {appointmentDate(appointmentStartUtc)} at {appointmentDate(appointmentStartUtc, true)}</p><p>{eligibility.message}</p>
        {eligibility.refundOutcome === 'Eligible' && <p>Refund amount: LKR {eligibility.refundAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}. Pharmacy staff will process it manually.</p>}
        <label>Reason (optional)<textarea ref={reasonInput} maxLength={500} value={current.reason} disabled={submitting} onChange={event => setForm({ ...current, scope, reason: event.target.value })} /></label>
        {eligibility.requiresNoRefundAcknowledgement && <label className="appointment-refund-ack"><input type="checkbox" checked={current.acknowledged} disabled={submitting} onChange={event => setForm({ ...current, scope, acknowledged: event.target.checked })} />I understand that no refund is available for this cancellation.</label>}
        <div className="appointment-confirm-actions"><button className="btn appointment-cancel-button" onClick={() => cancel(current.reason, current.acknowledged)} disabled={loading || submitting || uncertain || !!error || eligibility.requiresNoRefundAcknowledgement && !current.acknowledged}>{submitting ? 'Cancelling...' : 'Confirm cancellation'}</button><button className="btn" onClick={close} disabled={submitting}>Keep appointment</button></div>
      </div>}
    </>}
  </section>;
}
