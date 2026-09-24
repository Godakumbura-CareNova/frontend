import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, HandCoins, History, RefreshCw, Send, XCircle } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import ProfileSection from './ProfileSection';
import { CONSULTATION_FEE_CURRENCY, formatConsultationFee } from '../../utils/consultationFee';
import { mapServerValidationErrors, validateRequestedFee } from '../../utils/doctorValidation';
import { getMyFeeChangeRequests, submitFeeChangeRequest } from '../../services/doctorService';
import { parseUtcDate } from './AvailabilityBadge';

const STATUS_DETAILS = {
  Pending: { label: 'Pending admin review', icon: Clock, className: 'dp-fee-status-pending' },
  Approved: { label: 'Approved', icon: CheckCircle2, className: 'dp-fee-status-approved' },
  Rejected: { label: 'Rejected', icon: XCircle, className: 'dp-fee-status-rejected' },
};

const formatDate = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

const feeOrNotSet = (value) => formatConsultationFee(value) || 'not set';

const describeError = (error, fallback) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (status === 400) {
    return { message: serverMessage || 'Please check the requested fee.', fieldError: mapServerValidationErrors(error?.response?.data?.errors).requestedFee, retryable: false };
  }
  if (status === 409) return { message: serverMessage || 'You already have a fee-change request waiting for review.', retryable: false, conflict: true };
  if (status === 401) return { message: 'Your session has expired. Please sign in again to request a fee change.', retryable: false };
  if (status === 403) return { message: 'Only doctors can request a consultation fee change.', retryable: false };
  if (!error?.response) return { message: 'We could not reach the doctor service. Check your connection and try again.', retryable: true };
  return { message: serverMessage || fallback, retryable: true };
};

const StatusBadge = ({ status }) => {
  const details = STATUS_DETAILS[status] || { label: status, icon: Clock, className: '' };
  const Icon = details.icon;
  return (
    <span className={`dp-fee-status ${details.className}`}>
      <Icon size={13} aria-hidden="true" /> {details.label}
    </span>
  );
};

/**
 * The doctor's consultation fee (GCN-38). Doctors cannot change the fee directly: they submit a request,
 * an admin approves or rejects it, and the doctor is notified. Opening the form and submitting are both
 * confirmed. Only one request can be pending at a time.
 */
