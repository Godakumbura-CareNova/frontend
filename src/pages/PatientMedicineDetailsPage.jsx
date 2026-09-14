import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { catalogueApi } from '../api/catalogueApi';
import { cartApi } from '../api/cartApi';
import './patientMedicineDetails.css';

const pharmacyHost = (import.meta.env.VITE_PHARMACY_API_BASE_URL || 'http://localhost:5134/api').replace(/\/api$/, '');

export default function PatientMedicineDetailsPage() {
  const { medicineId } = useParams();
  const navigate = useNavigate();
  const [medicine, setMedicine] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    catalogueApi.getMedicine(medicineId)
      .then((response) => setMedicine(response.data))
      .catch(() => setError('This medicine is unavailable.'));
  }, [medicineId]);

  const backLink = <Link className="medicine-back-link" to="/patient/medicines"><span aria-hidden="true">←</span> Back to medicines</Link>;
  if (error) return <DashboardLayout><section className="medicine-details-page">{backLink}<div className="management-alert error">{error}</div></section></DashboardLayout>;
  if (!medicine) return <DashboardLayout><section className="medicine-details-page">{backLink}<p>Loading medicine...</p></section></DashboardLayout>;

  const imageUrl = medicine.imagePath
    ? `${pharmacyHost}${medicine.imagePath.startsWith('/') ? '' : '/'}${medicine.imagePath}`
    : null;

  const continueToNextStep = async () => {
    if (medicine.prescriptionRequired) {
      sessionStorage.setItem('carenova.pendingCartItem', JSON.stringify({
        medicineId: medicine.id,
        quantity,
        prescriptionRequired: true,
      }));
      navigate('/patient/prescriptions/upload');
      return;
    }

    setAdding(true);
    setMessage('');
    try {
      await cartApi.addItem({ medicineId: medicine.id, quantity });
      setMessage('Added to your cart.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to add this medicine to your cart.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="medicine-details-page">
        {backLink}
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
            <div className="total-box"><strong className="total-price">Total: LKR {(medicine.price * quantity).toFixed(2)}</strong></div>
            {message && <div className="management-alert success">{message}</div>}
            <button onClick={continueToNextStep} disabled={adding} className={`primary-action details-action ${medicine.prescriptionRequired ? '' : 'details-add-to-cart'}`}>
              {medicine.prescriptionRequired ? 'Continue to prescription upload' : <>{!adding && <ShoppingCart size={19} />} {adding ? 'Adding to cart...' : 'Add to Cart'}</>}
            </button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
