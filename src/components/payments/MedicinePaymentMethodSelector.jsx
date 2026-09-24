import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, Building2, CheckCircle2, CreditCard, FileUp, RefreshCw } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { getMedicinePaymentOptions, selectMedicinePaymentMethod } from '../../services/paymentService';
import { PAYMENT_METHOD_LABELS, describePaymentError, validatePaymentSelection } from '../../utils/paymentValidation';
import { money } from '../../pages/orderPresentation';
import './paymentMethods.css';

const METHOD_ICONS = { Online: CreditCard, BankTransfer: Building2, Cash: Banknote };

// What happens after confirming each method; shown in the confirmation dialog.
export const CONFIRM_PAYMENT_DETAILS = {
  Online: 'You will continue to the online payment page.',
  BankTransfer: 'We will show you the bank account to transfer to.',
  Cash: 'You will pay in cash when you collect your order. No online payment is needed.',
};

export const choosePaymentPath = (orderId) => `/patient/orders/${encodeURIComponent(orderId)}/payment`;

export const onlinePaymentPath = (orderId) => `/patient/orders/${encodeURIComponent(orderId)}/payment/online`;

// Lets a patient choose how to pay for one pharmacy order, confirm it, and continue with that method.
export default function MedicinePaymentMethodSelector({ orderId }) {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState('');
  const [validationError, setValidationError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [payment, setPayment] = useState(null);
  const inFlight = useRef(false);

  const load = async () => {
    setLoadError(null); setOptions(null);
    try {
      const data = (await getMedicinePaymentOptions(orderId)).data;
      // This page is where the method is chosen or changed, so it opens on the choices with the current one preselected.
      setOptions(data);
      setPayment(null);
      const previous = data.selectedPayment?.method;
      setSelected(data.methods.some((item) => item.method === previous && item.available) ? previous : '');
    } catch (failure) {
      setLoadError(describePaymentError(failure, 'We could not load the payment methods. Please try again.'));
    }
  };
  useEffect(() => { load(); }, [orderId]);

  const choose = (method) => { setSelected(method); setValidationError(''); setSubmitError(''); };

  const proceed = () => {
    const problem = validatePaymentSelection(selected, options?.methods);
    setValidationError(problem);
    if (!problem) setConfirming(true);
  };

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setSubmitError('');
    // Busy is cleared in the same render as the outcome, so the dialog never closes onto a stale "saving" state.
    const settle = () => { inFlight.current = false; setBusy(false); setConfirming(false); };
    let result;
    try {
      result = (await selectMedicinePaymentMethod(orderId, selected)).data;
    } catch (failure) {
      settle();
      setSubmitError(describePaymentError(failure, 'We could not save your payment method. Please try again.').message);
      // The method may have become unavailable since the list loaded; refresh which ones can be chosen.
      if (failure?.response?.status === 409) {
        try { setOptions((await getMedicinePaymentOptions(orderId)).data); } catch { /* Keep the current list. */ }
      }
      return;
    }
    settle();
    if (result.nextStep === 'OnlinePayment') navigate(onlinePaymentPath(orderId));
    else setPayment(result);
  };

  if (loadError) {
    return <section className="pay-card" aria-labelledby="pay-heading">
      <h2 id="pay-heading">Payment method</h2>
      <div role="alert" className="order-error pay-error">
        {loadError.message}
        {loadError.retryable && <button type="button" onClick={load}><RefreshCw size={15} /> Retry</button>}
      </div>
    </section>;
  }
  if (!options) return <section className="pay-card"><p className="pay-muted">Loading payment methods...</p></section>;

  if (payment) {
    return <section className="pay-card" aria-labelledby="pay-heading">
      <PaymentResult payment={payment} orderId={orderId} onChange={() => { setPayment(null); setSubmitError(''); }} />
    </section>;
  }

  const option = options.methods.find((item) => item.method === selected);
  return <section className="pay-card" aria-labelledby="pay-heading">
    <div className="pay-card-heading">
      <div><h2 id="pay-heading">Choose how to pay</h2><p>Order {options.orderNumber}{options.selectedPayment && <> | Current method: {PAYMENT_METHOD_LABELS[options.selectedPayment.method] || options.selectedPayment.method}</>}</p></div>
      <strong>{money(options.amount)}</strong>
    </div>
    <PaymentMethodOptions methods={options.methods} selected={selected} onChange={choose} disabled={busy} name={`payment-method-${orderId}`} />
    {validationError && <div role="alert" className="order-error pay-error">{validationError}</div>}
    {submitError && <div role="alert" className="order-error pay-error">{submitError}</div>}
    <div className="pay-actions">
      <button type="button" className="order-primary" onClick={proceed} disabled={busy}>
        {busy ? 'Saving...' : 'Continue to payment'}
      </button>
    </div>
    <ConfirmDialog
      open={confirming}
      title="Confirm payment method"
      message={option ? `Pay ${money(options.amount)} for order ${options.orderNumber} by ${option.label.toLowerCase()}? ${CONFIRM_PAYMENT_DETAILS[option.method] || ''}` : ''}
      confirmLabel={`Confirm ${option?.label.toLowerCase() || 'method'}`}
      busy={busy}
      onConfirm={confirm}
      onCancel={() => setConfirming(false)}
    />
  </section>;
}

