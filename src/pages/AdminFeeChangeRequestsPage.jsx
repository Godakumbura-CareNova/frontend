import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Hourglass,
  ListFilter,
  RefreshCw,
  Settings,
  Stethoscope,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { approveFeeChangeRequest, listFeeChangeRequests, rejectFeeChangeRequest } from '../services/adminFeeChangeService';
import { formatConsultationFee } from '../utils/consultationFee';
import { parseUtcDate } from '../components/doctors/AvailabilityBadge';
import './adminFeeRequests.css';

const STATUS_FILTERS = [
  { value: 'Pending', icon: Hourglass, className: 'afr-filter-pending' },
  { value: 'Approved', icon: CheckCircle2, className: 'afr-filter-approved' },
  { value: 'Rejected', icon: XCircle, className: 'afr-filter-rejected' },
  { value: 'All', icon: ListFilter, className: 'afr-filter-all' },
];
const REASON_MIN = 5;
const REASON_MAX = 500;

const STATUS_BADGES = {
  Pending: { icon: Clock, className: 'afr-status-pending' },
  Approved: { icon: CheckCircle2, className: 'afr-status-approved' },
  Rejected: { icon: XCircle, className: 'afr-status-rejected' },
};

const formatDateTime = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
};

const formatDate = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

const formatTime = (value) => {
  const date = parseUtcDate(value);
  return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
};

// Decorative heartbeat line in the page header, echoing the other CareNova banners.
const HeaderPulse = () => (
  <svg className="afr-header-pulse" viewBox="0 0 220 90" aria-hidden="true" focusable="false">
    <path d="M0 62 H70 L82 40 L94 78 L108 22 L120 62 H150" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M150 62 C 175 62, 190 80, 220 88" fill="none" stroke="#1f7a47" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M176 18 c-4-6-14-4-14 4 c0 7 14 14 14 14 s14-7 14-14 c0-8-10-10-14-4z" fill="currentColor" opacity="0.85" />
  </svg>
);

const feeOrNotSet = (value) => formatConsultationFee(value) || 'Not set';

/** Mirrors RejectFeeChangeRequestValidator so the admin sees the problem before the request is sent. */
const validateRejectionReason = (reason) => {
  const text = (reason ?? '').trim();
  if (text === '') return 'Enter a reason for rejecting this request.';
  if (text.length < REASON_MIN) return `The reason must be at least ${REASON_MIN} characters.`;
  if (text.length > REASON_MAX) return `The reason must not exceed ${REASON_MAX} characters.`;
  return null;
};

const describeError = (error, fallback) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  if (status === 400) return { message: serverMessage || 'Please check the details.', fieldError: error?.response?.data?.errors?.Reason?.[0], retryable: false };
  if (status === 404 || status === 409) return { message: serverMessage || 'This request was already reviewed.', retryable: false, stale: true };
  if (status === 401) return { message: 'Your session has expired. Please sign in again.', retryable: false };
  if (status === 403) return { message: 'Only admins can review consultation fee requests.', retryable: false };
  if (!error?.response) return { message: 'We could not reach the doctor service. Check your connection and try again.', retryable: true };
  return { message: serverMessage || fallback, retryable: true };
};

const StatusBadge = ({ status }) => {
  const badge = STATUS_BADGES[status] || STATUS_BADGES.Pending;
  const Icon = badge.icon;
  return <span className={`afr-status ${badge.className}`}><Icon size={12} aria-hidden="true" /> {status}</span>;
};

/**
 * Admin review of doctors' consultation fee-change requests (GCN-38). Approving applies the new fee;
 * rejecting needs a reason. Both are confirmed, and the doctor is notified either way.
 */
