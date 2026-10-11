import React from 'react';
import { Link } from 'react-router-dom';

export function DashboardSectionState({ title, state, retry, children, link, linkText = 'View all' }) {
  return <section className="dashboard-section role-dashboard-section" aria-label={title}>
    <div className="role-dashboard-heading"><h2>{title}</h2>{link && <Link to={link}>{linkText} →</Link>}</div>
    {!state || state.loading ? <p role="status">Loading {title.toLowerCase()}…</p>
      : state.error ? <div className="management-alert error" role="alert"><p>{state.error}</p><button type="button" className="secondary-action" aria-label={`Retry ${title.toLowerCase()}`} onClick={retry}>Retry</button></div>
        : children}
    {state?.lastRefreshed && <p className="role-dashboard-refreshed">Last refreshed: {new Date(state.lastRefreshed).toLocaleTimeString()}</p>}
  </section>;
}

export const money = value => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);
export const dateTime = value => new Date(value).toLocaleString();
const labels = { Pending: 'Pending', ReadyForCollection: 'Ready for collection', Collected: 'Collected', Rejected: 'Rejected',
  Booked: 'Booked', Confirmed: 'Confirmed', Completed: 'Completed', Cancelled: 'Cancelled', NoShow: 'No Show',
  Paid: 'Successful', Successful: 'Successful', Failed: 'Failed', PayOnCollection: 'Pay on collection',
  AwaitingBankTransfer: 'Awaiting bank transfer', AwaitingBankTransferReceipt: 'Awaiting bank transfer receipt',
  ReceiptUnderVerification: 'Receipt under verification', ReceiptRejected: 'Receipt rejected',
  AwaitingOnlinePayment: 'Awaiting online payment', AwaitingGatewayPayment: 'Awaiting gateway payment', PendingVerification: 'Pending verification' };
export const statusLabel = value => value == null ? 'Not selected' : labels[value] ?? 'Status unavailable';
export const methodLabel = value => ({ Cash: 'Cash', BankTransfer: 'Bank transfer', Online: 'Online', PaymentGateway: 'Payment gateway' }[value] ?? (value == null ? 'Not selected' : 'Method unavailable'));
