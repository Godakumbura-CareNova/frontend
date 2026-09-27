import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, CircleDot, Clock3, CreditCard, Eye, FileImage, History, PackageCheck, Pill, ReceiptText,
  RefreshCw, Settings2, Truck, XCircle,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { getMedicinePaymentTransaction, updateMedicinePaymentStatus } from '../services/paymentService';
import { PAYMENT_METHOD_LABELS } from '../utils/paymentValidation';
import { RECEIPT_STATUS_TEXT, formatFileSize } from '../utils/receiptValidation';
import {
  NOTIFICATION_STATUS_TEXT, STATUS_ACTIONS, describeTransactionError,
  orderStatusLabel, paymentStatusLabel, transactionsBasePath,
} from '../utils/paymentTransactions';
import { money } from './orderPresentation';
import './PaymentTransactionDetailPage.css';

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '');

// Colour tone for a payment status group and an order status: yellow pending, green done, orange failed, red rejected.
const PAYMENT_TONES = { Pending: 'pending', Successful: 'success', Failed: 'failed', Rejected: 'rejected' };
const ORDER_TONES = { Pending: 'pending', ReadyForCollection: 'ready', Collected: 'success', Rejected: 'rejected' };
const STEP_ICONS = { done: CheckCircle2, current: Clock3, failed: XCircle, upcoming: CircleDot };

// A status change being prepared: which kind (payment or order), the target status and the note or reason.
const EMPTY_CHANGE = { status: '', text: '' };

// The order's journey from choosing a payment to collection. Cash is paid at the counter, so its order is released for
// collection before the payment is confirmed; online and bank transfer are paid first. The first unfinished step is the
// current one; a failed step stops the journey.
const journeySteps = (transaction) => {
  const order = transaction.orderStatus;
  const paymentBroken = transaction.category === 'Failed' || transaction.category === 'Rejected';
  const chosen = { label: 'Payment method chosen', detail: PAYMENT_METHOD_LABELS[transaction.method] || transaction.method, done: true };
  const payment = {
    label: 'Payment confirmed',
    detail: transaction.method === 'Cash' && transaction.status !== 'Paid' ? 'Paid at the counter on collection' : paymentStatusLabel(transaction.status),
    done: transaction.status === 'Paid',
    failed: paymentBroken,
  };
  const ready = { label: 'Ready for collection', detail: 'Patient notified to collect', done: order === 'ReadyForCollection' || order === 'Collected' };
  const collected = { label: 'Collected', detail: 'Order handed to the patient', done: order === 'Collected' };
  const rejected = { label: 'Order rejected', detail: 'The pharmacy rejected this order', failed: true };

  const flow = order === 'Rejected'
    ? (transaction.method === 'Cash' ? [chosen, rejected] : [chosen, payment, rejected])
    : transaction.method === 'Cash' ? [chosen, ready, payment, collected] : [chosen, payment, ready, collected];

  let stopped = false;
  return flow.map((step) => {
    if (step.done) return { ...step, state: 'done' };
    if (step.failed) { stopped = true; return { ...step, state: 'failed' }; }
    const state = stopped ? 'upcoming' : 'current';
    stopped = true;
    return { ...step, state };
  });
};

function Section({ tone = 'green', icon: Icon, title, action, children }) {
  return <section className={`tx-section tx-section-${tone}`}>
    <header className="tx-section-header">
      <span className="tx-section-icon" aria-hidden="true"><Icon size={15} /></span>
      <h2 className="tx-section-title">{title}</h2>
      {action && <div className="tx-section-action">{action}</div>}
    </header>
    <div className="tx-section-body">{children}</div>
  </section>;
}

