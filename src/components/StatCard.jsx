import React from 'react';

const StatCard = ({ icon: Icon, title, value = '—' }) => (
  <div className="stat-card">
    <div className="stat-card-icon">
      <Icon size={20} />
    </div>
    <div className="stat-card-title">{title}</div>
    <div className="stat-card-value">{value}</div>
  </div>
);

export default StatCard;
