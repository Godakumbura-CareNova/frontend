import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileCheck } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { getStaffAppointmentPaymentTransaction, getAppointmentReceiptFile } from '../services/appointmentPaymentService';
import { describeTransactionError } from '../utils/paymentTransactions';
import { APPOINTMENT_PAYMENT_METHODS, appointmentPaymentLabel, appointmentDate } from '../utils/appointmentTransactions';
import { money } from '../components/dashboard/DashboardSectionState';
import './PaymentTransactionsPage.css';
import './AppointmentPaymentTransactionsPage.css';

export default function AppointmentPaymentTransactionDetailPage() {
  const { paymentId } = useParams();
  const { state } = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [fileError, setFileError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const back = state?.returnUrl?.startsWith('/pharmacy/appointment-payments?') ? state.returnUrl : '/pharmacy/appointment-payments';
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setData(null); setError(null); setFileError('');
    getStaffAppointmentPaymentTransaction(paymentId, controller.signal)
      .then(value => { if (active) setData(value); })
      .catch(failure => { if (active) setError(describeTransactionError(failure, 'We could not load this appointment payment. Please try again.')); });
    return () => { active = false; controller.abort(); };
  }, [paymentId, attempt]);

  const download = async receipt => {
    setDownloading(receipt.id); setFileError('');
    try {
      const blob = await getAppointmentReceiptFile(receipt.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = receipt.fileName; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setFileError('We could not download the receipt. Please try again.'); }
    finally { setDownloading(null); }
  };
  const item = data?.transaction;
  return <DashboardLayout><section className="transactions-page appointment-transactions">
    <Link className="transactions-btn apt-back" to={back}><ArrowLeft size={16} aria-hidden="true" />Back to payment history</Link>
    <header className="transactions-header"><h1>Appointment payment details</h1><p>{item?.reference || 'Review payment information and existing history.'}</p></header>
    {error && <div role="alert" className="transactions-alert">{error.message}{error.retryable && <button type="button" className="transactions-btn" onClick={() => setAttempt(a => a + 1)}>Retry</button>}</div>}
    {!data && !error && <p role="status">Loading payment details…</p>}
    {item && <>
      <section className="apt-detail-card" aria-label="Payment information"><h2>Payment information</h2>
        <dl className="apt-details">
          {Object.entries({ Appointment: item.reference, Doctor: item.doctorName || 'Not recorded', 'Patient ID': item.patientId,
            'Appointment date': appointmentDate(item.startUtc), 'Appointment status': item.appointmentStatus,
            'Payment method': APPOINTMENT_PAYMENT_METHODS[item.method] || 'Method unavailable', Amount: money(item.amount),
            'Payment status': appointmentPaymentLabel(item), Created: appointmentDate(item.createdAtUtc),
            'Last updated': appointmentDate(item.updatedAtUtc), 'Payment confirmed': appointmentDate(item.confirmedAtUtc) }).map(([label, value]) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {item.status === 'ReceiptUnderVerification' && <Link className="transactions-btn" to="/pharmacy/appointment-payments?view=verification"><FileCheck size={16} aria-hidden="true" />Review awaiting receipts</Link>}
      </section>
      {!!data.reconciliations?.length && <section className="apt-detail-card" aria-label="Payment reconciliation"><h2>Payment reconciliation</h2><p>These payments need separate review; this page does not change their outcome.</p>
        {data.reconciliations.map(r => <article className="apt-history-item" key={r.id}><strong>{r.status}</strong><p>{r.reason}</p><time>{appointmentDate(r.createdAtUtc)}</time></article>)}
      </section>}
      <section className="apt-detail-card" aria-label="Receipt history"><h2>Receipt history</h2>
        {fileError && <p role="alert" className="transactions-alert">{fileError}</p>}
        {!data.receipts.length && <p className="transactions-muted">No receipts have been submitted.</p>}
        {data.receipts.map(receipt => <article className="apt-history-item" key={receipt.id}><div><strong>{receipt.fileName}</strong>
          <p>{({ PendingVerification: 'Awaiting verification', Verified: 'Verified', Rejected: 'Rejected' })[receipt.status] || 'Status unavailable'} · Uploaded {appointmentDate(receipt.uploadedAtUtc)}</p>
          {receipt.reviewedAtUtc && <p>Reviewed {appointmentDate(receipt.reviewedAtUtc)}</p>}
          {receipt.rejectionReason && <p>Rejection reason: {receipt.rejectionReason}</p>}</div>
          <button type="button" className="transactions-btn" disabled={downloading !== null} onClick={() => download(receipt)} aria-label={`Download ${receipt.fileName}`}><Download size={14} aria-hidden="true" />{downloading === receipt.id ? 'Downloading…' : 'Download receipt'}</button>
        </article>)}
      </section>
      <section className="apt-detail-card" aria-label="Online payment attempts"><h2>Online payment attempts</h2>
        {!data.onlineAttempts.length && <p className="transactions-muted">No online payment attempts recorded.</p>}
        {data.onlineAttempts.map(payment => <article className="apt-history-item" key={payment.id}><div><strong>Attempt {payment.attemptNumber} · {payment.status}</strong><p>{money(payment.amount)}</p>
          <p>Started {appointmentDate(payment.createdAtUtc)}</p>{payment.completedAtUtc && <p>Completed {appointmentDate(payment.completedAtUtc)}</p>}
          {payment.failureMessage && <p>{payment.failureMessage}</p>}</div></article>)}
      </section>
    </>}
  </section></DashboardLayout>;
}
