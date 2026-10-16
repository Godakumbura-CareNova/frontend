import React from 'react';
import { Link } from 'react-router-dom';
import { Pill, Stethoscope } from 'lucide-react';
export function PublicCards({ kind, items = [], showArrow = true }) {
  if (!items.length) return <p>No {kind} are available to display yet.</p>;
  const Icon = kind === 'medicines' ? Pill : Stethoscope;
  return <div className="quicklink-row">{items.map(item => <Link className="quicklink-card" key={item.id || item.doctorId} to={`/patient/${kind}/${encodeURIComponent(item.id || item.doctorId)}`}>
    <div>
      <h3 className="quicklink-card-title">{item.name || item.fullName}</h3>
      <p className="quicklink-card-subtitle">{item.categoryName || item.specialization}</p>
      {item.price != null && <strong>LKR {Number(item.price).toFixed(2)}</strong>}
      {item.consultationFee != null && <strong>Consultation: LKR {Number(item.consultationFee).toFixed(2)}</strong>}
      <p className="quicklink-card-subtitle">{item.availabilityStatus}</p>
      {item.prescriptionRequired && <small>Prescription required</small>}
      <p className="quicklink-card-subtitle">View details{showArrow && ' →'}</p>
    </div>
    <div className="quicklink-card-icon" style={{ background: 'var(--red-soft)', color: 'var(--red-strong)' }}><Icon size={20} /></div>
  </Link>)}</div>;
}
