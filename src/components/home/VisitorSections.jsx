import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pill, Stethoscope, HeartPulse, Sparkles, Search, ChevronDown, Bell, ArrowRight, ShieldCheck } from 'lucide-react';
import useReveal from './useReveal';
import '../../styles/visitor-home.css';
import '../../styles/visitor-sections.css';
import pharmacyPhoto from '../../assets/pharmacy.jpg';
import doctorPhoto from '../../assets/doctor.jpg';
import patientPhoto from '../../assets/home-service-patient.jpg';

const iconFor = (title = '') => {
  const text = title.toLowerCase();
  if (/pharm|medic|drug/.test(text)) return Pill;
  if (/doctor|health|professional|consult/.test(text)) return Stethoscope;
  if (/patient|care/.test(text)) return HeartPulse;
  return Sparkles;
};
const photoFor = (title = '') => {
  if (/patient/i.test(title)) return patientPhoto;
  return /doctor|professional|consult/i.test(title) ? doctorPhoto : pharmacyPhoto;
};
const initials = (name = '') => name.replace(/^dr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'Dr';

function Services({ services = [], introduction }) {
  const [active, setActive] = useState(0);
  const current = services[active];
  return <section className="vh-block" data-reveal>
    {introduction && <div className="vh-intro">
      <img src={pharmacyPhoto} alt="Pharmacist selecting medicine from a shelf" loading="lazy" />
      <div><span className="vh-eyebrow">Welcome to CareNova pharmacy</span><p>{introduction}</p>
        <Link to="/patient/medicines" className="vh-btn vh-btn-green">Browse medicines <ArrowRight size={16} /></Link></div>
    </div>}
    <h2 className="vh-title">Our services</h2>
    {services.length ? <div className="vh-services">
      <div className="vh-service-list" role="group" aria-label="Choose a service">
        {services.map((service, index) => {
          const Icon = iconFor(service.title);
          return <button key={service.title} type="button" aria-pressed={index === active} className={`vh-service-tab${index === active ? ' is-active' : ''}`} onClick={() => setActive(index)} onMouseEnter={() => setActive(index)}>
            <span className="vh-icon"><Icon size={20} /></span><strong>{service.title}</strong>
          </button>;
        })}
      </div>
      <article className="vh-service-detail" key={current.title}>
        <img src={photoFor(current.title)} alt="" loading="lazy" />
        <div><h3>{current.title}</h3><p>{current.description}</p></div>
      </article>
    </div> : <p>Our services will be listed here soon.</p>}
  </section>;
}

function Medicines({ items = [] }) {
  const [query, setQuery] = useState('');
  const shown = items.filter(item => `${item.name} ${item.categoryName || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="vh-block" data-reveal>
    <div className="vh-head"><h2 className="vh-title">Featured medicines</h2>
      {items.length > 0 && <label className="vh-search"><Search size={16} /><input type="search" placeholder="Search featured medicines" aria-label="Search featured medicines" value={query} onChange={event => setQuery(event.target.value)} /></label>}
    </div>
    {!items.length ? <p>No medicines are available to display yet.</p> : !shown.length ? <p>No featured medicine matches “{query}”.</p> :
      <div className="vh-grid">{shown.map(item => <Link className="vh-card vh-card-red" key={item.id} to={`/patient/medicines/${encodeURIComponent(item.id)}`}>
        <span className="vh-icon"><Pill size={22} /></span>
        <h3>{item.name}</h3>
        {item.categoryName && <span className="vh-tag">{item.categoryName}</span>}
        {item.price != null && <strong className="vh-price">LKR {Number(item.price).toFixed(2)}</strong>}
        {item.availabilityStatus && <small>{item.availabilityStatus}</small>}
        {item.prescriptionRequired && <small className="vh-rx">Prescription required</small>}
        <span className="vh-link">View details <ArrowRight size={14} /></span>
      </Link>)}</div>}
    <Link to="/patient/medicines" className="vh-more">Browse all medicines <ArrowRight size={14} /></Link>
  </section>;
}

function Doctors({ items = [] }) {
  const [filter, setFilter] = useState('All');
  const specialties = useMemo(() => ['All', ...new Set(items.map(item => item.specialization).filter(Boolean))], [items]);
  const shown = filter === 'All' ? items : items.filter(item => item.specialization === filter);
  return <section className="vh-block vh-doctors" data-reveal>
    <div className="vh-doctors-banner"><img src={doctorPhoto} alt="Smiling doctor with a stethoscope" loading="lazy" />
      <div><h2 className="vh-title vh-title-light">Featured doctors</h2><p>Meet qualified professionals and book a time that suits you.</p></div></div>
    {specialties.length > 2 && <div className="vh-chips" role="group" aria-label="Filter doctors by specialty">
      {specialties.map(name => <button key={name} type="button" aria-pressed={filter === name} className={`vh-chip-btn${filter === name ? ' is-active' : ''}`} onClick={() => setFilter(name)}>{name}</button>)}
    </div>}
    {!items.length ? <p>No doctors are available to display yet.</p> :
      <div className="vh-grid">{shown.map(item => <Link className="vh-card vh-card-green" key={item.doctorId} to={`/patient/doctors/${encodeURIComponent(item.doctorId)}`}>
        <span className="vh-avatar" aria-hidden="true">{initials(item.fullName)}</span>
        <h3>{item.fullName}</h3>
        <span className="vh-tag vh-tag-green">{item.specialization}</span>
        {item.consultationFee != null && <strong className="vh-price">Consultation: LKR {Number(item.consultationFee).toFixed(2)}</strong>}
        {item.availabilityStatus && <small>{item.availabilityStatus}</small>}
        <span className="vh-link">View profile <ArrowRight size={14} /></span>
      </Link>)}</div>}
    <Link to="/patient/doctors" className="vh-more">Browse all doctors <ArrowRight size={14} /></Link>
  </section>;
}

function Notices({ notices = [] }) {
  const [open, setOpen] = useState(0);
  return <section className="vh-block" data-reveal>
    <h2 className="vh-title">Notices &amp; announcements</h2>
    {notices.length ? <div className="vh-accordion">{notices.map((notice, index) => <article key={notice.title} className={`vh-notice${open === index ? ' is-open' : ''}`}>
      <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}><Bell size={18} /><h3>{notice.title}</h3><ChevronDown size={18} /></button>
      {open === index && <p>{notice.message}</p>}
    </article>)}</div> : <p>No announcements at the moment.</p>}
  </section>;
}

function JoinBand() {
  return <section className="vh-join" data-reveal>
    <ShieldCheck size={34} />
    <div><h2>Ready to look after your health?</h2><p>Create a free account to order medicines, book doctors and track everything in one place.</p></div>
    <Link to="/register" className="vh-btn vh-btn-white">Create account <ArrowRight size={16} /></Link>
  </section>;
}

export default function VisitorSections({ data, onRetry }) {
  const root = useReveal(data);
  return <div className="vh vh-sections" ref={root}>
    <Services services={data.services} introduction={data.introduction} />
    {!!data.sectionErrors?.length && <section className="management-alert error" role="alert">{data.sectionErrors.map(message => <p key={message}>{message}</p>)}<button className="btn" onClick={onRetry}>Retry</button></section>}
    <Medicines items={data.featuredMedicines} />
    <Doctors items={data.featuredDoctors} />
    <Notices notices={data.notices} />
    <JoinBand />
  </div>;
}
