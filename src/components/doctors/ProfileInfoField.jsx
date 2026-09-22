import React from 'react';

/** Icon + small label + value tile used in the Basic Information grid. */
const ProfileInfoField = ({ icon: Icon, label, value, wide = false }) => (
  <div className={`dp-info-field${wide ? ' dp-info-field-wide' : ''}`}>
    <span className="dp-info-icon" aria-hidden="true">
      <Icon size={14} />
    </span>
    <div className="dp-info-text">
      <span className="dp-info-label">{label}</span>
      <span className="dp-info-value">{value}</span>
    </div>
  </div>
);

export default ProfileInfoField;
