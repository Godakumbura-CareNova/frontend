import React, { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { listContactInquiries, markInquiryReviewed } from '../services/pharmacyInformationService';
import './pharmacyInformation.css';
export default function AdminContactInquiriesPage() {
  const [result, setResult] = useState(null), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [pending, setPending] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setResult(await listContactInquiries(page)); }
    catch { setError('Unable to load contact inquiries. Please try again.'); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);
  const review = async id => {
    if (pending) return; setPending(id); setError('');
    try { const saved = await markInquiryReviewed(id); setResult(current => ({ ...current, items: current.items.map(item => item.id === id ? saved : item) })); }
    catch { setError('Unable to mark this inquiry reviewed. Please try again.'); }
    finally { setPending(null); }
  };
  return <DashboardLayout><div className="pharmacy-info-page"><header className="welcome-banner"><h1>Contact <span className="welcome-name">Inquiries</span></h1><p>Review messages submitted through the public contact form.</p></header>
    {loading && <p role="status">Loading inquiries…</p>}
    {error && <div role="alert" className="management-alert error">{error}<button type="button" className="secondary-action" onClick={load}>Retry</button></div>}
    {!loading && result && <section className="management-card"><h2>Received inquiries</h2>{result.items.length === 0 ? <p className="empty-state">No inquiries have been received yet.</p> : result.items.map(inquiry => <details className="pharmacy-inquiry" key={inquiry.id}><summary>{inquiry.subject} — {inquiry.reviewedAtUtc ? 'Reviewed' : 'New'}</summary><p>From: {inquiry.name}</p><p><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>{inquiry.phone && <> · {inquiry.phone}</>}</p><p>Received: {new Date(inquiry.submittedAtUtc).toLocaleString()}</p><p className="pharmacy-preserve-lines">{inquiry.message}</p>{!inquiry.reviewedAtUtc && <div className="management-actions"><button className="primary-action" disabled={Boolean(pending)} onClick={() => review(inquiry.id)}>{pending === inquiry.id ? 'Saving…' : 'Mark reviewed'}</button></div>}</details>)}
      <div className="management-actions"><button className="secondary-action" disabled={page <= 1 || Boolean(pending)} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {result.totalPages || 1}</span><button className="secondary-action" disabled={page >= result.totalPages || Boolean(pending)} onClick={() => setPage(page + 1)}>Next</button></div>
    </section>}
  </div></DashboardLayout>;
}
