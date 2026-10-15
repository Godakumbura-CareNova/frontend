import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import DashboardLayout from '../components/DashboardLayout';
import ReceiptRejectionNotice, { hasRejectedReceipt } from '../components/appointments/ReceiptRejectionNotice';
import { getPatientAppointment } from '../services/appointmentService';
import {
  cancelAppointmentOnlinePayment,
  getAppointmentOnlinePaymentResult,
  getAppointmentPayment,
  selectAppointmentPaymentMethod,
  startAppointmentOnlinePayment,
  uploadAppointmentReceipt,
} from '../services/appointmentPaymentService';
import {
  describeOnlinePaymentError,
  loadPayHere,
  validateBilling,
} from '../utils/onlinePayment';
import './PatientAppointmentPaymentPage.css';

const PAYMENT_METHODS = [
  {
    value: 'Cash',
    label: 'Cash',
    description: 'Pay in cash for your appointment.',
    icon: Banknote,
  },
  {
    value: 'BankTransfer',
    label: 'Bank transfer',
    description: 'Transfer the consultation fee and upload your receipt.',
    icon: Building2,
  },
  {
    value: 'PaymentGateway',
    label: 'Online payment',
    description: 'Pay securely online using PayHere.',
    icon: CreditCard,
  },
];

const EMPTY_BILLING = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
};

