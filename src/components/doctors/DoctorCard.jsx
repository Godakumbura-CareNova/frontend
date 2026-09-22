import React from 'react';
import { BadgeCheck, Briefcase, ChevronRight, GraduationCap } from 'lucide-react';
import AvailabilityBadge from './AvailabilityBadge';
import DoctorAvatar from './DoctorAvatar';

export const displayDoctorName = (fullName) => {
  const name = (fullName || '').trim();
  return name ? `Dr. ${name}` : 'Doctor';
};

const yearsLabel = (years) => {
  if (years === null || years === undefined) return null;
  if (years < 1) return 'Under a year of experience';
  return `${years} year${years === 1 ? '' : 's'} of experience`;
};

/** One doctor in the search results. `onSelect` receives the doctor id. */
const DoctorCard = ({ doctor, onSelect }) => {
  const name = displayDoctorName(doctor.fullName);
  const experience = yearsLabel(doctor.yearsOfExperience);
  const degrees = doctor.qualifications ?? [];

  return (
    <article className="pd-card" aria-label={name}>
      <header className="pd-card-head">
        <DoctorAvatar doctorId={doctor.doctorId} fullName={doctor.fullName} />
        <div className="pd-card-identity">
          <h2 className="pd-card-name">{name}</h2>
          <span className="pd-card-spec">{doctor.specialization}</span>
        </div>
      </header>

      <div className="pd-card-body">
        <span className="pd-card-meta">
          <BadgeCheck size={14} aria-hidden="true" /> Reg. No. {doctor.registrationNumber}
        </span>
        {experience && (
          <span className="pd-card-meta">
            <Briefcase size={14} aria-hidden="true" /> {experience}
          </span>
        )}
        {degrees.length > 0 && (
          <span className="pd-card-meta pd-card-degrees">
            <GraduationCap size={14} aria-hidden="true" />
            <span className="pd-degree-list">
              {degrees.map((degree, index) => (
                <span key={`${degree}-${index}`} className="pd-degree">{degree}</span>
              ))}
            </span>
          </span>
        )}
        {doctor.biography && <p className="pd-card-bio">{doctor.biography}</p>}
      </div>

      <footer className="pd-card-foot">
        <AvailabilityBadge availability={doctor.availability} />
        <button type="button" className="pd-view-btn" onClick={() => onSelect(doctor.doctorId)}>
          View Profile <ChevronRight size={15} aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
};

export default DoctorCard;
