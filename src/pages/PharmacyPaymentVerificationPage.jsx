import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck, Ban, BellRing, CheckCircle2, Clock3, FileImage, ImageOff, Inbox, Landmark, Layers,
  Maximize2, Pill, RefreshCw, ScanEye, Search, Send, ShieldCheck, ShoppingBag, X, XCircle,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { staffOrderApi } from '../api/staffOrderApi';
import {
  approveBankTransfer, getBankTransferReceiptFile, listBankTransferReceipts, rejectBankTransferReceipt,
} from '../services/paymentService';
import { formatFileSize } from '../utils/receiptValidation';
import { orderStatusLabel } from '../utils/paymentTransactions';
import {
  GROUP_LABELS, REJECTION_REASONS, VALIDATION_GROUPS, describeReceiptFileError, describeValidationError, receiptGroup,
} from '../utils/bankTransferValidation';
import { money } from './orderPresentation';
import './PharmacyPaymentVerificationPage.css';

const TILE_ICONS = { All: Layers, Pending: Clock3, Approved: CheckCircle2, Rejected: XCircle };
const GROUP_TONES = { Pending: 'pending', Approved: 'approved', Rejected: 'rejected' };
const formatDate = (value) => (value ? new Date(value).toLocaleString() : '');
const formatDay = (value) => (value ? new Date(value).toLocaleDateString() : '');

function Section({ tone = 'green', icon: Icon, title, action, children }) {
  return <section className={`btv-section btv-section-${tone}`}>
    <header className="btv-section-header">
      <span className="btv-section-icon" aria-hidden="true"><Icon size={15} /></span>
      <h3 className="btv-section-title">{title}</h3>
      {action && <div className="btv-section-action">{action}</div>}
    </header>
    <div className="btv-section-body">{children}</div>
  </section>;
}

