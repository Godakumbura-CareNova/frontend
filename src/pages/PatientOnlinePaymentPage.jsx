import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Copy, CreditCard, FlaskConical, History, Lock, RefreshCw, ShieldCheck, XCircle,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { profileApi } from '../api/profileApi';
import { cancelOnlinePayment, completeOnlinePayment, getOnlinePaymentStatus, startOnlinePayment } from '../services/paymentService';
import {
  ATTEMPT_STATUS_TEXT, SANDBOX_TEST_CARDS, describeOnlinePaymentError, loadPayHere, splitFullName, validateBilling,
} from '../utils/onlinePayment';
import { money } from './orderPresentation';
import './PatientOnlinePaymentPage.css';

const EMPTY_BILLING = { firstName: '', lastName: '', email: '', phone: '', address: '', city: '' };
const BILLING_FIELDS = [
  { name: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Last name', autoComplete: 'family-name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', placeholder: '0771234567' },
  { name: 'address', label: 'Address', autoComplete: 'street-address', wide: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2', placeholder: 'e.g. Colombo' },
];
const POLL_INTERVAL_MS = 2000;
const POLL_LIMIT = 20;

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '');
const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

// GCN-41: the patient pays their medicine order online through PayHere. The server signs the checkout (so the amount
// cannot be changed here) and PayHere's own window takes the card; CareNova never sees it. The order is marked paid only
// when PayHere reports the result to the server with a valid signature; this page just asks the server for that result.
export default function PatientOnlinePaymentPage() {
  const { orderId } = useParams();
  const choosePath = `/patient/orders/${encodeURIComponent(orderId)}/payment`;
  const orderPath = `/patient/orders/${encodeURIComponent(orderId)}`;
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try { setStatus((await getOnlinePaymentStatus(orderId)).data); }
    catch (failure) {
      setStatus(null);
      setError(describeOnlinePaymentError(failure, 'We could not load your payment. Please try again.'));
    }
  };
  useEffect(() => { load(); }, [orderId]);

  return <DashboardLayout><section className="op-page">
    <Link className="op-back" to={choosePath}><ArrowLeft size={16} /> Payment method</Link>

    <header className="op-hero">
      <span className="op-hero-icon" aria-hidden="true"><CreditCard size={30} /></span>
      <div className="op-hero-text">
        <p className="op-eyebrow">Secure online payment · PayHere</p>
        <h1>Pay online</h1>
        <p>{status ? `Order ${status.payment.orderNumber}` : 'Your medicine order'}</p>
      </div>
    </header>

    {error && <div role="alert" className="op-alert op-alert-red">
      <AlertTriangle size={18} aria-hidden="true" /><span>{error.message}</span>
      {error.retryable ? <button type="button" className="op-btn op-btn-ghost" onClick={load}><RefreshCw size={14} /> Retry</button>
        : <Link className="op-btn op-btn-ghost" to={choosePath}>Choose a payment method</Link>}
    </div>}
    {!status && !error && <div className="op-loading"><span className="op-spinner" aria-hidden="true" /> Loading payment...</div>}

    {status && <div className="op-layout">
      <div className="op-main">
        {status.isTestMode && status.gatewayAvailable && status.payment.status !== 'Paid' && <SandboxPanel />}
        {status.payment.status === 'Paid'
          ? <ResultPanel result={{ outcome: 'Succeeded', message: 'This order has already been paid.' }} orderPath={orderPath} />
          : <PaymentForm orderId={orderId} status={status} onFinished={load} choosePath={choosePath} orderPath={orderPath} />}
        <div className="op-card op-security">
          <h2><ShieldCheck size={17} aria-hidden="true" /> Your payment is protected</h2>
          <ul>
            <li>You pay in PayHere's secure window; CareNova never sees or stores your card details.</li>
            <li>The amount is set and signed by CareNova's server, so it cannot be changed on this page.</li>
            <li>Your order is marked paid only after PayHere confirms the payment to our server.</li>
          </ul>
        </div>
      </div>

      <aside className="op-side">
        <div className="op-card op-summary">
          <h2>Order summary</h2>
          <dl>
            <div><dt>Order</dt><dd>{status.payment.orderNumber}</dd></div>
            <div><dt>Payment method</dt><dd>Online (PayHere)</dd></div>
            <div><dt>Failed attempts</dt><dd>{status.attemptsUsed} of {status.maxAttempts}</dd></div>
            <div className="op-summary-total"><dt>Total</dt><dd>{money(status.payment.amount)}</dd></div>
          </dl>
        </div>
        {status.attempts.length > 0 && <div className="op-card">
          <h2><History size={17} aria-hidden="true" /> Payment attempts</h2>
          <ol className="op-attempts">
            {status.attempts.map((attempt) => <li key={attempt.id} className={`op-attempt op-attempt-${attempt.status === 'Cancelled' ? 'failed' : attempt.status.toLowerCase()}`}>
              <div><strong>Attempt {attempt.attemptNumber}</strong><span className="op-pill">{ATTEMPT_STATUS_TEXT[attempt.status] || attempt.status}</span>
                {attempt.isTest && <span className="op-pill op-pill-test">Test</span>}</div>
              <small>{formatDate(attempt.completedAtUtc || attempt.createdAtUtc)}{attempt.paymentMethod ? ` · ${attempt.paymentMethod}` : ''}</small>
              {attempt.failureMessage && <p>{attempt.failureMessage}</p>}
            </li>)}
          </ol>
        </div>}
      </aside>
    </div>}
  </section></DashboardLayout>;
}

