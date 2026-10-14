import React, { useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import OpeningHours from '../components/public/OpeningHours';
import PharmacyLocation from '../components/public/PharmacyLocation';
import InformationStatus from '../components/public/InformationStatus';
import usePharmacyInformation from '../hooks/usePharmacyInformation';
import { submitInquiry } from '../services/pharmacyInformationService';
import { inquiryServerErrors, validateInquiry } from '../utils/pharmacyInformationValidation';
import storefrontPhoto from '../assets/contact-storefront.jpg';
import './pharmacyInformation.css';
const empty = { name: '', email: '', phone: '', subject: '', message: '' };
export default function ContactUsPage() {
  const state = usePharmacyInformation(); const { data } = state;
  const [form, setForm] = useState(empty), [errors, setErrors] = useState({}), [failure, setFailure] = useState(''), [success, setSuccess] = useState(''), [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const submit = async event => {
    event.preventDefault(); if (submitting.current) return;
    setSuccess(''); setFailure('');
    const validation = validateInquiry(form); setErrors(validation);
    if (Object.keys(validation).length) return;
    submitting.current = true; setSaving(true);
    try { const result = await submitInquiry(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))); setSuccess(result.message || 'Your inquiry has been received. Thank you for contacting CareNova.'); setForm(empty); }
    catch (error) { setFailure(error.response?.data?.message || 'Unable to send your inquiry. Please try again.'); setErrors(inquiryServerErrors(error)); }
    finally { submitting.current = false; setSaving(false); }
  };
  return <DashboardLayout><div className="pharmacy-info-page">
    <header className="welcome-banner"><h1>Contact <span className="welcome-name">CareNova</span></h1><p>We’re here to help. Find our contact details or send an inquiry.</p></header>
    <figure className="pharmacy-storefront"><img src={storefrontPhoto} alt="Godakumbura CareNova pharmacy storefront" /></figure>
    <InformationStatus {...state} />
    {!state.loading && !state.error && data && <>
      <div className="pharmacy-info-grid"><section className="management-card"><h2>Get in touch</h2><h3>Address</h3><p className="pharmacy-preserve-lines">{data.address || 'Address has not been published yet.'}</p><h3>Phone</h3><p>{data.phone ? <a href={`tel:${data.phone.replace(/[^\d+]/g, '')}`}>{data.phone}</a> : 'Phone number has not been published yet.'}</p><h3>Email</h3><p>{data.email ? <a href={`mailto:${data.email}`}>{data.email}</a> : 'Email address has not been published yet.'}</p></section><OpeningHours hours={data.openingHours} /></div>
      <PharmacyLocation information={data} />
    </>}
    <section className="management-card"><h2>Send an inquiry</h2><p>Your inquiry will be saved for review by the pharmacy.</p>
      {success && <div className="management-alert success" role="status">{success}</div>}
      {failure && <div className="management-alert error" role="alert">{failure}</div>}
      <form className="pharmacy-form" onSubmit={submit} noValidate>
        {[['name', 'Name', 'text', 120], ['email', 'Email', 'email', 254], ['phone', 'Phone (optional)', 'tel', 40], ['subject', 'Subject', 'text', 200], ['message', 'Message', 'textarea', 5000]].map(([name, label, type, limit]) => <label key={name} htmlFor={`inquiry-${name}`}>{label}{type === 'textarea' ? <textarea id={`inquiry-${name}`} value={form[name]} required maxLength={limit} disabled={saving} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : undefined} onChange={event => setForm({ ...form, [name]: event.target.value })} /> : <input id={`inquiry-${name}`} type={type} value={form[name]} required={name !== 'phone'} maxLength={limit} disabled={saving} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : undefined} onChange={event => setForm({ ...form, [name]: event.target.value })} />}{errors[name] && <span id={`error-${name}`} className="field-error" role="alert">{errors[name]}</span>}</label>)}
        <div className="management-actions"><button className="primary-action" disabled={saving}>{saving ? 'Sending…' : failure ? 'Retry inquiry' : 'Send inquiry'}</button></div>
      </form>
    </section>
  </div></DashboardLayout>;
}
