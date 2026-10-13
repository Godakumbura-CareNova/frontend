import { useEffect, useState } from 'react';
import {
  getPendingAppointmentReceipts,
  getAppointmentReceiptFile,
  verifyAppointmentReceipt
} from '../services/appointmentPaymentService';
import './AppointmentReceiptVerificationPage.css';

function AppointmentReceiptVerificationPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState({});

  const loadReceipts = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getPendingAppointmentReceipts();
      setReceipts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Failed to load pending appointment receipts.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const handleViewReceipt = async (receipt) => {
    setError('');
    setSuccess('');

    try {
      const blob = await getAppointmentReceiptFile(receipt.id);

      const url = window.URL.createObjectURL(blob);

      window.open(url, '_blank', 'noopener,noreferrer');

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Unable to open the receipt.'
      );
    }
  };

  const handleApprove = async (receipt) => {
    setError('');
    setSuccess('');
    setActionLoading(receipt.id);

    try {
      await verifyAppointmentReceipt(
        receipt.appointmentId,
        true,
        null
      );

      setSuccess(
        `Receipt for appointment ${receipt.appointmentReference} was approved.`
      );

      await loadReceipts();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Failed to approve the receipt.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (receipt) => {
    const reason =
      rejectionReasons[receipt.id]?.trim() || '';

    if (!reason) {
      setError(
        'Please enter a rejection reason before rejecting the receipt.'
      );
      return;
    }

    setError('');
    setSuccess('');
    setActionLoading(receipt.id);

    try {
      await verifyAppointmentReceipt(
        receipt.appointmentId,
        false,
        reason
      );

      setSuccess(
        `Receipt for appointment ${receipt.appointmentReference} was rejected.`
      );

      setRejectionReasons((current) => ({
        ...current,
        [receipt.id]: ''
      }));

      await loadReceipts();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Failed to reject the receipt.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatAmount = (amount) => {
    const numeric = Number(amount ?? 0);

    return `LKR ${numeric.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (value) => {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString();
  };

  return (
    <div className="appointment-receipt-page">
      <div className="appointment-receipt-header">
        <div>
          <h1>Appointment Payment Verification</h1>
          <p>
            Review pending bank transfer receipts and approve or reject them.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadReceipts}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="appointment-receipt-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="appointment-receipt-alert success">
          {success}
        </div>
      )}

      {loading ? (
        <div className="appointment-receipt-empty">
          Loading pending receipts...
        </div>
      ) : receipts.length === 0 ? (
        <div className="appointment-receipt-empty">
          No appointment receipts are waiting for verification.
        </div>
      ) : (
        <div className="appointment-receipt-list">
          {receipts.map((receipt) => {
            const isBusy =
              actionLoading === receipt.id;

            return (
              <div
                className="appointment-receipt-card"
                key={receipt.id}
              >
                <div className="receipt-card-top">
                  <div>
                    <h2>
                      {receipt.appointmentReference ||
                        `Appointment #${receipt.appointmentId}`}
                    </h2>

                    <span className="receipt-status">
                      {receipt.status}
                    </span>
                  </div>

                  <div className="receipt-amount">
                    {formatAmount(receipt.amount)}
                  </div>
                </div>

                <div className="receipt-details-grid">
                  <div>
                    <span className="detail-label">
                      Appointment ID
                    </span>
                    <strong>{receipt.appointmentId}</strong>
                  </div>

                  <div>
                    <span className="detail-label">
                      Patient ID
                    </span>
                    <strong>{receipt.patientId}</strong>
                  </div>

                  <div>
                    <span className="detail-label">
                      File
                    </span>
                    <strong>{receipt.fileName}</strong>
                  </div>

                  <div>
                    <span className="detail-label">
                      Uploaded
                    </span>
                    <strong>
                      {formatDate(receipt.uploadedAtUtc)}
                    </strong>
                  </div>
                </div>

                <div className="receipt-actions">
                  <button
                    type="button"
                    className="view-receipt-button"
                    onClick={() =>
                      handleViewReceipt(receipt)
                    }
                    disabled={isBusy}
                  >
                    View Receipt
                  </button>

                  <button
                    type="button"
                    className="approve-receipt-button"
                    onClick={() =>
                      handleApprove(receipt)
                    }
                    disabled={isBusy}
                  >
                    {isBusy
                      ? 'Processing...'
                      : 'Approve'}
                  </button>
                </div>

                <div className="receipt-rejection">
                  <label
                    htmlFor={`rejection-${receipt.id}`}
                  >
                    Rejection reason
                  </label>

                  <textarea
                    id={`rejection-${receipt.id}`}
                    rows="3"
                    value={
                      rejectionReasons[receipt.id] || ''
                    }
                    onChange={(event) =>
                      setRejectionReasons((current) => ({
                        ...current,
                        [receipt.id]:
                          event.target.value
                      }))
                    }
                    placeholder="Example: Amount on receipt does not match the appointment fee."
                    disabled={isBusy}
                  />

                  <button
                    type="button"
                    className="reject-receipt-button"
                    onClick={() =>
                      handleReject(receipt)
                    }
                    disabled={isBusy}
                  >
                    {isBusy
                      ? 'Processing...'
                      : 'Reject Receipt'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AppointmentReceiptVerificationPage;