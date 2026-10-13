import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { reportingPeriod, loadMedicineReport, loadAppointmentReport } from '../services/adminReportService';
import { money } from '../components/dashboard/DashboardSectionState';
import ReportChart from '../components/dashboard/ReportChart';
import '../styles/role-dashboard.css';

const medicineSeries = [{ key: 'income', label: 'Income', color: '#dc2626' }, { key: 'buyingCost', label: 'Known buying cost', color: '#64748b' }, { key: 'profit', label: 'Estimated gross profit', color: '#15803d' }];
const consultationSeries = [{ key: 'amount', label: 'Consultation fees collected', color: '#dc2626' }];
const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const cash = value => value === null ? 'Unavailable' : money(value);
function ReportSection({ title, state, retry, children, retryLabel }) {
  return <section className="dashboard-section" aria-label={title}><h2>{title}</h2>
    {state?.loading !== false ? <p role="status">Loading report…</p> : state.error ? <div role="alert" className="management-alert error"><p>{state.error}</p>
      <button className="btn btn-secondary" onClick={retry} aria-label={retryLabel}>Retry</button></div> : children}
  </section>;
}
export default function AdminReportsPage() {
  const { user, role, token, isAuthenticated } = useAuth();
  const scope = (user?.role ?? role) === 'Admin' && token && isAuthenticated !== false ? `${user?.userId ?? user?.id ?? ''}:${token}` : '';
  const [draft, setDraft] = useState(() => ({ kind: 'monthly', date: today() }));
  const [filter, setFilter] = useState(draft);
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', sections: {}, accessDenied: false });
  const period = reportingPeriod(filter.kind, filter.date);
  const key = `${scope}:${period.from}:${period.to}:${revision}`;
  useEffect(() => {
    if (!scope) return;
    let active = true;
    setState({ key, sections: {}, accessDenied: false });
    for (const [name, loader] of [['medicine', loadMedicineReport], ['appointments', loadAppointmentReport]]) {
      loader(reportingPeriod(filter.kind, filter.date)).then(data => {
        if (active) setState(previous => previous.key === key ? { ...previous, sections: { ...previous.sections, [name]: { loading: false, data } } } : previous);
      }).catch(error => {
        if (!active) return;
        if ([401, 403].includes(error?.response?.status)) {
          active = false; setState({ key, sections: {}, accessDenied: true });
        } else setState(previous => previous.key === key ? { ...previous, sections: { ...previous.sections, [name]: { loading: false,
          error: `${name === 'medicine' ? 'Medicine' : 'Consultation fee'} report could not be loaded. Please retry.` } } } : previous);
      });
    }
    return () => { active = false; };
  }, [key, scope, filter]);
  const current = state.key === key ? state : { sections: {} };
  const medicine = current.sections.medicine?.data;
  const appointment = current.sections.appointments?.data;
  const refresh = () => setRevision(value => value + 1);
  return <DashboardLayout>
    <div className="welcome-banner"><h1>Financial Reports</h1><p>Medicine income and estimated gross profit, with consultation fees reported separately.</p></div>
    {!scope || current.accessDenied ? <p role="alert" className="alert alert-error">Access denied. Please sign in with an authorized Admin account.</p> : <>
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}><form style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }} onSubmit={event => {
        event.preventDefault(); try { reportingPeriod(draft.kind, draft.date); setValidation(''); setFilter({ ...draft }); } catch (error) { setValidation(error.message); }
      }}>
        <div className="form-group"><label htmlFor="report-period">Period</label><select className="form-select" id="report-period" value={draft.kind} onChange={event => setDraft(value => ({ ...value, kind: event.target.value }))}>
          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        <div className="form-group"><label htmlFor="report-date">Date within the period</label><input className="form-input" id="report-date" type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={event => setDraft(value => ({ ...value, date: event.target.value }))} /></div>
        <button className="btn btn-primary" type="submit">Apply filters</button><button className="btn btn-secondary" type="button" onClick={refresh}>Refresh reports</button>
      </form>{validation && <p role="alert">{validation}</p>}<p>Showing {period.label} · Sri Lanka time · LKR. Weeks run Monday to Sunday.</p></div>
      <ReportSection title="Medicine income and estimated profit" state={current.sections.medicine} retry={refresh} retryLabel="Retry medicine report">
        {medicine && <>
          <dl className="role-dashboard-income"><div><dt>Paid medicine income</dt><dd>{money(medicine.income)}</dd></div><div><dt>Known buying cost</dt><dd>{money(medicine.buyingCost)}</dd></div><div><dt>Estimated gross profit</dt><dd>{cash(medicine.profit)}</dd></div></dl>
          <p>Buying cost covers medicines allocated to paid orders, using their batches’ current purchase prices. Editing a batch price can change past estimates. Other expenses and refunds are not deducted.</p>
          {medicine.missingCostCount > 0 && <p role="status" className="management-alert error">{medicine.missingCostCount} paid orders have missing or unverifiable costs, or returned stock. Known buying cost is incomplete; total profit is unavailable.</p>}
          {medicine.undatedSuccessfulCount > 0 && <p role="status">{medicine.undatedSuccessfulCount} successful medicine payments have no confirmed date and are excluded from period reports.</p>}
          <ReportChart days={medicine.days} series={medicineSeries} title="Medicine income, buying cost and estimated profit chart" />
          <details><summary>View daily medicine breakdown</summary><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Date</th><th>Income</th><th>Known buying cost</th><th>Estimated gross profit</th></tr></thead><tbody>{medicine.days.map(day => <tr key={day.date}><td>{day.date}</td><td>{money(day.income)}</td><td>{money(day.buyingCost)}</td><td>{cash(day.profit)}</td></tr>)}</tbody></table></div></details>
        </>}
      </ReportSection>
      <ReportSection title="Consultation fees collected" state={current.sections.appointments} retry={refresh} retryLabel="Retry consultation fee report">
        {appointment && <>
          <dl className="role-dashboard-income"><div><dt>Total consultation fees collected</dt><dd>{money(appointment.income)}</dd></div><div><dt>Successful payments</dt><dd>{appointment.count}</dd></div></dl>
          <p>These are gross consultation fees collected. The pharmacy profit cannot be calculated because the pharmacy’s share is unknown. Payments awaiting reconciliation are excluded.</p>
          {appointment.undatedSuccessfulCount > 0 && <p role="status">{appointment.undatedSuccessfulCount} successful appointment payments have no confirmed date and are excluded from period reports.</p>}
          <ReportChart days={appointment.days} series={consultationSeries} title="Total consultation fees collected chart" />
          <details><summary>View daily consultation breakdown</summary><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Date</th><th>Fees collected</th><th>Payments</th></tr></thead><tbody>{appointment.days.map(day => <tr key={day.date}><td>{day.date}</td><td>{money(day.amount)}</td><td>{day.count}</td></tr>)}</tbody></table></div></details>
        </>}
      </ReportSection>
    </>}
  </DashboardLayout>;
}
