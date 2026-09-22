import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, RefreshCw, Search, SearchX, Stethoscope, X } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import DoctorCard from '../components/doctors/DoctorCard';
import { getDoctorSpecializations, searchDoctors } from '../services/doctorService';
import { DOCTOR_SEARCH_MAX_LENGTH, validateDoctorSearchCriteria } from '../utils/doctorValidation';
import './doctorProfile.css';
import './patientDoctors.css';

const PAGE_SIZE = 12;
const EMPTY_CRITERIA = { search: '', specialization: '', availableOnly: false };

const describeLoadError = (error) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (status === 400) {
    // The backend validator disagreed with us; show its field messages rather than a generic failure.
    const serverErrors = error?.response?.data?.errors || {};
    const fieldErrors = Object.fromEntries(
      Object.entries(serverErrors).map(([field, messages]) => [field.charAt(0).toLowerCase() + field.slice(1), [].concat(messages)[0]]),
    );
    return { message: serverMessage || 'Please check your search criteria.', fieldErrors, retryable: false };
  }
  if (status === 401 || status === 403) {
    return { message: 'You are not authorized to search for doctors.', fieldErrors: {}, retryable: false };
  }
  if (!error?.response) {
    return { message: 'We could not reach the doctor directory. Check your connection and try again.', fieldErrors: {}, retryable: true };
  }
  return { message: serverMessage || 'Doctor information could not be loaded right now.', fieldErrors: {}, retryable: true };
};

const hasCriteria = (criteria) => Boolean(criteria.search.trim() || criteria.specialization || criteria.availableOnly);

const PatientDoctorSearchPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_CRITERIA);
  const [errors, setErrors] = useState({});
  const [specializations, setSpecializations] = useState([]);

  // What the current results were fetched with; only changes on a valid submit, clear or page change.
  const [applied, setApplied] = useState({ ...EMPTY_CRITERIA, page: 1 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    getDoctorSpecializations()
      .then((list) => { if (active) setSpecializations(Array.isArray(list) ? list : []); })
      .catch(() => { /* The dropdown is a convenience; free-text search still works without it. */ });
    return () => { active = false; };
  }, []);

  const runSearch = useCallback(async (criteria) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await searchDoctors({
        search: criteria.search.trim(),
        specialization: criteria.specialization,
        availableOnly: criteria.availableOnly,
        page: criteria.page,
        pageSize: PAGE_SIZE,
      });
      setResult(data);
    } catch (error) {
      const described = describeLoadError(error);
      if (Object.keys(described.fieldErrors).length > 0) setErrors(described.fieldErrors);
      setResult(null);
      setLoadError(described);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(applied);
  }, [applied, runSearch]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateDoctorSearchCriteria(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setApplied({ ...form, search: form.search.trim(), page: 1 });
  };

  const clearSearch = () => {
    setForm(EMPTY_CRITERIA);
    setErrors({});
    setApplied({ ...EMPTY_CRITERIA, page: 1 });
  };

  const goToPage = (page) => setApplied((current) => ({ ...current, page }));

  const items = result?.items ?? [];
  const totalCount = result?.totalCount ?? 0;
  const totalPages = result?.totalPages ?? 0;
  const page = result?.page ?? applied.page;
  const filtered = hasCriteria(applied);

  const summary = () => {
    if (totalCount === 0) return null;
    const noun = totalCount === 1 ? 'doctor' : 'doctors';
    const parts = [];
    if (applied.search) parts.push(`matching "${applied.search}"`);
    if (applied.specialization) parts.push(`in ${applied.specialization}`);
    if (applied.availableOnly) parts.push('with open slots');
    return `${totalCount} ${noun} ${parts.length ? parts.join(' ') : 'available to consult'}`;
  };

  return (
    <DashboardLayout>
      <div className="dp-page pd-page">
        <header className="dp-hero pd-hero">
          <span className="pd-hero-icon" aria-hidden="true"><Stethoscope size={30} /></span>
          <div className="dp-hero-text">
            <h1 className="dp-hero-title">Find a Doctor</h1>
            <p className="dp-hero-subtitle">Search by name or specialization and see who has open consultation slots.</p>
          </div>
          <svg className="dp-hero-pulse" viewBox="0 0 160 60" aria-hidden="true">
            <path d="M0 30h32l10-18 14 38 12-30 10 18h20l8-12 10 18 8-14h36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M138 4v10M133 9h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </header>

        <form className="pd-search-card" onSubmit={handleSubmit} noValidate aria-label="Doctor search">
          <div className="pd-search-grid">
            <div className="pd-field pd-field-search">
              <label className="form-label" htmlFor="doctor-search">Name or specialization</label>
              <div className={`pd-input-wrap${errors.search ? ' has-error' : ''}`}>
                <Search size={16} aria-hidden="true" />
                <input
                  id="doctor-search"
                  name="search"
                  className="pd-input"
                  value={form.search}
                  onChange={handleChange}
                  placeholder="e.g. Perera or Cardiologist"
                  maxLength={DOCTOR_SEARCH_MAX_LENGTH}
                  autoComplete="off"
                />
              </div>
              {errors.search && <span className="field-error" role="alert">{errors.search}</span>}
            </div>

            <div className="pd-field">
              <label className="form-label" htmlFor="doctor-specialization">Specialization</label>
              <select
                id="doctor-specialization"
                name="specialization"
                className={`form-select pd-select${errors.specialization ? ' has-error' : ''}`}
                value={form.specialization}
                onChange={handleChange}
              >
                <option value="">All specializations</option>
                {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {errors.specialization && <span className="field-error" role="alert">{errors.specialization}</span>}
            </div>

            <label className="pd-toggle" htmlFor="doctor-available-only">
              <input id="doctor-available-only" name="availableOnly" type="checkbox" checked={form.availableOnly} onChange={handleChange} />
              <CalendarCheck2 size={15} aria-hidden="true" /> Open slots only
            </label>

            <div className="pd-search-actions">
              <button type="submit" className="btn btn-green pd-search-btn" disabled={loading}>
                <Search size={16} /> Search
              </button>
              {(hasCriteria(form) || filtered) && (
                <button type="button" className="pd-clear-btn" onClick={clearSearch} disabled={loading}>
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          </div>
        </form>

        <section className="pd-results" aria-live="polite" aria-busy={loading}>
          {loadError && (
            <div className="alert alert-error pd-alert" role="alert">
              <span>{loadError.message}</span>
              {loadError.retryable && (
                <button type="button" className="dp-retry-btn" onClick={() => runSearch(applied)} disabled={loading}>
                  <RefreshCw size={13} /> Retry
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="pd-grid" aria-label="Loading doctors">
              {[0, 1, 2].map((index) => (
                <div key={index} className="pd-card pd-card-skeleton" aria-hidden="true">
                  <div className="pd-skeleton pd-skeleton-avatar" />
                  <div className="pd-skeleton pd-skeleton-line" />
                  <div className="pd-skeleton pd-skeleton-line pd-skeleton-short" />
                  <div className="pd-skeleton pd-skeleton-block" />
                </div>
              ))}
              <p className="pd-loading-text">Loading doctors...</p>
            </div>
          ) : !loadError && items.length === 0 ? (
            <div className="pd-empty" role="status">
              <span className="pd-empty-icon"><SearchX size={26} /></span>
              <h2>No doctors found</h2>
              <p>
                {filtered
                  ? 'No doctors match your search. Try a different name or specialization, or remove the open-slots filter.'
                  : 'No doctors have published a profile yet. Please check back soon.'}
              </p>
              {filtered && (
                <button type="button" className="btn btn-green" onClick={clearSearch}>Show all doctors</button>
              )}
            </div>
          ) : !loadError && (
            <>
              <div className="pd-results-head">
                <h2 className="pd-results-title">{summary()}</h2>
                {totalPages > 1 && <span className="pd-results-page">Page {page} of {totalPages}</span>}
              </div>
              <div className="pd-grid">
                {items.map((doctor) => (
                  <DoctorCard key={doctor.doctorId} doctor={doctor} onSelect={(doctorId) => navigate(`/patient/doctors/${doctorId}`)} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="pd-pagination" aria-label="Results pages">
                  <button type="button" className="pd-page-btn" onClick={() => goToPage(page - 1)} disabled={page <= 1}>Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" className="pd-page-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Next</button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default PatientDoctorSearchPage;
