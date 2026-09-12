import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, ShieldCheck } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { catalogueApi } from '../api/catalogueApi';
import { prescriptionApi } from '../api/prescriptionApi';
import './patientPrescriptionUpload.css';

const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
const maximumFileSize = 10 * 1024 * 1024;

export default function PatientPrescriptionUploadPage() {
  const navigate = useNavigate();
  const [selection] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('carenova.pendingCartItem') || 'null'); }
    catch { return null; }
  });
  const [medicine, setMedicine] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    if (!selection?.medicineId || !selection.prescriptionRequired) return;
    catalogueApi.getMedicine(selection.medicineId)
      .then((response) => {
        if (!response.data.prescriptionRequired) throw new Error();
        setMedicine(response.data);
      })
      .catch(() => setError('This prescription medicine is unavailable.'));
  }, [selection]);

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setError('');
    if (!selected) return setFile(null);
    const extension = `.${selected.name.split('.').pop()?.toLowerCase()}`;
    if (!allowedExtensions.includes(extension)) return setError('Choose a PDF, JPG, JPEG, or PNG file.');
    if (selected.size > maximumFileSize) return setError('Prescription files must be 10 MB or smaller.');
    setFile(selected);
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file || !medicine) return setError('Choose a prescription file before uploading.');
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('medicineId', String(medicine.id));
      formData.append('quantity', String(selection.quantity));
      formData.append('file', file);
      const response = await prescriptionApi.upload(formData);
      sessionStorage.removeItem('carenova.pendingCartItem');
      setConfirmation(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to upload your prescription. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!selection?.medicineId || !selection.prescriptionRequired) {
    return <DashboardLayout><section className="prescription-page"><div className="management-alert error">Choose a prescription medicine before uploading a prescription.</div></section></DashboardLayout>;
  }

  if (confirmation) {
    return <DashboardLayout><section className="prescription-page"><div className="prescription-card confirmation-card"><ShieldCheck size={42} /><h1>Prescription uploaded successfully</h1><p>Your prescription is waiting for pharmacy verification in My cart.</p><dl><div><dt>Prescription</dt><dd>{confirmation.originalFileName}</dd></div><div><dt>Medicine</dt><dd>{confirmation.medicineName}</dd></div><div><dt>Quantity</dt><dd>{confirmation.quantity}</dd></div><div><dt>Status</dt><dd className="pending-status">Pending verification</dd></div></dl><div className="management-actions"><button className="primary-action" onClick={() => navigate('/patient/cart')}>View my cart</button><button className="secondary-action" onClick={() => navigate('/patient/medicines')}>Continue shopping</button></div></div></section></DashboardLayout>;
  }

  return <DashboardLayout><section className="prescription-page"><div className="prescription-card"><div className="management-heading"><h1>Upload prescription</h1><p>Upload a valid prescription for your selected medicine.</p></div>{error && <div className="management-alert error">{error}</div>}{medicine ? <><div className="prescription-summary"><span>Selected medicine</span><strong>{medicine.name} × {selection.quantity}</strong><small>{medicine.stockQuantity} units currently available</small></div><form onSubmit={upload} className="prescription-upload-form"><label htmlFor="prescription-file">Prescription file<span>PDF, JPG, JPEG, or PNG · maximum 10 MB</span></label><input id="prescription-file" aria-label="Prescription file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFile} />{file && <div className="selected-file"><FileUp size={18} />{file.name}</div>}<button className="primary-action" disabled={uploading}>{uploading ? 'Uploading prescription...' : 'Upload prescription'}</button></form></> : <p>Loading selected medicine...</p>}</div></section></DashboardLayout>;
}
