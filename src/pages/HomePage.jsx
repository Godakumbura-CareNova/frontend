import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Pill, Stethoscope, Calendar, ShoppingBag, CreditCard } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import { PublicCards } from '../components/home/PublicCards';
import { getHomeContent } from '../services/publicContentService';

// The landing page and patient dashboard share their content and layout.
export default function HomePage() {
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
    <div className="welcome-banner">
      <Heart size={72} className="welcome-decoration" />
      <h1>Welcome to <span className="welcome-name">CareNova</span></h1>
      <p>Manage your health easily with CareNova.</p>
    </div>
    <div className="stat-card-grid">
      <StatCard icon={ShoppingBag} title="Recent Medicine Orders" />
      <StatCard icon={Calendar} title="Upcoming Appointments" />
      <StatCard icon={CreditCard} title="Payment Statuses" />
      <StatCard icon={Pill} title="Quick Links" />
    </div>
    <section className="dashboard-section">
      <h2>Quick Links</h2>
      <div className="quicklink-row">
        <Link to="/patient/medicines" className="quicklink-card">
          <div><div className="quicklink-card-title">Medicines</div><div className="quicklink-card-subtitle">Browse and order medicines</div></div>
          <div className="quicklink-card-icon" style={{ background: 'var(--red-soft)', color: 'var(--red-strong)' }}><Pill size={20} /></div>
        </Link>
        <Link to="/patient/doctors" className="quicklink-card">
          <div><div className="quicklink-card-title">Doctors</div><div className="quicklink-card-subtitle">Search doctors and check availability</div></div>
          <div className="quicklink-card-icon" style={{ background: '#ecfdf3', color: 'var(--success)' }}><Stethoscope size={20} /></div>
        </Link>
      </div>
    </section>
    {loading && <p role="status">Loading pharmacy information…</p>}
    {error && <section className="dashboard-section management-alert error" role="alert">
      <h2>We couldn’t load the home page information.</h2><p>Please try again.</p><button className="btn btn-primary" onClick={retry}>Retry</button>
    </section>}
    {!loading && !error && data && <>
      <section className="dashboard-section"><h2>Welcome to CareNova pharmacy</h2><p>{data.introduction}</p></section>
      <section className="dashboard-section"><h2>Our services</h2><div className="quicklink-row">
        {data.services?.map(service => <article className="quicklink-card" key={service.title}><div><h3 className="quicklink-card-title">{service.title}</h3><p className="quicklink-card-subtitle">{service.description}</p></div></article>)}
      </div></section>
      {!!data.sectionErrors?.length && <section className="management-alert error" role="alert">{data.sectionErrors.map(message => <p key={message}>{message}</p>)}<button className="btn" onClick={retry}>Retry</button></section>}
      <section className="dashboard-section"><h2>Featured medicines</h2><PublicCards kind="medicines" items={data.featuredMedicines} /><Link to="/patient/medicines">Browse all medicines →</Link></section>
      <section className="dashboard-section"><h2>Featured doctors</h2><PublicCards kind="doctors" items={data.featuredDoctors} /><Link to="/patient/doctors">Browse all doctors →</Link></section>
      <section className="dashboard-section"><h2>Notices & announcements</h2>
        {data.notices?.length ? data.notices.map(notice => <article key={notice.title}><h3>{notice.title}</h3><p>{notice.message}</p></article>) : <p>No announcements at the moment.</p>}
      </section>
    </>}
  </DashboardLayout>;
}