const AdminFeeChangeRequestsPage = () => {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [pendingRejection, setPendingRejection] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const load = useCallback(async (status) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listFeeChangeRequests(status);
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(describeError(error, 'Failed to load fee change requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [load, statusFilter]);

  const openRejection = (request) => {
    setActionError(null);
    setReason('');
    setReasonError('');
    setPendingRejection(request);
  };

  const closeRejection = () => {
    setPendingRejection(null);
    setReason('');
    setReasonError('');
  };

  const approve = async () => {
    const request = pendingApproval;
    if (!request) return;
    setPendingApproval(null);
    setBusy(true);
    setActionError(null);
    try {
      await approveFeeChangeRequest(request.id);
      showToast(`Approved. ${request.doctorName || 'The doctor'}'s fee is now ${formatConsultationFee(request.requestedFee)}.`);
      await load(statusFilter);
    } catch (error) {
      const described = describeError(error, 'Failed to approve this request.');
      setActionError({ ...described, retry: () => setPendingApproval(request) });
      if (described.stale) await load(statusFilter);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    const request = pendingRejection;
    if (!request) return;

    const validationError = validateRejectionReason(reason);
    if (validationError) {
      setReasonError(validationError);
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      await rejectFeeChangeRequest(request.id, reason.trim());
      showToast(`Rejected. ${request.doctorName || 'The doctor'} has been notified with your reason.`, 'danger');
      closeRejection();
      await load(statusFilter);
    } catch (error) {
      const described = describeError(error, 'Failed to reject this request.');
      if (described.fieldError) {
        setReasonError(described.fieldError);
      } else {
        closeRejection();
        setActionError({ ...described, retry: () => openRejection(request) });
        if (described.stale) await load(statusFilter);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <header className="afr-header">
        <div className="afr-header-main">
          <div className="afr-header-icon" aria-hidden="true"><Stethoscope size={28} /></div>
          <div className="afr-header-text">
            <h1>Consultation Fee <span>Requests</span></h1>
            <p>Review doctors' requested fee changes. A doctor's fee only changes when you approve.</p>
          </div>
        </div>
        <button type="button" onClick={() => load(statusFilter)} className="afr-refresh" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
        <HeaderPulse />
      </header>

      <div className="afr-filters" role="tablist" aria-label="Filter by status">
        {STATUS_FILTERS.map(({ value, icon: Icon, className }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={statusFilter === value}
            className={`afr-filter ${className}${statusFilter === value ? ' active' : ''}`}
            onClick={() => setStatusFilter(value)}
          >
            <Icon size={15} aria-hidden="true" /> {value}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="alert alert-error afr-alert" role="alert">
          <span>{actionError.message}</span>
          {actionError.retryable && actionError.retry && (
            <button type="button" className="btn btn-secondary" onClick={actionError.retry} disabled={busy}>
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="alert alert-error afr-alert" role="alert">
          <span>{loadError.message}</span>
          <button type="button" className="btn btn-secondary" onClick={() => load(statusFilter)}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      <div className="afr-card">
        <div className="afr-table-wrap">
          <table className="afr-table">
            <thead>
              <tr>
                <th><span><UserRound size={15} aria-hidden="true" /> Doctor</span></th>
                <th><span><CircleDollarSign size={15} aria-hidden="true" /> Current fee</span></th>
                <th><span><CircleDollarSign size={15} aria-hidden="true" /> Requested fee</span></th>
                <th><span><CalendarDays size={15} aria-hidden="true" /> Submitted</span></th>
                <th><span><Clock size={15} aria-hidden="true" /> Status</span></th>
                <th><span><Settings size={15} aria-hidden="true" /> {statusFilter === 'Pending' ? 'Actions' : 'Admin note'}</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="afr-empty">Loading requests...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={6} className="afr-empty">{statusFilter === 'Pending' ? 'No fee change requests are waiting for review.' : 'No requests to show.'}</td></tr>
              ) : requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong className="afr-doctor">{request.doctorName || 'Unnamed doctor'}</strong>
                    <span className="afr-sub">{request.specialization}</span>
                  </td>
                  <td className="afr-fee">{feeOrNotSet(request.status === 'Pending' ? request.doctorCurrentFee : request.currentFee)}</td>
                  <td className="afr-fee afr-fee-requested">{formatConsultationFee(request.requestedFee)}</td>
                  <td>
                    <div className="afr-date">
                      <CalendarDays size={15} aria-hidden="true" />
                      <div>
                        <span>{formatDate(request.submittedAtUtc)}</span>
                        <span className="afr-sub">{formatTime(request.submittedAtUtc)}</span>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={request.status} /></td>
                  <td>
                    {request.status === 'Pending' ? (
                      <div className="afr-actions">
                        <button type="button" className="afr-btn afr-btn-approve" onClick={() => { setActionError(null); setPendingApproval(request); }} disabled={busy}>
                          <Check size={15} aria-hidden="true" /> Approve
                        </button>
                        <button type="button" className="afr-btn afr-btn-reject" onClick={() => openRejection(request)} disabled={busy}>
                          <X size={15} aria-hidden="true" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="afr-note">{request.rejectionReason || (request.reviewedAtUtc ? `Reviewed ${formatDateTime(request.reviewedAtUtc)}` : '—')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingApproval)}
        title="Approve this fee change?"
        message={pendingApproval
          ? `${pendingApproval.doctorName || 'The doctor'}'s consultation fee will change from ${feeOrNotSet(pendingApproval.doctorCurrentFee)} to ${formatConsultationFee(pendingApproval.requestedFee)}. Patients see the new fee straight away, and the doctor is notified.`
          : ''}
        confirmLabel="Yes, Approve"
        busy={busy}
        onConfirm={approve}
        onCancel={() => setPendingApproval(null)}
      />

      {pendingRejection && (
        <div className="confirm-dialog-backdrop" onClick={busy ? undefined : closeRejection}>
          <form
            className="confirm-dialog-panel afr-reject-panel"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); reject(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Reject this fee change?"
            noValidate
          >
            <div className="confirm-dialog-icon"><XCircle size={22} /></div>
            <h3 className="confirm-dialog-title">Reject this fee change?</h3>
            <p className="confirm-dialog-message">
              {pendingRejection.doctorName || 'The doctor'} asked for {formatConsultationFee(pendingRejection.requestedFee)}.
              Their fee stays {feeOrNotSet(pendingRejection.doctorCurrentFee)}. They will see your reason in their notification.
            </p>
            <label className="form-label" htmlFor="rejection-reason">Reason for rejection</label>
            <textarea
              id="rejection-reason"
              className={`form-input afr-reason${reasonError ? ' has-error' : ''}`}
              rows={4}
              maxLength={REASON_MAX}
              value={reason}
              placeholder="e.g. The requested fee is above the approved range for this specialization."
              aria-invalid={Boolean(reasonError)}
              onChange={(event) => { setReason(event.target.value); setReasonError(''); }}
              autoFocus
            />
            <div className="afr-reason-meta">
              {reasonError ? <span className="field-error" role="alert">{reasonError}</span> : <span />}
              <span className="afr-counter">{reason.trim().length}/{REASON_MAX}</span>
            </div>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={closeRejection} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? 'Please wait...' : 'Yes, Reject'}</button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminFeeChangeRequestsPage;
