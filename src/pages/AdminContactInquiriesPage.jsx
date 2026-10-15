import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Search, X, Phone, CheckCircle2, Inbox } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { listContactInquiries, markInquiryReviewed } from '../services/pharmacyInformationService';
import './AdminContactInquiriesPage.css';

const receivedDate = value => new Date(value).toLocaleString('en-LK', {
  timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

export default function AdminContactInquiriesPage() {
  const [result, setResult] = useState(null), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [pending, setPending] = useState(null), [reviewError, setReviewError] = useState('');
  const [selectedId, setSelectedId] = useState(null), [filter, setFilter] = useState('all'), [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const requestVersion = useRef(0), saving = useRef(false), searchInput = useRef(null);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError(''); setReviewError(''); setFeedback('');
    try {
      const data = await listContactInquiries(page);
      if (version === requestVersion.current) { setResult(data); setSelectedId(null); }
    } catch {
      if (version === requestVersion.current) setError('Unable to load contact inquiries. Please try again.');
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [page]);
  useEffect(() => { load(); return () => { requestVersion.current += 1; }; }, [load]);
  const items = result?.items ?? [];
  const visible = items.filter(item => (filter === 'all' || Boolean(item.reviewedAtUtc) === (filter === 'reviewed'))
    && [item.name, item.subject, item.email, item.message].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const selected = visible.find(item => item.id === selectedId) ?? visible[0];
  const totalPages = result?.totalPages || 1;
  const review = async id => {
    if (saving.current) return;
    saving.current = true; setPending(id); setReviewError(''); setFeedback('');
    try {
      const saved = await markInquiryReviewed(id);
      setResult(current => ({ ...current, items: current.items.map(item => item.id === id ? saved : item) }));
      setFeedback('Inquiry marked as reviewed.');
    } catch { setReviewError('Unable to mark this inquiry reviewed. Please try again.'); }
    finally { saving.current = false; setPending(null); }
  };
  return <DashboardLayout><div className="admin-inquiries">
    <header className="welcome-banner admin-inquiries-header"><Mail size={36} aria-hidden="true" /><div><h1>Contact <span className="welcome-name">Inquiries</span></h1><p>Review messages from your patients and visitors.</p></div></header>
    {feedback && <p className="admin-inquiry-feedback" role="status"><CheckCircle2 size={18} aria-hidden="true" />{feedback}</p>}
    <div className="admin-inquiry-workspace" aria-busy={loading}>
      <section className="admin-inquiry-list-panel" aria-label="Received inquiries">
        <h2>Received inquiries</h2>
        <div className="admin-inquiry-filters" role="group" aria-label="Filter inquiries on this page">
          {[['all', 'All inquiries'], ['new', 'New'], ['reviewed', 'Reviewed']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} disabled={loading || Boolean(pending)} onClick={() => { setFilter(value); setSelectedId(null); }}>{label}</button>)}
        </div>
        <div className="admin-inquiry-search"><Search size={19} aria-hidden="true" /><input ref={searchInput} type="search" aria-label="Search inquiries on this page" placeholder="Search inquiries on this page…" value={query} disabled={loading || Boolean(pending)} onChange={event => { setQuery(event.target.value); setSelectedId(null); }} />{query && <button type="button" aria-label="Clear search" disabled={Boolean(pending)} onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={18} aria-hidden="true" /></button>}</div>
        <p className="admin-inquiry-scope">Search and filters apply to the current page.</p>
        {loading ? <p className="admin-inquiry-placeholder" role="status">Loading inquiries…</p>
          : error ? <div className="admin-inquiry-error" role="alert"><p>{error}</p><button type="button" onClick={load}>Retry</button></div>
            : !items.length ? <p className="admin-inquiry-placeholder">No inquiries have been received yet.</p>
              : !visible.length ? <div className="admin-inquiry-placeholder"><p>No inquiries match your search or filter on this page.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); searchInput.current?.focus(); }}>Clear search and filters</button></div>
                : <ul className="admin-inquiry-list">{visible.map(item => <li key={item.id}><button type="button" className={`admin-inquiry-preview${selected?.id === item.id ? ' is-selected' : ''}`} aria-pressed={selected?.id === item.id} onClick={() => { setSelectedId(item.id); setReviewError(''); }}>
                  <span className={`admin-inquiry-avatar${item.reviewedAtUtc ? ' is-reviewed' : ''}`} aria-hidden="true">{initials(item.name)}</span>
                  <span className="admin-inquiry-preview-copy"><strong>{item.name}</strong><span className="admin-inquiry-subject">{item.subject}</span><span className="admin-inquiry-snippet">{item.message}</span></span>
                  <span className="admin-inquiry-preview-meta"><time dateTime={item.submittedAtUtc}>{receivedDate(item.submittedAtUtc)}</time><span className={`admin-inquiry-badge${item.reviewedAtUtc ? ' is-reviewed' : ''}`}>{item.reviewedAtUtc ? 'Reviewed' : 'New'}</span></span>
                </button></li>)}</ul>}
        <nav className="admin-inquiry-pagination" aria-label="Inquiry pages"><span>Page {page} of {totalPages}</span><div><button type="button" disabled={page <= 1 || loading || Boolean(pending)} onClick={() => setPage(current => current - 1)}>Previous</button><button type="button" disabled={page >= totalPages || loading || Boolean(pending)} onClick={() => setPage(current => current + 1)}>Next</button></div></nav>
      </section>
      <section className="admin-inquiry-detail" aria-label="Inquiry details">
        {!loading && !error && selected ? <>
          <span className="admin-inquiry-eyebrow">Inquiry details</span>
          <div className="admin-inquiry-detail-heading"><h2>{selected.subject}</h2><span className={`admin-inquiry-badge${selected.reviewedAtUtc ? ' is-reviewed' : ''}`}>{selected.reviewedAtUtc ? 'Reviewed' : 'New'}</span></div>
          <div className="admin-inquiry-sender"><span className="admin-inquiry-avatar" aria-hidden="true">{initials(selected.name)}</span><div><strong>{selected.name}</strong><a href={`mailto:${selected.email}`}>{selected.email}</a></div><div className="admin-inquiry-date"><time dateTime={selected.submittedAtUtc}>{receivedDate(selected.submittedAtUtc)}</time><span>Sri Lanka time · Public contact form</span></div></div>
          <div className="admin-inquiry-message"><h3>Message</h3><p>{selected.message}</p></div>
          <section className="admin-inquiry-contact" aria-label="Sender contact information"><h3>Contact information</h3><div><Mail size={21} aria-hidden="true" /><dl><dt>Email address</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd></dl></div>{selected.phone && <div><Phone size={21} aria-hidden="true" /><dl><dt>Phone number</dt><dd><a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}>{selected.phone}</a></dd></dl></div>}</section>
          {reviewError && <p className="admin-inquiry-error" role="alert">{reviewError}</p>}
          <div className="admin-inquiry-review">{selected.reviewedAtUtc ? <p><CheckCircle2 size={18} aria-hidden="true" />Reviewed {receivedDate(selected.reviewedAtUtc)}</p> : <button type="button" disabled={Boolean(pending)} onClick={() => review(selected.id)}><CheckCircle2 size={20} aria-hidden="true" />{pending === selected.id ? 'Saving…' : 'Mark as reviewed'}</button>}</div>
        </> : <div className="admin-inquiry-detail-empty"><Inbox size={48} aria-hidden="true" /><h2>{loading ? 'Loading inquiry details' : 'Select an inquiry'}</h2><p>{loading ? 'Your messages will appear here.' : 'Choose a message from the received inquiries to review its details.'}</p></div>}
      </section>
    </div>
  </div></DashboardLayout>;
}
