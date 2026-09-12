import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { catalogueApi } from '../api/catalogueApi';
import './patientMedicineDetails.css';

const pharmacyHost = (import.meta.env.VITE_PHARMACY_API_BASE_URL || 'http://localhost:5134/api').replace(/\/api$/, '');

export default function PatientMedicineDetailsPage() {
  const { medicineId } = useParams();
  const [medicine, setMedicine] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    catalogueApi.getMedicine(medicineId)
      .then((response) => setMedicine(response.data))
      .catch(() => setError('This medicine is unavailable.'));
  }, [medicineId]);

  if (error) return <DashboardLayout><div className="management-alert error">{error}</div></DashboardLayout>;
  if (!medicine) return <DashboardLayout><p>Loading medicine...</p></DashboardLayout>;

  const imageUrl = medicine.imagePath
    ? `${pharmacyHost}${medicine.imagePath.startsWith('/') ? '' : '/'}${medicine.imagePath}`
    : null;

  const continueToNextStep = () => {
    sessionStorage.setItem('carenova.pendingCartItem', JSON.stringify({
      medicineId: medicine.id,
      quantity,
      prescriptionRequired: medicine.prescriptionRequired,
    }));
  };

  return (
    <DashboardLayout>
      <section className="medicine-details-page">
        <div className="medicine-details-card">
          <div className="medicine-image-panel">
            {imageUrl ? <img src={imageUrl} alt={`${medicine.name} medicine`} /> : <span>Medicine</span>}
          </div>
          <div className="medicine-details-content">
            <span className="category-badge">{medicine.categoryName}</span>
            <h1>{medicine.name}</h1>
            <p className="medicine-description">{medicine.description}</p>
            <div className="medicine-meta">
              <strong>LKR {Number(medicine.price).toFixed(2)}</strong>
              <span className={medicine.prescriptionRequired ? 'prescription-badge required' : 'prescription-badge'}>
                {medicine.prescriptionRequired ? 'Prescription required' : 'No prescription required'}
              </span>
              <span className="stock-badge">{medicine.stockQuantity} units available</span>
            </div>
            <div className="quantity-section">
              <span>Quantity</span>
              <div className="quantity-control">
                <button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                <strong>{quantity}</strong>
                <button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(medicine.stockQuantity, quantity + 1))}>+</button>
              </div>
            </div>
            <div className="total-box"><strong>Total: LKR {(medicine.price * quantity).toFixed(2)}</strong></div>
            <button onClick={continueToNextStep} className="primary-action details-action">
              {medicine.prescriptionRequired ? 'Continue to prescription upload' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