const ConsultationFeeSection = ({ hasProfile, disabled = false }) => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  // The fee the last confirmed attempt sent, so Retry repeats that attempt rather than whatever is typed now.
  const [lastAttempt, setLastAttempt] = useState('');
  // Past requests stay out of the way until the doctor asks to see them.
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    if (!hasProfile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setData(await getMyFeeChangeRequests());
    } catch (error) {
      setLoadError(describeError(error, 'Failed to load your consultation fee.'));
    } finally {
      setLoading(false);
    }
  }, [hasProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const currentFee = data?.currentFee ?? null;
  const pending = data?.pendingRequest ?? null;
  const requests = data?.requests ?? [];
  const formattedFee = formatConsultationFee(currentFee);

  const openForm = () => {
    setShowOpenConfirm(false);
    setValue('');
    setFieldError('');
    setSubmitError(null);
    setEditing(true);
  };

  const closeForm = () => {
    setEditing(false);
    setValue('');
    setFieldError('');
    setSubmitError(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitError(null);

    const validationError = validateRequestedFee(value, currentFee);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError('');
    setShowSubmitConfirm(true);
  };

  const submit = async (feeText) => {
    setShowSubmitConfirm(false);
    setLastAttempt(feeText);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitFeeChangeRequest(Number(feeText.trim()));
      showToast('Fee change request submitted. An admin will review it.');
      closeForm();
      await load();
    } catch (error) {
      const described = describeError(error, 'Failed to submit your fee change request.');
      if (described.fieldError) setFieldError(described.fieldError);
      setSubmitError(described);
      // Someone (e.g. another tab) already has a request pending; show it instead of the form.
      if (described.conflict) {
        setEditing(false);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const requestButton = editing || !hasProfile || loading || loadError ? null : (
    <button
      type="button"
      className="dp-add-btn"
      onClick={() => setShowOpenConfirm(true)}
      disabled={disabled || submitting || Boolean(pending)}
      title={pending ? 'Wait until your pending request is reviewed' : 'Ask an admin to approve a new consultation fee'}
    >
      <Send size={13} /> Request Fee Change
    </button>
  );

  return (
    <div className="dp-card">
      <ProfileSection icon={HandCoins} title="Consultation Fee" action={requestButton}>
        {submitError && (
          <div className="alert alert-error" role="alert">
            <span>{submitError.message}</span>
            {submitError.retryable && (
              <button type="button" className="dp-retry-btn" onClick={() => submit(lastAttempt)} disabled={submitting}>
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </div>
        )}

        {!hasProfile ? (
          <p className="dp-hint dp-availability-hint">
            Create your professional profile first; the consultation fee is shown on that profile.
          </p>
        ) : loading ? (
          <p className="dp-status">Loading your consultation fee...</p>
        ) : loadError ? (
          <div className="alert alert-error" role="alert">
            <span>{loadError.message}</span>
            <button type="button" className="dp-retry-btn" onClick={load}><RefreshCw size={13} /> Retry</button>
          </div>
        ) : (
          <div className="dp-fee-panel">
            {formattedFee ? (
              <div className="dp-fee">
                <span className="dp-fee-amount" data-testid="doctor-consultation-fee">{formattedFee}</span>
                <span className="dp-fee-note">per person, per consultation</span>
              </div>
            ) : (
              <p className="dp-empty">No consultation fee set. Patients will see that your fee is not specified.</p>
            )}
            <p className="dp-field-hint">Fee changes need admin approval. Your current fee stays in place until a request is approved.</p>

            {pending && (
              <div className="dp-fee-request dp-fee-request-pending" role="status">
                <StatusBadge status="Pending" />
                <p>
                  You asked to change your fee to <strong>{formatConsultationFee(pending.requestedFee)}</strong> on {formatDate(pending.submittedAtUtc)}.
                  You can submit a new request after an admin approves or rejects this one.
                </p>
              </div>
            )}

            {editing && (
              <form className="dp-fee-form" onSubmit={handleSubmit} noValidate aria-label="Request consultation fee change">
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="requestedFee">New Consultation Fee ({CONSULTATION_FEE_CURRENCY})</label>
                  <input
                    id="requestedFee"
                    name="requestedFee"
                    type="text"
                    inputMode="decimal"
                    className={`form-input${fieldError ? ' has-error' : ''}`}
                    value={value}
                    placeholder="e.g. 2500 or 2500.50"
                    maxLength={12}
                    aria-invalid={Boolean(fieldError)}
                    onChange={(event) => { setValue(event.target.value); setFieldError(''); }}
                  />
                  <span className="dp-field-hint">Current fee: {feeOrNotSet(currentFee)}. Charged per person, per consultation.</span>
                  {fieldError && <span className="field-error" role="alert">{fieldError}</span>}
                </div>
                <div className="dp-actions dp-availability-actions">
                  <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn btn-green" disabled={submitting}>
                    <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}

            {requests.length > 0 && (
              <button
                type="button"
                className="dp-history-toggle"
                onClick={() => setShowHistory((open) => !open)}
                aria-expanded={showHistory}
                aria-controls="fee-request-history"
              >
                <History size={14} aria-hidden="true" /> Request History ({requests.length})
                {showHistory ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            )}

            {requests.length > 0 && showHistory && (
              <div className="dp-fee-history" id="fee-request-history">
                <table>
                  <thead>
                    <tr><th>Submitted</th><th>Requested fee</th><th>Status</th><th>Admin note</th></tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id}>
                        <td>{formatDate(request.submittedAtUtc)}</td>
                        <td>{formatConsultationFee(request.requestedFee)}</td>
                        <td><StatusBadge status={request.status} /></td>
                        <td>{request.rejectionReason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </ProfileSection>

      <ConfirmDialog
        open={showOpenConfirm}
        title="Request a consultation fee change?"
        message="You will enter a new fee for an admin to review. Your current fee stays the same until the request is approved."
        confirmLabel="Yes, Continue"
        onConfirm={openForm}
        onCancel={() => setShowOpenConfirm(false)}
      />

      <ConfirmDialog
        open={showSubmitConfirm}
        title="Submit this fee change request?"
        message={`You are asking to change your consultation fee from ${feeOrNotSet(currentFee)} to ${formatConsultationFee(value) || ''}. It changes only after an admin approves it.`}
        confirmLabel="Yes, Submit"
        busy={submitting}
        onConfirm={() => submit(value)}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </div>
  );
};

export default ConsultationFeeSection;
