import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({ icon: Icon, title, value = '—', to }) => {
  const Component = to ? (to.startsWith('#') ? 'a' : Link) : 'div';
  const navigation = to ? (to.startsWith('#') ? { href: to } : { to }) : {};
  return (
    <Component className={`stat-card${to ? ' stat-card-link' : ''}`} {...navigation}>
      <div className="stat-card-icon">
        <Icon size={20} />
      </div>
      <div className="stat-card-title">{title}</div>
      <div className="stat-card-value">{value}</div>
    </Component>
  );
};

export default StatCard;
