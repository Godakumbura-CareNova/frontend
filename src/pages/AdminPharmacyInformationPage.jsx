import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import InformationStatus from '../components/public/InformationStatus';
import usePharmacyInformation from '../hooks/usePharmacyInformation';
import { savePharmacyInformation, uploadPharmacyImage, pharmacyImageUrl } from '../services/pharmacyInformationService';
import './pharmacyInformation.css';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fields = [['introduction', 'Introduction', 3000], ['background', 'Background', 6000], ['mission', 'Mission', 2000], ['vision', 'Vision', 2000], ['address', 'Address', 1000], ['phone', 'Phone', 40], ['email', 'Email', 254], ['locationDescription', 'Location description', 2000], ['mapEmbedUrl', 'Google Maps embed URL', 3000]];
export default function AdminPharmacyInformationPage() {
  const state = usePharmacyInformation(true);
  const [form, setForm] = useState(null), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [conflict, setConflict] = useState(false);
  const fileInput = useRef(null);
  useEffect(() => {
    if (!state.data) return;
    setForm({ ...Object.fromEntries(fields.map(([key]) => [key, ''])), ...state.data,
      openingHours: days.map(day => state.data.openingHours?.find(row => row.day === day) || { day, hours: '' }),
      services: state.data.services || [], images: state.data.images || [],
    });
    setConflict(false);
  }, [state.data]);
  const save = async event => {
    event.preventDefault(); if (saving || uploading) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const saved = await savePharmacyInformation({ ...form, openingHours: form.openingHours.filter(row => row.hours.trim()) });
      state.setData(saved); setSuccess('Pharmacy information saved successfully.');
    } catch (requestError) {
      const details = Object.values(requestError.response?.data?.errors || {}).flat().join(' ');
      setError(details || requestError.response?.data?.message || 'Unable to save pharmacy information. Please try again.');
      setConflict(requestError.response?.status === 409);
    } finally { setSaving(false); }
  };
  const upload = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setError(''); setSuccess('');
    if (file.size > 5 * 1024 * 1024 || !/\.(jpe?g|png|webp)$/i.test(file.name)) { setError('Choose a JPEG, PNG or WebP photograph up to 5 MB.'); event.target.value = ''; return; }
    setUploading(true);
    try {
      const image = await uploadPharmacyImage(file);
      setForm(current => ({ ...current, images: [...current.images, { url: image.url, caption: file.name.slice(0, 200) }] }));
      setSuccess('Photograph uploaded. Add a caption and save information to publish it.');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to upload this photograph. Please try again.'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const updateList = (list, index, key, value) => setForm(current => ({ ...current, [list]: current[list].map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) }));
  return <DashboardLayout><div className="pharmacy-info-page">
    <header className="welcome-banner"><h1>Manage <span className="welcome-name">Pharmacy Information</span></h1><p>Keep the public About Us and Contact Us pages accurate and up to date.</p></header>
    <InformationStatus {...state} />
    {error && <div className="management-alert error" role="alert">{error}{conflict && <><p>Reloading replaces your current edits with the latest saved information.</p><button type="button" className="secondary-action" onClick={state.reload}>Reload latest information</button></>}</div>}
    {success && <div className="management-alert success" role="status">{success}</div>}
    {!state.loading && form && <form className="pharmacy-form management-card" onSubmit={save}>
      <fieldset disabled={saving || uploading}><legend>Pharmacy details</legend>
        {fields.map(([key, label, limit]) => <label htmlFor={`info-${key}`} key={key}>{label}{['phone', 'email', 'mapEmbedUrl'].includes(key) ? <input id={`info-${key}`} type={key === 'email' ? 'email' : 'text'} value={form[key]} maxLength={limit} onChange={event => setForm({ ...form, [key]: event.target.value })} /> : <textarea id={`info-${key}`} value={form[key]} required={key === 'introduction'} maxLength={limit} onChange={event => setForm({ ...form, [key]: event.target.value })} />}</label>)}
        <p className="empty-state">Use the URL from Google Maps → Share → Embed a map. Leave unknown information blank until confirmed.</p>
      </fieldset>
      <fieldset disabled={saving || uploading}><legend>Services</legend>
        {form.services.map((service, index) => <div className="pharmacy-editor-row" key={index}>
          <label>Service {index + 1} title<input value={service.title} required maxLength={120} onChange={event => updateList('services', index, 'title', event.target.value)} /></label>
          <label>Service {index + 1} description<textarea value={service.description} required maxLength={1000} onChange={event => updateList('services', index, 'description', event.target.value)} /></label>
          <button type="button" className="secondary-action" onClick={() => setForm({ ...form, services: form.services.filter((_, itemIndex) => itemIndex !== index) })}>Remove service {index + 1}</button>
        </div>)}
        <button type="button" className="secondary-action" disabled={form.services.length >= 12} onClick={() => setForm({ ...form, services: [...form.services, { title: '', description: '' }] })}>Add service</button>
      </fieldset>
      <fieldset disabled={saving || uploading}><legend>Opening hours</legend>
        {form.openingHours.map((row, index) => <label key={row.day}>{row.day}<input value={row.hours} maxLength={120} placeholder="e.g. 8:00 AM – 8:00 PM or Closed" onChange={event => updateList('openingHours', index, 'hours', event.target.value)} /></label>)}
      </fieldset>
      <fieldset disabled={saving || uploading}><legend>Pharmacy and staff photographs</legend>
        <label>Upload photograph<input ref={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp" disabled={form.images.length >= 20} onChange={upload} /></label>
        {uploading && <p role="status">Uploading photograph…</p>}
        <div className="pharmacy-gallery">{form.images.map((image, index) => <div key={image.url}><img src={pharmacyImageUrl(image.url)} alt={image.caption} /><label>Photograph {index + 1} caption<input value={image.caption} required maxLength={200} onChange={event => updateList('images', index, 'caption', event.target.value)} /></label><button type="button" className="secondary-action" onClick={() => setForm({ ...form, images: form.images.filter((_, itemIndex) => itemIndex !== index) })}>Remove photograph {index + 1}</button></div>)}</div>
      </fieldset>
      <div className="management-actions"><button className="primary-action" disabled={saving || uploading || conflict}>{saving ? 'Saving…' : 'Save information'}</button></div>
    </form>}
  </div></DashboardLayout>;
}
