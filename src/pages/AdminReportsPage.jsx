import React, { useEffect, useState } from 'react';
import { BarChart3, Pill, Stethoscope, RefreshCw, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { reportingPeriod, loadMedicineReport, loadAppointmentReport } from '../services/adminReportService';
import { money } from '../components/dashboard/DashboardSectionState';
import ReportChart from '../components/dashboard/ReportChart';
import './AdminReportsPage.css';

const medicineSeries = [{ key: 'income', label: 'Income', color: '#dc2626' }, { key: 'buyingCost', label: 'Known buying cost', color: '#64748b' }, { key: 'profit', label: 'Estimated gross profit', color: '#15803d' }];
const consultationSeries = [{ key: 'amount', label: 'Consultation fees collected', color: '#dc2626' }];
const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const cash = value => value === null ? 'Unavailable' : money(value);
function ReportSection({ title, state, retry, children, retryLabel }) {
  return <section className="admin-report-section" aria-label={title}>
    {state?.loading !== false ? <p className="admin-report-state" role="status">Loading report…</p> : state.error ? <div role="alert" className="admin-report-error"><p>{state.error}</p>
      <button type="button" onClick={retry} aria-label={retryLabel}>Retry</button></div> : children}
  </section>;
}
function FinancialReport({ medicine, data }) {
  return <>
    <div className="admin-report-overview">
      <section className="admin-report-chart" aria-label={medicine ? 'Medicine performance' : 'Consultation performance'}>
        <h2>{medicine ? 'Medicine performance' : 'Consultation fees collected'}</h2>
        <p className="admin-report-caption">{medicine ? 'Daily income, buying cost and estimated profit' : 'Daily confirmed consultation fees collected'}</p>
        <ReportChart days={data.days} series={medicine ? medicineSeries : consultationSeries} title={medicine ? 'Medicine income, buying cost and estimated profit chart' : 'Total consultation fees collected chart'} />
      </section>
      <aside className="admin-report-summary" aria-label="Period summary"><h2>Period summary</h2>
        <dl><div className="admin-report-income"><dt>{medicine ? 'Paid medicine income' : 'Total consultation fees collected'}</dt><dd>{money(data.income)}</dd></div>
          {medicine ? <><div className="admin-report-cost"><dt>Known buying cost</dt><dd>{money(data.buyingCost)}</dd></div><div className="admin-report-profit"><dt><CheckCircle2 size={18} aria-hidden="true" />Estimated gross profit</dt><dd>{cash(data.profit)}</dd></div></>
            : <div className="admin-report-cost"><dt>Successful payments</dt><dd>{data.count}</dd></div>}
        </dl>
        {medicine && <p className="admin-report-caption">Before other expenses and refunds.</p>}
        {medicine && data.missingCostCount > 0 && <p role="status" className="admin-report-cost-note">{data.missingCostCount} paid orders have missing or unverifiable costs, or returned stock. Known buying cost is incomplete; total profit is unavailable.</p>}
      </aside>
    </div>
    <section className="admin-report-breakdown" aria-label={medicine ? 'Daily medicine breakdown' : 'Daily consultation breakdown'}>
      <header><h2>{medicine ? 'Daily medicine breakdown' : 'Daily consultation breakdown'}</h2><span>{data.days.length} {data.days.length === 1 ? 'day' : 'days'} in this period</span></header>
      <div className="admin-report-table-scroll" tabIndex={0} role="region" aria-label="Daily report table"><table><thead><tr><th scope="col">Date</th><th scope="col">{medicine ? 'Income (LKR)' : 'Fees collected (LKR)'}</th>{medicine ? <><th scope="col">Known buying cost (LKR)</th><th scope="col">Estimated gross profit (LKR)</th></> : <th scope="col">Payments</th>}</tr></thead>
        <tbody>{data.days.map(day => <tr key={day.date}><td>{day.date}</td><td>{money(medicine ? day.income : day.amount)}</td>{medicine ? <><td>{money(day.buyingCost)}</td><td className={day.profit > 0 ? 'admin-report-positive' : ''}>{cash(day.profit)}</td></> : <td>{day.count}</td>}</tr>)}</tbody></table></div>
      <p className="admin-report-caption">All days are included, including days with no payments.</p>
    </section>
  </>;
}
export default function AdminReportsPage() {
  const { user, role, token, isAuthenticated } = useAuth();
  const scope = (user?.role ?? role) === 'Admin' && token && isAuthenticated !== false ? `${user?.userId ?? user?.id ?? ''}:${token}` : '';
  const [draft, setDraft] = useState(() => ({ kind: 'monthly', date: today() }));
  const [filter, setFilter] = useState(draft);
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const [activeReport, setActiveReport] = useState('medicine');
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
  const report = current.sections[activeReport];
  const isMedicine = activeReport === 'medicine';
  const refresh = () => setRevision(value => value + 1);
  const switchReport = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'medicine' : event.key === 'End' ? 'appointments' : isMedicine ? 'appointments' : 'medicine';
    setActiveReport(next); document.getElementById(`report-tab-${next}`)?.focus();
  };
  return <DashboardLayout><div className="admin-reports">
    <header className="admin-reports-heading"><div><h1><BarChart3 size={30} aria-hidden="true" />Financial Reports</h1><p>Track medicine income and consultation fees.</p></div><span className="admin-report-period-label">{period.label}</span></header>
    {!scope || current.accessDenied ? <p role="alert" className="admin-report-error">Access denied. Please sign in with an authorized Admin account.</p> : <>
      <div className="admin-report-tabs" role="tablist" aria-label="Financial report type" onKeyDown={switchReport}>
        {[['medicine', 'Medicine report', Pill], ['appointments', 'Consultation report', Stethoscope]].map(([value, label, Icon]) => <button type="button" role="tab" id={`report-tab-${value}`} key={value} aria-selected={activeReport === value} aria-controls="active-report-panel" tabIndex={activeReport === value ? 0 : -1} onClick={() => setActiveReport(value)}><Icon size={21} aria-hidden="true" />{label}</button>)}
      </div>
      <section className="admin-report-filters" aria-label="Report filters"><form noValidate onSubmit={event => {
        event.preventDefault(); try { reportingPeriod(draft.kind, draft.date); setValidation(''); setFilter({ ...draft }); } catch (error) { setValidation(error.message); document.getElementById('report-date')?.focus(); }
      }}>
        <div><label htmlFor="report-period">Period</label><select id="report-period" value={draft.kind} onChange={event => setDraft(value => ({ ...value, kind: event.target.value }))}>
          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        <div><label htmlFor="report-date">Date within the period</label><input id="report-date" type="date" required min="2000-01-01" max="2100-12-31" aria-invalid={Boolean(validation)} aria-describedby={validation ? 'report-date-error' : undefined} value={draft.date} onChange={event => setDraft(value => ({ ...value, date: event.target.value }))} /></div>
        <button className="admin-report-apply" type="submit">Apply filters</button><button className="admin-report-refresh" type="button" onClick={refresh}><RefreshCw size={18} aria-hidden="true" />Refresh reports</button>
      </form>{validation && <p id="report-date-error" role="alert" className="admin-report-validation">{validation}</p>}<p className="admin-report-caption">Showing {period.label} · Sri Lanka time · LKR. Weeks run Monday to Sunday.</p></section>
      <div role="tabpanel" id="active-report-panel" aria-labelledby={`report-tab-${activeReport}`}>
        <ReportSection title={isMedicine ? 'Medicine income and estimated profit' : 'Consultation fees collected'} state={report} retry={refresh} retryLabel={isMedicine ? 'Retry medicine report' : 'Retry consultation fee report'}>
          {report?.data && <FinancialReport medicine={isMedicine} data={report.data} />}
        </ReportSection>
      </div>
    </>}
  </div></DashboardLayout>;
}
