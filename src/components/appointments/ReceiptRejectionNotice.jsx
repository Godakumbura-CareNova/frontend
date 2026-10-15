import React from 'react';
import { Link } from 'react-router-dom';
import './ReceiptRejectionNotice.css';

export const hasRejectedReceipt = payment => (payment?.paymentMethod ?? payment?.method) === 'BankTransfer'
  && (payment?.paymentStatus ?? payment?.status) === 'AwaitingBankTransferReceipt' && payment?.latestReceipt?.status === 'Rejected';

export default function ReceiptRejectionNotice({ payment, reuploadTo }) {
  if (!hasRejectedReceipt(payment)) return null;
  return <div className="appointment-receipt-rejection" role="alert">
    <h3>Receipt rejected</h3>
    <p>Reason: {payment.latestReceipt.rejectionReason || 'Please upload a corrected receipt.'}</p>
    {payment.latestReceipt.reviewedAtUtc && <p className="receipt-reviewed">Reviewed {new Date(payment.latestReceipt.reviewedAtUtc).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</p>}
    {reuploadTo && <Link to={reuploadTo}>Upload another receipt →</Link>}
  </div>;
}
