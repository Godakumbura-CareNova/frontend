import React, { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { prescriptionApi } from '../api/prescriptionApi';
import './patientPrescriptions.css';

const statusLabel = (status) => status === 'PendingVerification' ? 'Pending verification' : status;
const statusClass = (status) => status === 'PendingVerification' ? 'pending' : status.toLowerCase();

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await prescriptionApi.list();
      setPrescriptions(response.data);
    } catch {
      setError('Unable to load your prescriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openFile = async (id) => {
    try {
      const response = await prescriptionApi.download(id);
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Unable to open that prescription file. Please try again.');
    }
  };

  const removePrescription = async (prescription) => {
    if (!window.confirm(`Delete ${prescription.originalFileName}? This also removes the linked medicine from your cart.`)) return;
    try {
      await prescriptionApi.remove(prescription.id);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this prescription. Please try again.');
    }
  };

  return (
    <DashboardLayout>
      <section className="prescriptions-page">
        <div className="prescriptions-hero">
          <div className="prescriptions-hero-icon"><FileText size={25} /></div>
          <div>
            <p className="prescriptions-eyebrow">PATIENT RECORDS</p>
            <h1>My prescriptions</h1>
            <p>View prescriptions you have uploaded for pharmacy verification.</p>
          </div>
        </div>
        {error && <div className="management-alert error">{error}<button type="button" onClick={load}>Retry</button></div>}
        {loading ? <p>Loading prescriptions...</p> : prescriptions.length === 0 ? (
          <div className="prescriptions-empty"><FileText size={34} /><h2>No prescriptions uploaded</h2><p>Your uploaded prescription records will appear here.</p></div>
        ) : (
          <div className="prescriptions-card">
            <div className="prescription-list-header">
              <div>
                <p className="prescriptions-eyebrow">PRESCRIPTION RECORDS</p>
                <h2>Your uploaded prescriptions</h2>
              </div>
              <span className="prescription-count">{prescriptions.length} prescription{prescriptions.length === 1 ? '' : 's'}</span>
            </div>
            <div className="prescriptions-list">
              {prescriptions.map((prescription) => (
                <article className="prescription-item" key={prescription.id}>
                  <div className="prescription-file-block">
                    <span className="prescription-file-icon"><FileText size={21} /></span>
                    <div>
                      <p className="prescription-file-label">PRESCRIPTION FILE</p>
                      <h3>{prescription.originalFileName}</h3>
                    </div>
                  </div>
                  <div className="prescription-details">
                    <div><span>Medicine</span><strong>{prescription.medicineName}</strong></div>
                    <div><span>Quantity</span><strong>{prescription.quantity}</strong></div>
                  </div>
                  <div className="prescription-controls">
                    <span className={`prescription-status-badge ${statusClass(prescription.status)}`}>{statusLabel(prescription.status)}</span>
                    <span className="prescription-actions">
                    <button type="button" onClick={() => openFile(prescription.id)} className="open-prescription"><FolderOpen size={17} />Open file</button>
                    {prescription.status === 'PendingVerification' && <button type="button" aria-label="Delete prescription" onClick={() => removePrescription(prescription)} className="delete-prescription">Delete</button>}
                    </span>
                  </div>
                  {prescription.decisionReason && <div className="pharmacy-response"><strong>Pharmacy response</strong><span>{prescription.decisionReason}</span></div>}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