// One medicine payment transaction: payment and order information, receipts, histories, and (for pharmacy staff)
// payment status actions. Order statuses are changed on the Medicine Orders page. Admins get the same page read-only.
export default function PaymentTransactionDetailPage() {
  const { paymentId } = useParams();
  const { pathname } = useLocation();
  const basePath = transactionsBasePath(pathname);
  const { showToast } = useToast();
  const [transaction, setTransaction] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [change, setChange] = useState(EMPTY_CHANGE);
  const [formError, setFormError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoadError(null); setTransaction(null);
    try {
      setTransaction((await getMedicinePaymentTransaction(paymentId)).data);
    } catch (failure) {
      setLoadError(describeTransactionError(failure, 'We could not load this transaction. Please try again.'));
    }
  };
  useEffect(() => { load(); }, [paymentId]);

  const actionText = STATUS_ACTIONS[change.status];

  // One confirmation per action: "Mark as paid" asks in a dialog; "Mark as not paid" asks for its reason inline.
  const begin = (status) => {
    setFormError('');
    if (status === 'Paid') { setChange({ status, text: '' }); setConfirming(true); return; }
    setChange(status && change.status !== status ? { status, text: '' } : EMPTY_CHANGE);
  };

  const save = async () => {
    if (change.status === 'Failed' && !change.text.trim()) { setFormError('Give a reason for marking the payment as not paid.'); return; }
    setBusy(true); setFormError('');
    try {
      const updated = (await updateMedicinePaymentStatus(transaction.id, change.status, change.text.trim() || undefined)).data;
      setTransaction(updated);
      showToast(change.status === 'Paid' ? `Payment for order ${updated.orderNumber} marked as paid.` : `Payment for order ${updated.orderNumber} marked as not paid.`,
        change.status === 'Paid' ? 'success' : 'danger');
      setChange(EMPTY_CHANGE);
    } catch (failure) {
      setFormError(describeTransactionError(failure, 'We could not save this change. Please try again.').message);
    } finally {
      setBusy(false); setConfirming(false);
    }
  };

  return <DashboardLayout>
    <section className="tx-page">
      <Link className="tx-back-link" to={basePath}><ArrowLeft size={15} /> All transactions</Link>

      {loadError && <div role="alert" className="tx-alert tx-alert-block">
        {loadError.message}
        {loadError.retryable && <button type="button" className="tx-action tx-action-ghost" onClick={load}><RefreshCw size={14} /> Retry</button>}
      </div>}
      {!transaction && !loadError && <div className="tx-loading"><span className="tx-spinner" aria-hidden="true" /> Loading transaction...</div>}

      {transaction && <>
        <header className="tx-hero">
          <span className="tx-hero-avatar" aria-hidden="true"><ReceiptText size={34} /></span>
          <div className="tx-hero-text">
            <p className="tx-hero-eyebrow">Payment transaction #{transaction.id}</p>
            <h1 className="tx-hero-title">Order {transaction.orderNumber}</h1>
            <p className="tx-hero-subtitle">{transaction.customerName || 'Customer not recorded'} · {PAYMENT_METHOD_LABELS[transaction.method] || transaction.method}</p>
            <div className="tx-hero-chips">
              <span className={`tx-chip tx-chip-${PAYMENT_TONES[transaction.category] || 'pending'}`}><CreditCard size={13} /> Payment: {paymentStatusLabel(transaction.status)}</span>
              <span className={`tx-chip tx-chip-${ORDER_TONES[transaction.orderStatus] || 'pending'}`}><PackageCheck size={13} /> Order: {orderStatusLabel(transaction.orderStatus)}</span>
            </div>
          </div>
          <svg className="tx-hero-pulse" viewBox="0 0 170 64" fill="none" aria-hidden="true">
            <path d="M0 32h48l10-22 14 44 12-30 8 8h78" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </header>

        {!transaction.canManage && <div className="tx-callout tx-callout-info" role="note">
          <Eye size={18} aria-hidden="true" />
          <div><strong>View only</strong><p>Pharmacy staff update payment and order statuses. You can review everything here.</p></div>
        </div>}

        <ol className="tx-journey" aria-label="Order progress">
          {journeySteps(transaction).map((step) => {
            const Icon = STEP_ICONS[step.state];
            return <li key={step.label} className={`tx-step tx-step-${step.state}`}>
              <span className="tx-step-dot" aria-hidden="true"><Icon size={16} /></span>
              <div><strong>{step.label}</strong><span>{step.detail}</span></div>
            </li>;
          })}
        </ol>

        <div className="tx-grid">
          <Section icon={CreditCard} title="Payment details">
            <dl className="tx-info-grid">
              <div><dt>Customer</dt><dd>{transaction.customerName || 'Not recorded'}</dd></div>
              <div><dt>Method</dt><dd>{PAYMENT_METHOD_LABELS[transaction.method] || transaction.method}</dd></div>
              <div><dt>Payment status</dt><dd><span className={`tx-pill tx-pill-${PAYMENT_TONES[transaction.category] || 'pending'}`}>{paymentStatusLabel(transaction.status)}</span></dd></div>
              <div><dt>Order status</dt><dd><span className={`tx-pill tx-pill-${ORDER_TONES[transaction.orderStatus] || 'pending'}`}>{orderStatusLabel(transaction.orderStatus)}</span></dd></div>
              <div><dt>Pharmacy order id</dt><dd>{transaction.orderId}</dd></div>
              <div><dt>Amount</dt><dd>{money(transaction.amount)}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(transaction.createdAtUtc)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDate(transaction.updatedAtUtc)}</dd></div>
            </dl>
          </Section>

          {transaction.canManage && <Section tone="red" icon={Settings2} title="Payment status">
            <div className="tx-manage-block">
              {transaction.allowedStatusChanges.length === 0
                ? <div className={`tx-callout ${transaction.status === 'ReceiptUnderVerification' ? 'tx-callout-pending' : 'tx-callout-muted'}`}>
                  {transaction.status === 'ReceiptUnderVerification' ? <Clock3 size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
                  <p>{transaction.status === 'ReceiptUnderVerification'
                    ? 'A bank transfer receipt is waiting for verification. Verify or reject it on the Bank Receipts page.'
                    : 'This payment cannot be changed from its current status.'}</p>
                </div>
                : <div className="tx-actions">
                  {transaction.allowedStatusChanges.map((status) => <button key={status} type="button" disabled={busy} onClick={() => begin(status)}
                    className={`tx-action ${status === 'Paid' ? 'tx-action-green' : 'tx-action-orange'}${change.status === status ? ' selected' : ''}`}>
                    {status === 'Paid' ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />} {STATUS_ACTIONS[status]?.label || status}
                  </button>)}
                </div>}
              {change.status === 'Failed' && <div className="tx-change-form negative">
                <label htmlFor="tx-not-paid-reason">Reason (required)</label>
                <textarea id="tx-not-paid-reason" value={change.text} rows={3} maxLength={500} placeholder="e.g. Card declined by the bank"
                  onChange={(event) => setChange({ ...change, text: event.target.value })} />
                {formError && <div role="alert" className="tx-alert">{formError}</div>}
                <div className="tx-actions">
                  <button type="button" className="tx-action tx-action-orange" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Mark as not paid'}</button>
                  <button type="button" className="tx-action tx-action-ghost" onClick={() => begin('')} disabled={busy}>Cancel</button>
                </div>
              </div>}
              {change.status !== 'Failed' && formError && <div role="alert" className="tx-alert">{formError}</div>}
              <p className="tx-change-hint tx-order-note">Order statuses (ready for collection, rejected, collected) are updated on the Medicine Orders page.</p>
            </div>
          </Section>}
        </div>

        <Section icon={Pill} title="Medicine order">
          {transaction.items.length === 0
            ? <p className="tx-empty">Medicine details were not recorded for this payment.</p>
            : <table className="tx-table">
              <thead><tr><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead>
              <tbody>
                {transaction.items.map((item, index) => <tr key={`${item.medicineName}-${index}`}>
                  <td><span className="tx-med-icon" aria-hidden="true"><Pill size={13} /></span>{item.medicineName}</td>
                  <td>× {item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.lineTotal)}</td>
                </tr>)}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td>{money(transaction.amount)}</td></tr></tfoot>
            </table>}
        </Section>

        {transaction.method === 'BankTransfer' && <Section tone="yellow" icon={FileImage} title="Bank transfer receipts">
          {transaction.receipts.length === 0
            ? <p className="tx-empty">No receipt has been uploaded yet.</p>
            : <ul className="tx-receipts">
              {transaction.receipts.map((receipt) => <li key={receipt.id}>
                <span className="tx-receipt-icon" aria-hidden="true"><FileImage size={18} /></span>
                <div>
                  <strong>{receipt.fileName}</strong>
                  <span>{formatFileSize(receipt.sizeBytes)} · Uploaded {formatDate(receipt.uploadedAtUtc)}</span>
                  {receipt.rejectionReason && <span className="tx-reason">Reason: {receipt.rejectionReason}</span>}
                </div>
                <span className={`tx-pill tx-pill-${{ PendingVerification: 'pending', Verified: 'success', Rejected: 'rejected' }[receipt.status] || 'pending'}`}>
                  {RECEIPT_STATUS_TEXT[receipt.status] || receipt.status}
                </span>
              </li>)}
            </ul>}
        </Section>}

        <div className="tx-grid">
          <Section tone="red" icon={Truck} title="Order status activity">
            {transaction.orderStatusHistory.length === 0
              ? <p className="tx-empty">No order status changes have been made from payment management yet.</p>
              : <ol className="tx-timeline">
                {transaction.orderStatusHistory.map((item, index) => <li key={index} className={`tx-dot-${ORDER_TONES[item.toStatus] || 'pending'}`}>
                  <strong>{orderStatusLabel(item.fromStatus)} → {orderStatusLabel(item.toStatus)}</strong>
                  <span className="tx-time">{formatDate(item.changedAtUtc)}</span>
                  {item.reason && <p>Reason: {item.reason}</p>}
                  <div className="tx-delivery">
                    <span className={`tx-delivery-${item.notificationStatus.toLowerCase()}`}>
                      {NOTIFICATION_STATUS_TEXT[item.notificationStatus] || item.notificationStatus}{item.notificationError ? `: ${item.notificationError}` : ''}
                    </span>
                  </div>
                </li>)}
              </ol>}
          </Section>

          <Section icon={History} title="Payment activity">
            {transaction.history.length === 0
              ? <p className="tx-empty">No activity has been recorded for this payment.</p>
              : <ol className="tx-timeline">
                {transaction.history.map((item, index) => <li key={index}
                  className={`tx-dot-${{ Paid: 'success', Failed: 'failed', ReceiptRejected: 'rejected' }[item.toStatus] || 'pending'}`}>
                  <strong>{item.fromStatus ? `${paymentStatusLabel(item.fromStatus)} → ${paymentStatusLabel(item.toStatus)}` : paymentStatusLabel(item.toStatus)}</strong>
                  <span className="tx-time">{item.changedByRole} · {formatDate(item.changedAtUtc)}</span>
                  {item.note && <p>{item.note}</p>}
                </li>)}
              </ol>}
          </Section>
        </div>

        <ConfirmDialog
          open={confirming}
          title={actionText?.label || 'Confirm change'}
          message={actionText?.confirm}
          confirmLabel={actionText?.label || 'Confirm'}
          busy={busy}
          onConfirm={save}
          onCancel={() => { setConfirming(false); setChange(EMPTY_CHANGE); }}
        />
      </>}
    </section>
  </DashboardLayout>;
}
