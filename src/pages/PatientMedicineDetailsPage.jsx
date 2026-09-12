import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { catalogueApi } from '../api/catalogueApi';

export default function PatientMedicineDetailsPage() {
  const { medicineId } = useParams();
  const [medicine, setMedicine] = useState(null); const [quantity, setQuantity] = useState(1); const [error, setError] = useState('');
  useEffect(() => { catalogueApi.getMedicine(medicineId).then(r => setMedicine(r.data)).catch(() => setError('This medicine is unavailable.')); }, [medicineId]);
  if (error) return <DashboardLayout><div className="management-alert error">{error}</div></DashboardLayout>;
  if (!medicine) return <DashboardLayout><p>Loading medicine...</p></DashboardLayout>;
  const continueToNextStep = () => {
    sessionStorage.setItem('carenova.pendingCartItem', JSON.stringify({ medicineId: medicine.id, quantity, prescriptionRequired: medicine.prescriptionRequired }));
  };
  return <DashboardLayout><section className="management-page"><div className="management-card"><h1>{medicine.name}</h1><p>{medicine.categoryName}</p><p>{medicine.description}</p><strong>LKR {Number(medicine.price).toFixed(2)}</strong><p>{medicine.prescriptionRequired ? 'Prescription required' : 'No prescription required'}</p><p>{medicine.stockQuantity} units available</p><div className="management-actions"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><strong>{quantity}</strong><button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(medicine.stockQuantity, quantity + 1))}>+</button></div><p>Total: LKR {(medicine.price * quantity).toFixed(2)}</p><button onClick={continueToNextStep} className="primary-action">{medicine.prescriptionRequired ? 'Continue to prescription upload' : 'Add to Cart'}</button></div></section></DashboardLayout>;
}
