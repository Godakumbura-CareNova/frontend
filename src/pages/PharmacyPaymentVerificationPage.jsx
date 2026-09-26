import React, { useEffect, useState } from 'react';
import { Bell, FileImage, RefreshCw } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import {
  getBankTransferReceiptFile, listBankTransferReceipts, listPaymentNotifications, markPaymentNotificationRead,
  rejectBankTransferReceipt, verifyBankTransferReceipt,
} from '../services/paymentService';
import { RECEIPT_STATUS_TEXT, formatFileSize } from '../utils/receiptValidation';
import { money } from './orderPresentation';
import './PharmacyPaymentVerificationPage.css';

const FILTERS = [
  { value: 'PendingVerification', label: 'Pending' },
  { value: 'Verified', label: 'Verified' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'All', label: 'All' },
];

const EVENT_TEXT = {
  Published: 'Verification event sent',
  Queued: 'Verification event queued',
  Failed: 'Verification event failed to send',
};

// Pharmacy staff verify bank transfer receipts. Orders stay Pending until a receipt is verified here.
export default function PharmacyPaymentVerificationPage() {
  const [filter, setFilter] = useState('PendingVerification');
  const [receipts, setReceipts] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = async (status = filter) => {
    setError(''); setReceipts(null);
    try {
      setReceipts((await listBankTransferReceipts(status)).data);
    } catch {
      setError('Unable to load bank transfer receipts.');
    }
    try {
      setNotifications((await listPaymentNotifications()).data.filter((item) => !item.isRead));
    } catch {
      setNotifications([]);
    }
  };
  useEffect(() => { load(filter); }, [filter]);

  const review = async (receipt, action) => {
    setBusyId(receipt.id); setError(''); setMessage('');
    try {
      if (action === 'verify') await verifyBankTransferReceipt(receipt.id);
      else await rejectBankTransferReceipt(receipt.id, reason.trim());
      setMessage(action === 'verify'
        ? `Receipt for order ${receipt.orderNumber} verified. The payment is confirmed.`
        : `Receipt for order ${receipt.orderNumber} rejected. The patient can upload a new one.`);
      setRejecting(null); setReason('');
      await load();
    } catch (failure) {
      setError(failure?.response?.data?.message || 'Unable to update this receipt. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const open = async (receipt) => {
    try {
      const file = await getBankTransferReceiptFile(receipt.id);
      const url = URL.createObjectURL(file.data);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError('Unable to open that receipt.');
    }
  };

  const dismiss = async (notification) => {
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
    try { await markPaymentNotificationRead(notification.id); } catch { /* It shows again on the next load. */ }
  };

  return <DashboardLayout>
    <section className="payment-verification-page">
      <header className="payment-verification-header">
        <p className="payment-verification-eyebrow">Pharmacy workspace</p>
        <h1>Bank transfer verification</h1>
        <p>Check uploaded receipts against your bank account. An order is confirmed as paid only after its receipt is verified.</p>
      </header>

      {notifications.length > 0 && <section className="payment-notifications" aria-label="New receipt notifications">
        {notifications.map((item) => <div key={item.id} className="payment-notification">
          <Bell size={18} aria-hidden="true" />
          <div><strong>{item.title}</strong><p>{item.message}</p></div>
          <button type="button" onClick={() => dismiss(item)}>Dismiss</button>
        </div>)}
      </section>}

      <div className="payment-verification-toolbar">
        <div className="payment-verification-filters" role="tablist" aria-label="Receipt status">
          {FILTERS.map((item) => <button key={item.value} type="button" role="tab" aria-selected={filter === item.value}
            className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
        <button type="button" className="payment-verification-refresh" onClick={() => load()}><RefreshCw size={15} /> Refresh</button>
      </div>

      {message && <div role="status" className="payment-verification-alert success">{message}</div>}
      {error && <div role="alert" className="payment-verification-alert error">{error}<button type="button" onClick={() => load()}>Retry</button></div>}
      {!receipts && !error && <p>Loading receipts...</p>}
      {receipts?.length === 0 && <p className="payment-verification-empty">
        {filter === 'PendingVerification' ? 'No receipts are waiting for verification.' : 'No receipts to show.'}
      </p>}

      {receipts?.map((receipt) => <article key={receipt.id} className="payment-receipt-card">
        <div className="payment-receipt-details">
          <p className="payment-receipt-label">Order {receipt.orderNumber}</p>
          <h2>{receipt.customerName}</h2>
          <dl>
            <div><dt>Amount</dt><dd>{money(receipt.amount)}</dd></div>
            <div><dt>Uploaded</dt><dd>{new Date(receipt.uploadedAtUtc).toLocaleString()}</dd></div>
            <div><dt>File</dt><dd>{receipt.fileName} ({formatFileSize(receipt.sizeBytes)})</dd></div>
          </dl>
          <p className={`payment-receipt-event ${receipt.verificationEvent?.toLowerCase()}`}>{EVENT_TEXT[receipt.verificationEvent] || receipt.verificationEvent}</p>
          {receipt.rejectionReason && <p className="payment-receipt-reason">Rejected: {receipt.rejectionReason}</p>}
          <button type="button" className="payment-receipt-file" onClick={() => open(receipt)}><FileImage size={16} /> View receipt</button>
        </div>
        <div className="payment-receipt-actions">
          <span className={`payment-receipt-status ${receipt.status.toLowerCase()}`}>{RECEIPT_STATUS_TEXT[receipt.status] || receipt.status}</span>
          {receipt.status === 'PendingVerification' && <>
            <button type="button" className="payment-receipt-verify" disabled={busyId === receipt.id}
              onClick={() => review(receipt, 'verify')} aria-label={`Verify receipt for order ${receipt.orderNumber}`}>Verify</button>
            <button type="button" className="payment-receipt-reject" disabled={busyId === receipt.id}
              onClick={() => { setRejecting(receipt.id); setReason(''); }}>Reject</button>
            {rejecting === receipt.id && <div className="payment-receipt-rejection">
              <label htmlFor={`receipt-reason-${receipt.id}`}>Rejection reason</label>
              <input id={`receipt-reason-${receipt.id}`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
              <div>
                <button type="button" className="payment-receipt-confirm" disabled={!reason.trim() || busyId === receipt.id}
                  onClick={() => review(receipt, 'reject')}>Confirm rejection</button>
                <button type="button" className="payment-receipt-cancel" onClick={() => setRejecting(null)}>Cancel</button>
              </div>
            </div>}
          </>}
        </div>
      </article>)}
    </section>
  </DashboardLayout>;
}
