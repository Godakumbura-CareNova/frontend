import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Ban, Banknote, Building2, CheckCircle2, Clock3, CreditCard, Layers, PackageCheck, RefreshCw, Search, Wallet, XCircle,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { listCompletedMedicineOrders, listMedicinePaymentTransactions } from '../services/paymentService';
import { PAYMENT_METHOD_LABELS } from '../utils/paymentValidation';
import {
  TRANSACTION_CATEGORIES, describeTransactionError, orderStatusLabel, paymentStatusLabel, transactionsBasePath,
} from '../utils/paymentTransactions';
import { money } from './orderPresentation';
import './PaymentTransactionsPage.css';

const TILE_ICONS = { All: Layers, Pending: Clock3, Successful: CheckCircle2, Failed: XCircle, Rejected: Ban };
const METHOD_ICONS = { Cash: Banknote, Online: CreditCard, BankTransfer: Building2 };

// Pharmacy staff and admins monitor medicine payment transactions and open one to review or update it.
export default function PaymentTransactionsPage() {
  const { pathname } = useLocation();
  const basePath = transactionsBasePath(pathname);
  // Staff and admins can switch to the orders that have been collected (completed).
  const [completedView, setCompletedView] = useState(false);
  const [category, setCategory] = useState('All');
  const [method, setMethod] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);

  const load = async () => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    setError(null); setData(null);
    try {
      const next = completedView
        ? { transactions: (await listCompletedMedicineOrders(search)).data, counts: null }
        : (await listMedicinePaymentTransactions({ status: category, method, search })).data;
      if (latestRequest.current === request) setData(next);
    } catch (failure) {
      if (latestRequest.current === request) setError(describeTransactionError(failure, 'We could not load payment transactions. Please try again.'));
    }
  };
  useEffect(() => { load(); }, [category, method, search, completedView]);

  // Clear the other view's data straight away, so nothing renders it with the wrong shape.
  const toggleCompleted = () => { setData(null); setError(null); setCompletedView((value) => !value); };

  const completed = completedView && data ? data.transactions : [];
  const completedTotal = completed.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const completedByMethod = Object.keys(PAYMENT_METHOD_LABELS).map((key) => ({ key, count: completed.filter((item) => item.method === key).length }));

  const submitSearch = (event) => { event.preventDefault(); setSearch(searchInput); };

  return <DashboardLayout>
    <section className="transactions-page">
      <header className="transactions-header transactions-list-header">
        <p className="transactions-eyebrow">Payment management</p>
        <h1>{completedView ? 'Completed orders' : 'Medicine payment transactions'}</h1>
        <p>{completedView
          ? 'Orders that have been collected by patients, with their payments.'
          : 'Monitor payments and order statuses for medicine orders, and review their details.'}</p>
        <button type="button" className={`transactions-btn transactions-completed-toggle${completedView ? ' active' : ''}`}
          onClick={toggleCompleted}>
          {completedView ? <><ArrowLeft size={14} /> Back to all transactions</> : <><PackageCheck size={14} /> View completed orders</>}
        </button>
      </header>

      {!completedView && <div className="transactions-tiles" role="tablist" aria-label="Transaction status">
        {TRANSACTION_CATEGORIES.map((item) => <button key={item.value} type="button" role="tab" aria-selected={category === item.value}
          className={`transactions-tile tile-${item.value.toLowerCase()}${category === item.value ? ' active' : ''}`} onClick={() => setCategory(item.value)}>
          <span className="tile-icon" aria-hidden="true">{React.createElement(TILE_ICONS[item.value], { size: 18 })}</span>
          <span className="tile-text">
            <span className="tile-label">{item.label}</span>
            <strong>{data?.counts ? data.counts[item.value.charAt(0).toLowerCase() + item.value.slice(1)] : '–'}</strong>
          </span>
        </button>)}
      </div>}

      {completedView && <div className="transactions-tiles completed-tiles" aria-label="Completed orders summary">
        {[
          { key: 'completed', label: 'Orders completed', value: data ? completed.length : '–', icon: PackageCheck },
          { key: 'value', label: 'Total value', value: data ? money(completedTotal) : '–', icon: Wallet },
          ...completedByMethod.map(({ key, count }) => ({
            key: key.toLowerCase(), label: PAYMENT_METHOD_LABELS[key], value: data ? count : '–', icon: METHOD_ICONS[key] || Wallet,
          })),
        ].map((tile) => <div key={tile.key} className={`transactions-tile completed-tile tile-${tile.key}`}>
          <span className="tile-icon" aria-hidden="true">{React.createElement(tile.icon, { size: 18 })}</span>
          <span className="tile-text">
            <span className="tile-label">{tile.label}</span>
            <strong>{tile.value}</strong>
          </span>
        </div>)}
      </div>}

      <div className="transactions-toolbar">
        <form className="transactions-search" onSubmit={submitSearch} role="search">
          <Search size={16} aria-hidden="true" />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search order number or customer" aria-label="Search transactions" />
          <button type="submit" className="transactions-btn">Search</button>
        </form>
        {!completedView && <select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Payment method">
          <option value="">All methods</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>}
        <button type="button" className="transactions-btn" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {error && <div role="alert" className="transactions-alert">
        {error.message}
        {error.retryable && <button type="button" className="transactions-btn" onClick={load}>Retry</button>}
      </div>}
      {!data && !error && <p className="transactions-muted">Loading transactions...</p>}
      {data?.transactions.length === 0 && <p className="transactions-muted">{completedView ? 'No orders have been collected yet.' : 'No payment transactions match these filters.'}</p>}

      {completedView && completed.length > 0 && <div className="transactions-table-wrap">
        <table className="transactions-table completed-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Payment status</th><th>Collected on</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {completed.map((item) => <tr key={item.id}>
              <td>
                <span className="completed-order">
                  <span className="completed-check" aria-hidden="true"><CheckCircle2 size={15} /></span>
                  <span><strong>{item.orderNumber}</strong><small>{item.itemCount} item{item.itemCount === 1 ? '' : 's'}</small></span>
                </span>
              </td>
              <td>{item.customerName || <span className="transactions-muted">Not recorded</span>}</td>
              <td>
                <span className="completed-method">
                  {React.createElement(METHOD_ICONS[item.method] || Wallet, { size: 14, 'aria-hidden': true })} {PAYMENT_METHOD_LABELS[item.method] || item.method}
                </span>
              </td>
              <td className="completed-amount">{money(item.amount)}</td>
              <td><span className={`transaction-status category-${item.category.toLowerCase()}`}>{paymentStatusLabel(item.status)}</span></td>
              <td>{new Date(item.updatedAtUtc).toLocaleString()}</td>
              <td><Link className="transactions-btn transactions-view" to={`${basePath}/${item.id}`} aria-label={`View completed order ${item.orderNumber}`}>View</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

      {!completedView && data?.transactions.length > 0 && <div className="transactions-table-wrap">
        <table className="transactions-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Payment status</th><th>Order status</th><th>Last updated</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {data.transactions.map((item) => <tr key={item.id}>
              <td><strong>{item.orderNumber}</strong><small>{item.itemCount} item{item.itemCount === 1 ? '' : 's'}</small></td>
              <td>{item.customerName || <span className="transactions-muted">Not recorded</span>}</td>
              <td>{PAYMENT_METHOD_LABELS[item.method] || item.method}</td>
              <td>{money(item.amount)}</td>
              <td><span className={`transaction-status category-${item.category.toLowerCase()}`}>{paymentStatusLabel(item.status)}</span></td>
              <td><span className={`order-status-badge order-${item.orderStatus?.toLowerCase()}`}>{orderStatusLabel(item.orderStatus)}</span></td>
              <td>{new Date(item.updatedAtUtc).toLocaleString()}</td>
              <td><Link className="transactions-btn transactions-view" to={`${basePath}/${item.id}`} aria-label={`View transaction for order ${item.orderNumber}`}>View</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>
  </DashboardLayout>;
}
