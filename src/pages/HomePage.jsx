import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Pill, Stethoscope, Calendar, ShoppingBag, CreditCard, ArrowRight, FileCheck, User } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { PublicCards } from '../components/home/PublicCards';
import VisitorHero from '../components/home/VisitorHero';
import VisitorSections from '../components/home/VisitorSections';
import { getHomeContent } from '../services/publicContentService';
import { useAuth } from '../context/AuthContext';
import { useRoleDashboard } from '../hooks/useRoleDashboard';
import PatientDashboardSections from '../components/dashboard/PatientDashboardSections';
import '../styles/patient-dashboard.css';

// The landing page and patient dashboard share their content and layout.
export default function HomePage() {
  const { user, token } = useAuth();
  const isPatient = !!token && ['Patient', 'User'].includes(user?.role);
  const dashboard = useRoleDashboard('Patient');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getHomeContent().then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const retry = () => setAttempt(value => value + 1);
  return <DashboardLayout>
    <div className={isPatient ? 'patient-dashboard' : 'visitor-home'}>
    {!isPatient && <VisitorHero />}
    {isPatient && <>
    <header className="pd-page-heading">
      <h1>Your care, at a glance</h1>
      <p>{new Date().toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' })}</p>
    </header>
    <section id="dashboard-quick-links" className="pd-hero">
      <Heart className="pd-hero-heart" size={180} strokeWidth={1.2} aria-hidden="true" />
      <h2>Welcome to CareNova</h2>
      <p>Manage your medicines and appointments in one place.</p>
      <h2 className="pd-sr-only">Quick Links</h2>
      <div className="pd-hero-actions">
        <Link to="/patient/medicines" aria-label="Medicines Browse and order medicines"><Pill size={18} aria-hidden="true" />Browse medicines<ArrowRight size={16} aria-hidden="true" /></Link>
        <Link to="/patient/doctors"><Stethoscope size={18} aria-hidden="true" />Find a doctor<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
    <div className="stat-card-grid">
      <StatCard to="/patient/orders" icon={ShoppingBag} title="Recent Medicine Orders" value={isPatient ? dashboard.sections.orders?.data?.totalCount ?? 'Unavailable' : undefined} />
      <StatCard to="/patient/appointments" icon={Calendar} title="Upcoming Appointments" value={isPatient ? dashboard.sections.appointments?.data?.upcomingCount ?? 'Unavailable' : undefined} />
      <StatCard to={isPatient ? '#patient-payment-statuses' : '/login'} icon={CreditCard} title="Payment Statuses" value={isPatient ? 'See summary' : undefined} />
    </div>
    <a className="pd-quick-jump" href="#dashboard-quick-links">Quick Links <ArrowRight size={14} aria-hidden="true" /></a>
    </>}
    {isPatient && <PatientDashboardSections dashboard={dashboard} />}
    {loading && <p role="status">Loading pharmacy information…</p>}
    {error && <section className="dashboard-section management-alert error" role="alert">
      <h2>We couldn’t load the home page information.</h2><p>Please try again.</p><button className="btn btn-primary" onClick={retry}>Retry</button>
    </section>}
    {!isPatient && !loading && !error && data && <VisitorSections data={data} onRetry={retry} />}
    {isPatient && !loading && !error && data && <>
      <section className="dashboard-section pd-discover"><Heart size={36} aria-hidden="true" /><div><h2>Discover <span>CareNova</span></h2><p>{data.introduction}</p></div></section>
      <section className="dashboard-section"><h2>Our services</h2><div className="quicklink-row">
        {data.services?.map((service, index) => { const Icon = [Pill, Stethoscope, User][index % 3]; return <article className="quicklink-card pd-service" key={service.title}><span className="pd-icon"><Icon size={22} aria-hidden="true" /></span><div><h3 className="quicklink-card-title">{service.title}</h3><p className="quicklink-card-subtitle">{service.description}</p></div></article>; })}
      </div></section>
      {!!data.sectionErrors?.length && <section className="management-alert error" role="alert">{data.sectionErrors.map(message => <p key={message}>{message}</p>)}<button className="btn" onClick={retry}>Retry</button></section>}
      <div className="pd-featured-grid">
        <section className="dashboard-section"><h2>Featured medicines</h2><PublicCards kind="medicines" items={data.featuredMedicines} /><Link className="pd-browse" to="/patient/medicines">Browse all medicines →</Link></section>
        <section className="dashboard-section"><h2>Featured doctors</h2><PublicCards kind="doctors" items={data.featuredDoctors} /><Link className="pd-browse" to="/patient/doctors">Browse all doctors →</Link></section>
      </div>
      <section className="dashboard-section pd-notices"><FileCheck size={28} aria-hidden="true" /><div><h2 className="pd-sr-only">Notices & announcements</h2>
        {data.notices?.length ? data.notices.map(notice => <article key={notice.title}><h3>{notice.title}</h3><p>{notice.message}</p></article>) : <p>No announcements at the moment.</p>}
      </div></section>
    </>}
    </div>
  </DashboardLayout>;
}