function SandboxPanel() {
  const [copied, setCopied] = useState('');
  const copy = async (number) => {
    try { await navigator.clipboard.writeText(number.replace(/\s/g, '')); setCopied(number); window.setTimeout(() => setCopied(''), 1500); }
    catch { /* Copying is only a convenience. */ }
  };
  return <div className="op-sandbox" role="note">
    <div className="op-sandbox-head"><FlaskConical size={18} aria-hidden="true" /><strong>PayHere sandbox test mode</strong><span>No real money is charged</span></div>
    <p>In PayHere's window, use a sandbox test card with any future expiry date and any CVV.</p>
    <ul>
      {SANDBOX_TEST_CARDS.map((card) => <li key={card.number}>
        <button type="button" onClick={() => copy(card.number)} aria-label={`Copy ${card.brand} test card ${card.number}`}>
          <span className="op-card-brand">{card.brand}</span><code>{card.number}</code><Copy size={13} aria-hidden="true" />
        </button>
        <span className={`op-pill op-pill-${card.tone}`}>{copied === card.number ? 'Copied' : card.result}</span>
      </li>)}
    </ul>
  </div>;
}

// Billing details, then PayHere's window. The server starts the try and signs it; PayHere reports the result to the
// server; this form then asks the server for the recorded result.
function PaymentForm({ orderId, status, onFinished, choosePath, orderPath }) {
  const [billing, setBilling] = useState(EMPTY_BILLING);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  // Set on every mount: React's development mode mounts twice, and the flag must end up true.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // The patient's details from their profile, so they only need to check them (and add a city).
  useEffect(() => {
    profileApi.getProfile().then((profile) => {
      if (!mounted.current) return;
      setBilling((current) => ({
        ...current,
        ...splitFullName(profile?.fullName),
        email: profile?.email || '',
        phone: profile?.mobileNumber || '',
        address: profile?.address || '',
      }));
    }).catch(() => { /* The patient can type their details. */ });
  }, []);

  const change = (field, value) => {
    const next = { ...billing, [field]: value };
    setBilling(next);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validateBilling(next)[field] }));
  };

  // PayHere tells the server first; the page polls briefly until the server has the result.
  const waitForResult = async (attemptId) => {
    setWaiting(true);
    try {
      for (let poll = 0; poll < POLL_LIMIT && mounted.current; poll += 1) {
        const recorded = (await completeOnlinePayment(orderId, attemptId)).data;
        if (recorded.outcome !== 'Processing') { setResult(recorded); return; }
        await wait(POLL_INTERVAL_MS);
      }
      setResult((await completeOnlinePayment(orderId, attemptId)).data);
    } catch (failure) {
      setError(describeOnlinePaymentError(failure, 'We could not check your payment result. Please refresh the page.'));
    } finally {
      setWaiting(false);
    }
  };

  const pay = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const problems = validateBilling(billing);
    setErrors(problems);
    if (Object.keys(problems).length) return;

    inFlight.current = true; setBusy(true); setError(null);
    let session = null;
    const settle = () => { inFlight.current = false; setBusy(false); };
    try {
      session = (await startOnlinePayment(orderId, billing)).data;
      const payhere = await loadPayHere();
      payhere.onCompleted = () => { settle(); waitForResult(session.attemptId); };
      payhere.onDismissed = async () => {
        settle();
        try { setResult((await cancelOnlinePayment(orderId, session.attemptId)).data); }
        catch { setResult({ outcome: 'Failed', message: "Payment failed: the payment was not completed in PayHere's window. Your order has not been charged.", canRetry: true }); }
      };
      payhere.onError = async (message) => {
        settle();
        try { await cancelOnlinePayment(orderId, session.attemptId); } catch { /* It is cancelled on the next try. */ }
        setError({ message: `The payment service reported a problem${message ? `: ${message}` : ''}. Your order has not been charged; please try again.`, retryable: true });
      };
      payhere.startPayment({
        sandbox: session.sandbox,
        merchant_id: session.merchantId,
        return_url: session.returnUrl,
        cancel_url: session.cancelUrl,
        notify_url: session.notifyUrl,
        order_id: session.gatewayOrderId,
        items: session.items,
        amount: session.amount,
        currency: session.currency,
        hash: session.hash,
        first_name: session.firstName,
        last_name: session.lastName,
        email: session.email,
        phone: session.phone,
        address: session.address,
        city: session.city,
        country: session.country,
        custom_1: session.custom1,
      });
    } catch (failure) {
      settle();
      if (session) { try { await cancelOnlinePayment(orderId, session.attemptId); } catch { /* Cancelled on the next try. */ } }
      setError(failure?.response
        ? describeOnlinePaymentError(failure, 'We could not start your payment. Your order has not been charged.')
        : { message: 'The PayHere payment service could not be reached. Your order has not been charged; please try again.', retryable: true });
    }
  };

  const retry = () => { setResult(null); setError(null); onFinished(); };

  if (result) return <ResultPanel result={result} orderPath={orderPath} choosePath={choosePath} onRetry={retry} onCheck={onFinished} />;
  if (waiting) {
    return <div className="op-card op-result op-result-processing" role="status">
      <span className="op-result-icon" aria-hidden="true"><Clock3 size={34} /></span>
      <h2>Confirming your payment</h2>
      <p>PayHere is confirming your payment with CareNova. Please keep this page open.</p>
      <span className="op-spinner" aria-hidden="true" />
    </div>;
  }

  if (!status.canPay) {
    return <div className="op-card"><div role="alert" className="op-alert op-alert-red">
      <AlertTriangle size={18} aria-hidden="true" /><span>{status.cannotPayReason}</span>
      {!status.gatewayAvailable && <button type="button" className="op-btn op-btn-ghost" onClick={onFinished}><RefreshCw size={14} /> Retry</button>}
    </div>
      <div className="op-actions"><Link className="op-btn op-btn-ghost" to={choosePath}>Choose another payment method</Link></div></div>;
  }

  const lastFailed = status.attempts.find((attempt) => attempt.status === 'Failed');
  return <form className="op-card op-form" onSubmit={pay} noValidate>
    <h2><Lock size={17} aria-hidden="true" /> Billing details</h2>
    {status.payment.status === 'Failed' && lastFailed && <div className="op-alert op-alert-yellow" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <span>Your last payment did not go through{lastFailed.failureMessage ? `: ${lastFailed.failureMessage}` : '.'} You can try again.</span>
    </div>}
    <p className="op-hint">PayHere needs these details for the payment. Check them, then pay in PayHere's secure window.</p>

    <div className="op-billing">
      {BILLING_FIELDS.map((field) => <label key={field.name} className={`op-field${field.wide ? ' op-field-wide' : ''}`}>
        <span>{field.label}</span>
        <input type={field.type || 'text'} value={billing[field.name]} autoComplete={field.autoComplete} placeholder={field.placeholder}
          maxLength={100} aria-invalid={Boolean(errors[field.name])} disabled={busy}
          onChange={(event) => change(field.name, event.target.value)} />
        {errors[field.name] && <small className="op-field-error" role="alert">{errors[field.name]}</small>}
      </label>)}
    </div>

    {error && <div role="alert" className="op-alert op-alert-red">
      <AlertTriangle size={18} aria-hidden="true" /><span>{error.message}</span>
    </div>}

    <button type="submit" className="op-btn op-btn-pay" disabled={busy}>
      {busy ? <><span className="op-spinner op-spinner-light" aria-hidden="true" /> Opening PayHere...</> : <><Lock size={16} /> Pay {money(status.payment.amount)} with PayHere</>}
    </button>
    <p className="op-fine">You will pay in PayHere's secure window for order {status.payment.orderNumber}. Keep this page open until the payment finishes.</p>
  </form>;
}

