import React, { useEffect, useState } from 'react';
import { resolveApiBaseUrl } from '../../utils/apiBaseUrl';

export const doctorInitials = (fullName) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Dr';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
};

// Pictures are served by the user-auth service (the same host as VITE_API_BASE_URL, minus the /api suffix),
// the same way medicine images come from the pharmacy host.
const authHost = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL).replace(/\/api$/, '');

export const doctorPictureUrl = (doctorId) => (doctorId ? `${authHost}/api/doctors/${encodeURIComponent(doctorId)}/picture` : null);

/**
 * Doctor picture used wherever a doctor is shown to patients. Loads the picture by doctor id and
 * falls back to an initials tile when the doctor has not uploaded one (the endpoint answers 404).
 */
const DoctorAvatar = ({ doctorId, fullName, size = 'md' }) => {
  const src = doctorPictureUrl(doctorId);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={fullName ? `Dr. ${fullName}` : 'Doctor'}
        className={`pd-avatar pd-avatar-${size} pd-avatar-img`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`pd-avatar pd-avatar-${size}`} aria-hidden="true">
      {doctorInitials(fullName)}
    </span>
  );
};

export default DoctorAvatar;
