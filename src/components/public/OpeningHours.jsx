import React from 'react';
export default function OpeningHours({ hours = [] }) {
  return <section className="management-card"><h2>Opening hours</h2>{hours.length ? <dl className="pharmacy-hours">{hours.map(row => <div key={row.day}><dt>{row.day}</dt><dd>{row.hours}</dd></div>)}</dl> : <p className="empty-state">Opening hours have not been published yet.</p>}</section>;
}
