import React from 'react';

/**
 * Bordered card section with the tinted header band used across the doctor profile page.
 * `tone` switches the accent between the green default and the red specialization band.
 */
const ProfileSection = ({ icon: Icon, title, tone = 'green', action = null, children }) => (
  <section className={`dp-section dp-section-${tone}`} aria-label={title}>
    <header className="dp-section-header">
      <span className="dp-section-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <h2 className="dp-section-title">{title}</h2>
      {action && <div className="dp-section-action">{action}</div>}
    </header>
    <div className="dp-section-body">{children}</div>
  </section>
);

export default ProfileSection;
