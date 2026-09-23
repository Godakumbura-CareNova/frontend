import React, { useEffect, useState } from 'react';
import { resolveApiBaseUrl } from '../../utils/apiBaseUrl';

export const doctorInitials = (fullName) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Dr';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
};

// Pictures are static files on the user-auth service (the same host as VITE_API_BASE_URL, minus the /api
// suffix), the same way medicine images come from the pharmacy host. The doctor-payment service only
// stores which file belongs to which doctor, so no doctor-payment endpoint serves image bytes.
const authHost = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL).replace(/\/api$/, '');

/** Absolute URL for a stored picture path ("/uploads/profile-pictures/x.jpg"), or null when there is none. */
export const doctorPictureUrl = (picturePath) => {
  const path = (picturePath || '').trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${authHost}${path.startsWith('/') ? '' : '/'}${path}`;
};

/**
 * Doctor picture used wherever a doctor is shown to patients. `picturePath` is the path the doctor-payment
 * service snapshotted from user-auth; an initials tile is shown when there is none or the file cannot load.
 */
const DoctorAvatar = ({ picturePath, fullName, size = 'md' }) => {
  const src = doctorPictureUrl(picturePath);
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