function ResultPanel({ result, orderPath, choosePath, onRetry, onCheck }) {
  const tone = { Succeeded: 'success', Failed: 'failed', Cancelled: 'cancelled' }[result.outcome] || 'processing';
  const Icon = { success: CheckCircle2, failed: XCircle, cancelled: XCircle }[tone] || Clock3;
  const title = { success: 'Payment successful', failed: 'Payment failed', cancelled: 'Payment cancelled' }[tone] || 'Payment processing';
  return <div className={`op-card op-result op-result-${tone}`} role="status">
    <span className="op-result-icon" aria-hidden="true"><Icon size={34} /></span>
    <h2>{title}</h2>
    <p>{result.message}</p>
    {result.transactionReference && <p className="op-ref">Payment reference: <code>{result.transactionReference}</code>{result.isTest && <span className="op-pill op-pill-test">Sandbox</span>}</p>}
    <div className="op-actions op-actions-center">
      {(tone === 'failed' || tone === 'cancelled') && result.canRetry && onRetry
        && <button type="button" className="op-btn op-btn-pay" onClick={onRetry}><RefreshCw size={15} /> Try again</button>}
      {(tone === 'failed' || tone === 'cancelled') && choosePath && <Link className="op-btn op-btn-ghost" to={choosePath}>Choose another payment method</Link>}
      {tone === 'processing' && onCheck && <button type="button" className="op-btn op-btn-ghost" onClick={onCheck}><RefreshCw size={15} /> Check again</button>}
      <Link className={`op-btn ${tone === 'success' ? 'op-btn-pay' : 'op-btn-ghost'}`} to={orderPath}>View my order</Link>
    </div>
  </div>;
}