// The radio list of payment methods; unavailable ones are shown with their reason and cannot be chosen.
export function PaymentMethodOptions({ methods, selected, onChange, disabled = false, name = 'payment-method' }) {
  return <div className="pay-methods" role="radiogroup" aria-label="Payment method">
    {methods.map((item) => {
      const Icon = METHOD_ICONS[item.method] || CreditCard;
      return <label key={item.method} className={`pay-method${selected === item.method ? ' selected' : ''}${item.available ? '' : ' unavailable'}`}>
        <input type="radio" name={name} value={item.method} checked={selected === item.method}
          disabled={!item.available || disabled} onChange={() => onChange(item.method)} />
        <span className="pay-method-icon"><Icon size={21} aria-hidden="true" /></span>
        <span className="pay-method-text">
          <strong>{item.label}</strong>
          <span>{item.description}</span>
          {!item.available && <span className="pay-unavailable">{item.unavailableReason}</span>}
        </span>
      </label>;
    })}
  </div>;
}

// What the patient does next for the method saved on an order. "Change payment method" goes to the order's payment
// page; pass onChange only when already on that page, to return to the choices without navigating.
export function PaymentResult({ payment, orderId, onChange }) {
  const label = PAYMENT_METHOD_LABELS[payment.method] || payment.method;
  return <>
    <div className="pay-card-heading">
      <div><h2 id="pay-heading">Payment method: {label}</h2><p>Order {payment.orderNumber}</p></div>
      <strong>{money(payment.amount)}</strong>
    </div>
    {payment.nextStep === 'BankTransferInstructions' && payment.bankTransfer && <BankTransferInstructions details={payment.bankTransfer} />}
    {payment.nextStep === 'PayOnCollection' && <div className="pay-confirmed" role="status">
      <CheckCircle2 size={22} aria-hidden="true" />
      <div><strong>Cash payment confirmed</strong><p>Pay {money(payment.amount)} in cash at the pharmacy counter when you collect your order. No online payment is needed.</p></div>
    </div>}
    {payment.nextStep === 'OnlinePayment' && <div className="pay-confirmed" role="status">
      <CreditCard size={22} aria-hidden="true" />
      <div><strong>Online payment selected</strong><p>Your order is waiting for online payment.</p></div>
    </div>}
    <div className="pay-actions">
      {onChange
        ? <button type="button" className="pay-secondary" onClick={onChange}>Change payment method</button>
        : <Link className="pay-secondary" to={choosePaymentPath(orderId)}>Change payment method</Link>}
      {payment.nextStep === 'OnlinePayment'
        ? <Link className="order-primary" to={onlinePaymentPath(orderId)}>Continue to online payment</Link>
        : <Link className="order-primary" to={`/patient/orders/${encodeURIComponent(orderId)}`}>View my order</Link>}
    </div>
  </>;
}

function BankTransferInstructions({ details }) {
  return <div className="pay-bank">
    <h3>Transfer to this account</h3>
    <dl>
      <div><dt>Bank</dt><dd>{details.bankName}</dd></div>
      {details.branch && <div><dt>Branch</dt><dd>{details.branch}</dd></div>}
      <div><dt>Account name</dt><dd>{details.accountName}</dd></div>
      <div><dt>Account number</dt><dd>{details.accountNumber}</dd></div>
      <div><dt>Amount</dt><dd>{money(details.amount)}</dd></div>
      <div><dt>Reference</dt><dd>{details.reference}</dd></div>
    </dl>
    <p className="pay-muted">Use your order number as the payment reference so the pharmacy can match your transfer.</p>
    <div className="pay-receipt">
      <span className="pay-method-icon"><FileUp size={20} aria-hidden="true" /></span>
      <div>
        <strong>Upload your payment receipt</strong>
        <p>After transferring, upload a photo or PDF of your bank slip.</p>
        <div className="pay-receipt-controls">
          <input type="file" accept="image/*,application/pdf" aria-label="Payment receipt" disabled />
          <button type="button" className="pay-secondary" disabled>Upload receipt</button>
        </div>
        <p className="pay-note">Receipt upload opens soon. Keep your bank slip until then.</p>
      </div>
    </div>
  </div>;
}