const wait = (ms) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export default function PatientAppointmentPaymentPage() {
  const { appointmentId } = useParams();
  const { key: navigationKey } = useLocation();

  const [payment, setPayment] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const requestSequence = useRef(0);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (showLoading = true) => {
    const sequence = ++requestSequence.current;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [currentAppointment, data] = await Promise.all([
        getPatientAppointment(appointmentId),
        getAppointmentPayment(appointmentId).catch(failure => { if (failure?.response?.status === 404) return null; throw failure; }),
      ]);
      if (sequence !== requestSequence.current) return;
      setAppointment(currentAppointment);
      setPayment(data);
      setSelected(data?.method || '');
    } catch (failure) {
      if (sequence !== requestSequence.current) return;
      setAppointment(null);
      setPayment(null);
      if (failure?.response?.status !== 404) {
        setError(
          failure?.response?.data?.message ||
            'Could not load appointment payment.'
        );
      }
    } finally {
      if (showLoading && sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    setAppointment(null); setPayment(null);
    load();
    return () => { requestSequence.current++; };
  }, [appointmentId, navigationKey]);

  const chooseMethod = async () => {
    if (!appointment || appointment.status === 'Cancelled') return;
    if (!selected) {
      setError('Choose a payment method.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const data = await selectAppointmentPaymentMethod(
        appointmentId,
        selected
      );

      setPayment(current => ({ ...data, latestReceipt: data.latestReceipt ?? (current?.method === data.method ? current.latestReceipt : null) }));
    } catch (failure) {
      setError(
        failure?.response?.data?.message ||
          'Could not save the payment method.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="appointment-payment-page">
        <Link
          className="appointment-payment-back"
          to={`/patient/appointments/${appointmentId}`}
        >
          ← Back
        </Link>

        <header className="appointment-payment-hero">
          <CreditCard size={30} />
          <div>
            <p>APPOINTMENT PAYMENT</p>
            <h1>{appointment?.status === 'Cancelled' ? 'Appointment payment history' : 'Pay for your appointment'}</h1>
            <span>
              Choose how you want to pay your consultation fee.
            </span>
          </div>
        </header>

        {error && (
          <div className="appointment-payment-error">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading payment...</p>
        ) : appointment?.status === 'Cancelled' ? (
          <section className="appointment-payment-card"><h2>Payment history</h2><p>This appointment is cancelled. New payments are unavailable.</p>{payment ? <PaymentSummary payment={payment} /> : <p>No payment was recorded.</p>}</section>
        ) : appointment ? (
          <>
            <section className="appointment-payment-card">
              <h2>Choose payment method</h2>

              <div className="appointment-payment-methods">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;

                  return (
                    <label
                      key={method.value}
                      className={
                        selected === method.value
                          ? 'appointment-payment-method selected'
                          : 'appointment-payment-method'
                      }
                    >
                      <input
                        type="radio"
                        name="appointment-payment-method"
                        value={method.value}
                        checked={selected === method.value}
                        disabled={busy}
                        onChange={() => setSelected(method.value)}
                      />

                      <Icon size={22} />

                      <span>
                        <strong>{method.label}</strong>
                        <small>{method.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                className="appointment-payment-primary"
                disabled={busy}
                onClick={chooseMethod}
              >
                {busy ? 'Saving...' : 'Continue'}
              </button>
            </section>

            {payment && (
              <PaymentFlow
                appointmentId={appointmentId}
                payment={payment}
                reload={() => load(false)}
              />
            )}
          </>
        ) : null}
      </section>
    </DashboardLayout>
  );
}

function PaymentFlow({
  appointmentId,
  payment,
  reload,
}) {
  if (payment.status === 'Successful') {
    return (
      <section className="appointment-payment-card appointment-payment-success">
        <CheckCircle2 size={32} />
        <h2>Payment successful</h2>
        <p>
          Your appointment payment has been confirmed.
        </p>

        <p>
          <strong>
            {payment.appointmentReference}
          </strong>
        </p>
      </section>
    );
  }

  if (payment.method === 'Cash') {
    return (
      <section className="appointment-payment-card">
        <Banknote size={30} />
        <h2>Cash selected</h2>
        <p>
          Cash has been selected for this appointment.
        </p>

        <PaymentSummary payment={payment} />
      </section>
    );
  }

  if (payment.method === 'BankTransfer') {
    return (
      <BankTransferFlow
        appointmentId={appointmentId}
        payment={payment}
        reload={reload}
      />
    );
  }

  if (payment.method === 'PaymentGateway') {
    return (
      <OnlinePaymentFlow
        appointmentId={appointmentId}
        payment={payment}
        reload={reload}
      />
    );
  }

  return null;
}

function BankTransferFlow({
  appointmentId,
  payment,
  reload,
}) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) {
      setError('Choose a receipt first.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await uploadAppointmentReceipt(
        appointmentId,
        file
      );

      await reload();
    } catch (failure) {
      setError(
        failure?.response?.data?.message ||
          'Could not upload the receipt.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (payment.status === 'ReceiptUnderVerification') {
    return (
      <section className="appointment-payment-card">
        <Clock3 size={30} />
        <h2>Receipt under verification</h2>
        <p>
          Your bank transfer receipt has been uploaded.
          Staff must verify it before the payment becomes successful.
        </p>

        <PaymentSummary payment={payment} />
      </section>
    );
  }

  return (
    <section className="appointment-payment-card">
      <Building2 size={30} />
      <h2>Bank transfer</h2>

      <ReceiptRejectionNotice payment={payment} />

      <PaymentSummary payment={payment} />

      <p>
        Transfer the consultation fee, then upload
        your payment receipt.
      </p>

      <label className="appointment-receipt-upload">
        <Upload size={20} />

        <span>
          {file ? file.name : 'Choose receipt'}
        </span>

        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={(event) =>
            setFile(event.target.files?.[0] || null)
          }
        />
      </label>

      {error && (
        <div className="appointment-payment-error">
          {error}
        </div>
      )}

      <button
        type="button"
        className="appointment-payment-primary"
        disabled={busy}
        onClick={upload}
      >
        {busy ? 'Uploading...' : hasRejectedReceipt(payment) ? 'Upload another receipt' : 'Upload receipt'}
      </button>
    </section>
  );
}

function OnlinePaymentFlow({
  appointmentId,
  payment,
  reload,
}) {
  const [billing, setBilling] =
    useState(EMPTY_BILLING);

  const [fieldErrors, setFieldErrors] =
    useState({});

  const [error, setError] =
    useState(null);

  const [result, setResult] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [confirming, setConfirming] = useState(false);

  const running = useRef(false);

  const change = (field, value) => {
    setBilling((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [field]: '',
    }));
  };

  const waitForResult = async (attemptId) => {
    for (let index = 0; index < 20; index += 1) {
      const recorded =
        await getAppointmentOnlinePaymentResult(
          appointmentId,
          attemptId
        );

      if (recorded.outcome !== 'Processing') {
        setResult(recorded);
        await reload();
        return;
      }

      await wait(2000);
    }

    const recorded =
      await getAppointmentOnlinePaymentResult(
        appointmentId,
        attemptId
      );

    setResult(recorded);
    await reload();
  };

  const pay = async (event) => {
    event.preventDefault();

    if (running.current) return;

    const validation =
      validateBilling(billing);

    setFieldErrors(validation);

    if (Object.keys(validation).length) {
      return;
    }

    running.current = true;
    setBusy(true);
    setError(null);

    let session = null;

    try {
      session =
        await startAppointmentOnlinePayment(
          appointmentId,
          billing
        );

      const payhere =
        await loadPayHere();

      payhere.onCompleted = async () => {
        setConfirming(true);

        try {
          await waitForResult(session.attemptId);
        } catch (failure) {
          setError(
            describeOnlinePaymentError(
              failure,
              'Could not confirm your payment.'
            )
          );
        } finally {
          running.current = false;
          setBusy(false);
          setConfirming(false);
        }
      };

      payhere.onDismissed = async () => {
        running.current = false;
        setBusy(false);

        try {
          const cancelled =
            await cancelAppointmentOnlinePayment(
              appointmentId,
              session.attemptId
            );

          setResult(cancelled);
        } catch {
          setResult({
            outcome: 'Cancelled',
            message:
              'The payment was cancelled.',
            canRetry: true,
          });
        }
      };

      payhere.onError = async (message) => {
        running.current = false;
        setBusy(false);

        try {
          await cancelAppointmentOnlinePayment(
            appointmentId,
            session.attemptId
          );
        } catch {
          // ignore cleanup failure
        }

        setError({
          message:
            message ||
            'The PayHere payment could not be completed.',
          retryable: true,
        });
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
      running.current = false;
      setBusy(false);

      setError(
        describeOnlinePaymentError(
          failure,
          'Could not start your payment.'
        )
      );
    }
  };

  if (result) {
    return (
      <section className="appointment-payment-card">
        {result.outcome === 'Succeeded' ? (
          <CheckCircle2 size={34} />
        ) : (
          <AlertTriangle size={34} />
        )}

        <h2>{result.outcome}</h2>
        <p>{result.message}</p>

        {result.transactionReference && (
          <p>
            Reference:{' '}
            <strong>
              {result.transactionReference}
            </strong>
          </p>
        )}

        {result.canRetry && (
          <button
            type="button"
            className="appointment-payment-primary"
            onClick={() => {
              setResult(null);
              setError(null);
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="appointment-payment-card">
      <CreditCard size={30} />

      <h2>Pay securely with PayHere</h2>

      <PaymentSummary payment={payment} />

      <div className="appointment-payment-security">
        <ShieldCheck size={18} />
        Card details are entered directly in PayHere.
        CareNova does not store your card details.
      </div>

      <form
        className="appointment-billing-form"
        onSubmit={pay}
      >
        {[
          ['firstName', 'First name'],
          ['lastName', 'Last name'],
          ['email', 'Email'],
          ['phone', 'Phone'],
          ['address', 'Address'],
          ['city', 'City'],
        ].map(([name, label]) => (
          <label key={name}>
            <span>{label}</span>

            <input
              type={
                name === 'email'
                  ? 'email'
                  : name === 'phone'
                    ? 'tel'
                    : 'text'
              }
              value={billing[name]}
              disabled={busy}
              onChange={(event) =>
                change(name, event.target.value)
              }
            />

            {fieldErrors[name] && (
              <small>
                {fieldErrors[name]}
              </small>
            )}
          </label>
        ))}

        {error && (
          <div className="appointment-payment-error">
            {error.message}
          </div>
        )}

        <button
          type="submit"
          className="appointment-payment-primary"
          disabled={busy}
        >
          {busy
            ? (confirming ? 'Confirming payment...' : 'Opening PayHere...')
            : `Pay LKR ${Number(
                payment.amount
              ).toFixed(2)}`}
        </button>
      </form>
    </section>
  );
}

function PaymentSummary({ payment }) {
  return (
    <dl className="appointment-payment-summary">
      <div>
        <dt>Appointment</dt>
        <dd>{payment.appointmentReference}</dd>
      </div>

      <div>
        <dt>Amount</dt>
        <dd>
          LKR {Number(payment.amount).toFixed(2)}
        </dd>
      </div>

      <div>
        <dt>Status</dt>
        <dd>{hasRejectedReceipt(payment) ? 'Receipt rejected' : payment.status}</dd>
      </div>
    </dl>
  );
}
