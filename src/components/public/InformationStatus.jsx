import React from 'react';
export default function InformationStatus({ loading, error, reload }) {
  if (loading) return <p role="status">Loading pharmacy information…</p>;
  if (!error) return null;
  return <div className="management-alert error" role="alert">{error} <button type="button" className="secondary-action" onClick={reload}>Retry</button></div>;
}
