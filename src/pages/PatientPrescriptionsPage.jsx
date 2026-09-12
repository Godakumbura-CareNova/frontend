import React, { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { prescriptionApi } from '../api/prescriptionApi';
import './patientPrescriptions.css';

const statusLabel = (status) => status === 'PendingVerification' ? 'Pending verification' : status;

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

  return <DashboardLayout><section className="prescriptions-page"><div className="management-heading"><h1>My prescriptions</h1><p>View prescriptions you have uploaded for pharmacy verification.</p></div>{error && <div className="management-alert error">{error}<button onClick={load}>Retry</button></div>}{loading ? <p>Loading prescriptions...</p> : prescriptions.length === 0 ? <div className="prescriptions-empty"><FileText size={34} /><h2>No prescriptions uploaded</h2><p>Your uploaded prescription records will appear here.</p></div> : <div className="prescriptions-card"><div className="prescriptions-table"><div className="prescription-table-head"><span>Prescription</span><span>Medicine</span><span>Quantity</span><span>Status</span><span /></div>{prescriptions.map((prescription) => <div className="prescription-table-row" key={prescription.id}><span className="prescription-file"><FileText size={18} />{prescription.originalFileName}</span><span>{prescription.medicineName}</span><span>{prescription.quantity}</span><span className={`prescription-status-badge ${prescription.status === 'PendingVerification' ? 'pending' : ''}`}>{statusLabel(prescription.status)}</span><button type="button" onClick={() => openFile(prescription.id)} className="open-prescription"><FolderOpen size={17} />Open file</button></div>)}</div></div>}</section></DashboardLayout>;
}
