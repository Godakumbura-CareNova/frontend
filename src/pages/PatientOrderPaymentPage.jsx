import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import MedicinePaymentMethodSelector from '../components/payments/MedicinePaymentMethodSelector';
import './patientOrders.css';

// Choosing or changing the payment method for an order after checkout.
export default function PatientOrderPaymentPage() {
  const { orderId } = useParams();
  return <DashboardLayout><section className="orders-page checkout-page">
    <Link className="order-back-link" to={`/patient/orders/${encodeURIComponent(orderId)}`}><ArrowLeft size={17} /> Back to order</Link>
    <header className="checkout-hero">
      <span className="checkout-hero-icon"><Wallet size={25} /></span>
      <div><p className="checkout-eyebrow">MEDICINE ORDER PAYMENT</p><h1>Payment method</h1><p>Choose how you want to pay for this order.</p></div>
    </header>
    <MedicinePaymentMethodSelector orderId={orderId} />
  </section></DashboardLayout>;
}