// The uploaded receipt, shown inline. A file that is missing, damaged or not an image shows an error instead, and
// staff can reject the transaction from there.
function ReceiptPreview({ receipt, onUnviewable }) {
  const [state, setState] = useState({ url: '', error: '', loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let url = '';
    let cancelled = false;
    setState({ url: '', error: '', loading: true });
    getBankTransferReceiptFile(receipt.id)
      .then((file) => {
        url = URL.createObjectURL(file.data);
        if (!cancelled) setState({ url, error: '', loading: false });
      })
      .catch(async (failure) => {
        const error = await describeReceiptFileError(failure);
        if (!cancelled) setState({ url: '', error, loading: false });
      });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [receipt.id, attempt]);

  const openFull = () => { if (state.url) window.open(state.url, '_blank', 'noopener'); };

  return <div className="btv-preview">
    {state.loading && <div className="btv-preview-empty"><span className="btv-spinner" aria-hidden="true" /> Loading receipt...</div>}
    {state.error && <div role="alert" className="btv-preview-error">
      <ImageOff size={30} aria-hidden="true" />
      <strong>Receipt cannot be viewed</strong>
      <p>{state.error}</p>
      <div className="btv-actions">
        <button type="button" className="btv-btn btv-btn-ghost" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={14} /> Try again</button>
        {receipt.status === 'PendingVerification' && <button type="button" className="btv-btn btv-btn-red-outline" onClick={onUnviewable}>
          <XCircle size={14} /> Reject transaction
        </button>}
      </div>
    </div>}
    {state.url && <>
      <button type="button" className="btv-preview-frame" onClick={openFull} aria-label={`Open receipt ${receipt.fileName} full size`}>
        <img src={state.url} alt={`Bank transfer receipt for order ${receipt.orderNumber}`}
          onError={() => setState({ url: '', loading: false, error: 'The receipt image is damaged or not a valid image, so it cannot be displayed.' })} />
      </button>
      <div className="btv-preview-meta">
        <span><FileImage size={14} aria-hidden="true" /> {receipt.fileName} · {formatFileSize(receipt.sizeBytes)}</span>
        <button type="button" className="btv-btn btv-btn-ghost" onClick={openFull}><Maximize2 size={14} /> Full size</button>
      </div>
    </>}
  </div>;
}

// Pharmacy staff validate bank transfer transactions: view the receipt, review the payment against the order, and
// approve or reject it. On approval the server checks the transaction against the order in the pharmacy; one that does
// not match is rejected with the reason instead. The patient is notified of the result.
export default function PharmacyPaymentVerificationPage() {
  const { showToast } = useToast();
  const [group, setGroup] = useState('Pending');
  const [receipts, setReceipts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [formError, setFormError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // The review popup is open for the selected order; older payments without saved medicines read them from the pharmacy.
  const [open, setOpen] = useState(false);
  const [orderedItems, setOrderedItems] = useState({ items: [], loading: false });
  const closeRef = useRef(null);

  const load = async () => {
    setLoadError(null);
    try {
      setReceipts((await listBankTransferReceipts('All')).data);
    } catch (failure) {
      setReceipts(null);
      setLoadError(describeValidationError(failure, 'We could not load bank transfer transactions. Please try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const result = { All: receipts?.length || 0, Pending: 0, Approved: 0, Rejected: 0 };
    (receipts || []).forEach((receipt) => { result[receiptGroup(receipt)] += 1; });
    return result;
  }, [receipts]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (receipts || []).filter((receipt) => (group === 'All' || receiptGroup(receipt) === group)
      && (!term || receipt.orderNumber.toLowerCase().includes(term) || receipt.customerName.toLowerCase().includes(term)));
  }, [receipts, group, search]);


  const selected = receipts?.find((receipt) => receipt.id === selectedId) || null;
  const pending = selected?.status === 'PendingVerification';

  const select = (receipt) => { setSelectedId(receipt.id); setOpen(true); };
  const close = () => { if (!busy) { setOpen(false); setConfirming(false); } };
  useEffect(() => { setFormError(''); setRejecting(false); setReason(''); }, [selectedId]);

  // Escape closes the popup; the page behind it does not scroll while it is open.
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !confirming) close(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [open, confirming, busy]);

  // What was ordered: the medicines saved with the payment, or (for older payments) the pharmacy's copy of the order.
  useEffect(() => {
    if (!open || !selected) return undefined;
    if (selected.items?.length) { setOrderedItems({ items: selected.items, loading: false }); return undefined; }
    let cancelled = false;
    setOrderedItems({ items: [], loading: true });
    staffOrderApi.listActive()
      .then(({ data }) => {
        const order = data.find((item) => item.id === selected.orderId);
        const items = (order?.items || []).map((item) => ({
          medicineName: item.medicineName, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.unitPrice * item.quantity,
        }));
        if (!cancelled) setOrderedItems({ items, loading: false });
      })
      .catch(() => { if (!cancelled) setOrderedItems({ items: [], loading: false }); });
    return () => { cancelled = true; };
  }, [open, selected?.id, selected?.items?.length]);

  const replace = (updated) => setReceipts((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));

  const startApprove = () => { setFormError(''); setConfirming(true); };

  const approve = async () => {
    setBusy(true); setFormError('');
    try {
      const updated = (await approveBankTransfer(selected.id)).data;
      replace(updated);
      showToast(`Bank transfer for order ${updated.orderNumber} approved. The payment is confirmed and the patient will be notified.`, 'success');
      await load();
    } catch (failure) {
      if (failure?.response?.status === 422 && failure.response.data?.receipt) {
        replace(failure.response.data.receipt);
        showToast(`Order ${selected.orderNumber}: the transaction does not match the order, so it was rejected. The patient will be notified.`, 'danger');
      }
      setFormError(describeValidationError(failure, 'We could not approve this transaction. Please try again.').message);
    } finally {
      setBusy(false); setConfirming(false);
    }
  };

  const reject = async () => {
    if (!reason.trim()) { setFormError('Give a reason so the patient knows what to fix.'); return; }
    setBusy(true); setFormError('');
    try {
      const updated = (await rejectBankTransferReceipt(selected.id, reason.trim())).data;
      replace(updated);
      showToast(`Bank transfer for order ${updated.orderNumber} rejected. The patient will be notified to upload a valid receipt.`, 'danger');
      setRejecting(false); setReason('');
      await load();
    } catch (failure) {
      setFormError(describeValidationError(failure, 'We could not reject this transaction. Please try again.').message);
    } finally {
      setBusy(false);
    }
  };

  const beginReject = (text = '') => { setRejecting(true); setReason(text); setFormError(''); };

  const tone = selected ? GROUP_TONES[receiptGroup(selected)] : 'pending';

  return <DashboardLayout>
    <section className="btv-page">
      <header className="btv-hero">
        <span className="btv-hero-avatar" aria-hidden="true"><Landmark size={34} /></span>
        <div className="btv-hero-text">
          <p className="btv-hero-eyebrow">Pharmacy workspace</p>
          <h1 className="btv-hero-title">Bank transfer verification</h1>
          <p className="btv-hero-subtitle">Check each receipt against the order and your bank statement. An order is confirmed only after its transfer is approved.</p>
        </div>
        <div className="btv-hero-stat">
          <span>Awaiting review</span>
          <strong>{receipts ? counts.Pending : '–'}</strong>
        </div>
      </header>

      <div className="btv-tiles" role="tablist" aria-label="Transaction status">
        {VALIDATION_GROUPS.map((item) => <button key={item.value} type="button" role="tab" aria-selected={group === item.value}
          className={`btv-tile tile-${item.value.toLowerCase()}${group === item.value ? ' active' : ''}`} onClick={() => setGroup(item.value)}>
          <span className="btv-tile-icon" aria-hidden="true">{React.createElement(TILE_ICONS[item.value], { size: 18 })}</span>
          <span className="btv-tile-text">
            <span className="btv-tile-label">{item.label}</span>
            <strong>{receipts ? counts[item.value] : '–'}</strong>
          </span>
        </button>)}
      </div>

      <div className="btv-toolbar">
        <form className="btv-search" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput); }}>
          <Search size={16} aria-hidden="true" />
          <input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) setSearch(''); }}
            placeholder="Search order number or customer" aria-label="Search transactions" />
          <button type="submit" className="btv-btn btv-btn-ghost">Search</button>
        </form>
        <button type="button" className="btv-btn btv-btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {loadError && <div role="alert" className="btv-alert">
        {loadError.message}
        {loadError.retryable && <button type="button" className="btv-btn btv-btn-ghost" onClick={load}><RefreshCw size={14} /> Retry</button>}
      </div>}
      {!receipts && !loadError && <div className="btv-loading"><span className="btv-spinner" aria-hidden="true" /> Loading transactions...</div>}

      {receipts && visible.length === 0 && <div className="btv-empty">
        <Inbox size={34} aria-hidden="true" />
        <strong>{group === 'Pending' && !search ? 'All caught up' : 'Nothing to show'}</strong>
        <p>{group === 'Pending' && !search ? 'No bank transfers are waiting for verification.' : 'No transactions match this filter.'}</p>
      </div>}

      {receipts && visible.length > 0 && <ul className="btv-queue" aria-label="Bank transfer transactions">
          {visible.map((receipt) => {
            const itemGroup = receiptGroup(receipt);
            return <li key={receipt.id}>
              <button type="button" className={`btv-queue-item${open && receipt.id === selectedId ? ' selected' : ''}`}
                onClick={() => select(receipt)} aria-label={`Review order ${receipt.orderNumber} from ${receipt.customerName}`}>
                <span className="btv-queue-top">
                  <strong>{receipt.orderNumber}</strong>
                  <span className={`btv-pill btv-pill-${GROUP_TONES[itemGroup]}`}>{itemGroup}</span>
                </span>
                <span className="btv-queue-customer">{receipt.customerName}</span>
                <span className="btv-queue-bottom">
                  <span className="btv-queue-amount">{money(receipt.amount)}</span>
                  <span>{formatDate(receipt.uploadedAtUtc)}</span>
                </span>
                <span className="btv-queue-open"><ScanEye size={13} /> Review transaction</span>
              </button>
            </li>;
          })}
        </ul>}

      {createPortal(<div className="btv-overlay-root">
      {open && selected && <div className="btv-modal-backdrop" onClick={close}>
        <article className={`btv-review tone-${tone}`} role="dialog" aria-modal="true" aria-label={`Review order ${selected.orderNumber}`}
          onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btv-close" onClick={close} ref={closeRef} aria-label="Close" disabled={busy}><X size={20} /></button>
          <header className="btv-review-header">
            <div>
              <p className="btv-review-eyebrow">Transaction #{selected.id} · Order {selected.orderNumber}</p>
              <h2>{selected.customerName}</h2>
              <div className="btv-chips">
                <span className={`btv-pill btv-pill-${tone}`}>{GROUP_LABELS[receiptGroup(selected)]}</span>
                <span className="btv-pill btv-pill-white">Order: {orderStatusLabel(selected.orderStatus) || 'Pending'}</span>
              </div>
            </div>
            <div className="btv-review-amount"><span>Order total</span><strong>{money(selected.amount)}</strong></div>
          </header>

          <ol className="btv-steps" aria-label="Verification progress">
            <li className="done"><span><Send size={14} /></span>Receipt uploaded<small>{formatDate(selected.uploadedAtUtc)}</small></li>
            <li className={pending ? 'current' : selected.status === 'Verified' ? 'done' : 'failed'}>
              <span>{pending ? <ScanEye size={14} /> : selected.status === 'Verified' ? <BadgeCheck size={14} /> : <XCircle size={14} />}</span>
              {pending ? 'Staff review' : selected.status === 'Verified' ? 'Approved' : 'Rejected'}
              <small>{pending ? 'Waiting for you' : formatDate(selected.reviewedAtUtc)}</small>
            </li>
            <li className={selected.patientNotified ? 'done' : ''}><span><BellRing size={14} /></span>Patient notified
              <small>{selected.patientNotified ? 'Notification delivered' : pending ? 'After the review' : 'Notification pending'}</small>
            </li>
          </ol>

          <div className="btv-review-grid">
            <Section tone="yellow" icon={FileImage} title="Uploaded receipt">
              <ReceiptPreview receipt={selected} onUnviewable={() => beginReject('The receipt file could not be opened. Please upload the receipt again.')} />
            </Section>

            <Section tone="green" icon={Landmark} title="Payment information">
              <dl className="btv-info">
                <div><dt>Order total</dt><dd>{money(selected.amount)}</dd></div>
                <div><dt>Customer</dt><dd>{selected.customerName}</dd></div>
                <div><dt>Bank transfer chosen</dt><dd>{formatDay(selected.paymentCreatedAtUtc)}</dd></div>
                <div><dt>Receipt uploaded</dt><dd>{formatDate(selected.uploadedAtUtc)}</dd></div>
              </dl>

              <h4 className="btv-subheading"><ShoppingBag size={15} aria-hidden="true" /> What was ordered</h4>
              {orderedItems.loading && <p className="btv-muted"><span className="btv-spinner" aria-hidden="true" /> Loading medicines...</p>}
              {!orderedItems.loading && orderedItems.items.length === 0 && <p className="btv-muted">The medicines for this order are not available.</p>}
              {!orderedItems.loading && orderedItems.items.length > 0 && <div className="btv-items-scroll" role="region" aria-label="Ordered medicines" tabIndex={0}><table className="btv-items">
                <thead><tr><th>Medicine</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead>
                <tbody>{orderedItems.items.map((item, index) => <tr key={`${item.medicineName}-${index}`}>
                  <td><span className="btv-med-icon" aria-hidden="true"><Pill size={12} /></span>{item.medicineName}</td>
                  <td><span className="btv-qty">{item.quantity} ×</span></td><td>{money(item.unitPrice)}</td><td>{money(item.lineTotal)}</td>
                </tr>)}</tbody>
                <tfoot><tr><td colSpan={3}>Total</td><td>{money(selected.amount)}</td></tr></tfoot>
              </table></div>}
            </Section>
          </div>

          {pending && <Section tone="green" icon={ShieldCheck} title="Validate transaction">
            {formError && <div role="alert" className="btv-alert btv-alert-inline">{formError}</div>}

            <div className="btv-actions btv-actions-first">
              <button type="button" className="btv-btn btv-btn-green" disabled={busy} onClick={startApprove}>
                <BadgeCheck size={15} /> Approve transaction
              </button>
              <button type="button" className={`btv-btn ${rejecting ? 'btv-btn-red' : 'btv-btn-red-outline'}`} disabled={busy}
                onClick={() => (rejecting ? setRejecting(false) : beginReject())}>
                <Ban size={15} /> {rejecting ? 'Cancel rejection' : 'Reject transaction'}
              </button>
            </div>

            {rejecting && <div className="btv-reject">
              <p>Why can this transaction not be verified?</p>
              <div className="btv-reasons">
                {REJECTION_REASONS.map((text) => <button key={text} type="button" className={reason === text ? 'active' : ''} onClick={() => setReason(text)}>{text}</button>)}
              </div>
              <label htmlFor={`reject-reason-${selected.id}`}>Reason sent to the patient</label>
              <textarea id={`reject-reason-${selected.id}`} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              <div className="btv-actions">
                <button type="button" className="btv-btn btv-btn-red" disabled={busy || !reason.trim()} onClick={reject}>
                  {busy ? 'Rejecting...' : 'Confirm rejection'}
                </button>
                <span className="btv-counter">{reason.length}/500</span>
              </div>
            </div>}
          </Section>}

          {!pending && <Section tone={selected.status === 'Verified' ? 'green' : 'red'} icon={selected.status === 'Verified' ? BadgeCheck : XCircle}
            title="Verification result">
            <dl className="btv-info">
              <div><dt>Result</dt><dd>{selected.status === 'Verified' ? 'Approved – payment confirmed' : 'Rejected'}</dd></div>
              <div><dt>Reviewed</dt><dd>{formatDate(selected.reviewedAtUtc)}</dd></div>
              {selected.transactionReference && <div><dt>Transaction reference</dt><dd>{selected.transactionReference}</dd></div>}
              {selected.transferredAmount != null && <div><dt>Transferred amount</dt><dd>{money(selected.transferredAmount)}</dd></div>}
              {selected.transferDateUtc && <div><dt>Transfer date</dt><dd>{formatDay(selected.transferDateUtc)}</dd></div>}
              <div><dt>Patient</dt><dd>{selected.patientNotified ? 'Notified' : 'Notification pending'}</dd></div>
            </dl>
            {selected.rejectionReason && <p className="btv-reason"><strong>Reason:</strong> {selected.rejectionReason}</p>}
          </Section>}
        </article>
      </div>}

      <ConfirmDialog
        open={confirming}
        title="Approve this bank transfer?"
        message={selected ? `Order ${selected.orderNumber} will be marked as paid (${money(selected.amount)}) and ${selected.customerName} will be notified.` : ''}
        confirmLabel="Approve"
        busy={busy}
        onConfirm={approve}
        onCancel={() => setConfirming(false)}
      />
      </div>, document.body)}
    </section>
  </DashboardLayout>;
}
