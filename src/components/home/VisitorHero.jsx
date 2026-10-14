import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Stethoscope, Pill, ShieldCheck, Users, ArrowRight, Search, HeartPulse, Sparkles, Truck, Plus } from 'lucide-react';
import useReveal from './useReveal';
import heroPhoto from '../../assets/home-hero-pharmacist.jpg';
import appointmentsPhoto from '../../assets/home-feature-appointments.jpg';
import doctorsPhoto from '../../assets/home-feature-doctors.jpg';
import pharmacyPhoto from '../../assets/home-feature-pharmacy.jpg';
import carePhoto from '../../assets/home-feature-care.jpg';
import whyDoctorPhoto from '../../assets/home-why-doctor.jpg';
import '../../styles/visitor-home.css';

const highlights = [
  { icon: Calendar, title: 'Easy Appointment Booking', text: 'Pick a doctor and a time that suits you.', photo: appointmentsPhoto },
  { icon: Users, title: 'Trusted Doctors', text: 'Published, verified professional profiles.', photo: doctorsPhoto },
  { icon: Pill, title: 'Online Pharmacy', text: 'Browse medicines and order in a few clicks.', photo: pharmacyPhoto },
  { icon: ShieldCheck, title: 'Secure & Reliable Care', text: 'Your details stay private and protected.', photo: carePhoto },
];

const actions = [
  { to: '/patient/doctors', icon: Stethoscope, title: 'Consult a Doctor', text: 'Book appointments with qualified and experienced doctors.', cta: 'Book Now', tone: 'red' },
  { to: '/patient/medicines', icon: Pill, title: 'Order from Pharmacy', text: 'Find genuine medicines and check prescription needs.', cta: 'Shop Now', tone: 'green' },
  { to: '/about', icon: Sparkles, title: 'Our Services', text: 'Explore the healthcare services designed for you.', cta: 'Learn More', tone: 'red' },
];

const reasons = [
  { icon: HeartPulse, title: 'Patient Focused', text: 'Your well-being comes first.', tone: 'red' },
  { icon: ShieldCheck, title: 'Trusted Professionals', text: 'Experienced and qualified doctors.', tone: 'green' },
  { icon: Sparkles, title: 'Modern Technology', text: 'Simple, secure and convenient.', tone: 'green' },
  { icon: Truck, title: 'Complete Healthcare', text: 'From consultation to pharmacy and more.', tone: 'red' },
];

export default function VisitorHero() {
  const root = useReveal();

  return <div className="vh" ref={root}>
    <section className="vh-hero">
      <div className="vh-hero-copy">
        <span className="vh-eyebrow">Trusted Healthcare for a Healthier Tomorrow</span>
        <h1><span className="vh-word">Quality Healthcare</span> <span className="vh-word vh-word-2">for a Brighter Tomorrow</span></h1>
        <p>CareNova connects you with trusted doctors, easy appointment booking and online pharmacy services, all in one place.</p>
        <div className="vh-hero-actions">
          <Link to="/patient/doctors" className="vh-btn vh-btn-green">Book an Appointment <ArrowRight size={16} /></Link>
          <Link to="/patient/doctors" className="vh-btn vh-btn-outline">Find a Doctor <Search size={16} /></Link>
        </div>
      </div>
      <div className="vh-hero-visual">
        <img className="vh-photo" src={heroPhoto} alt="CareNova pharmacist selecting medicine from a shelf" />
        <div className="vh-chip vh-chip-a"><Stethoscope size={18} /> Expert doctors</div>
        <div className="vh-chip vh-chip-b"><Pill size={18} /> Online pharmacy</div>
        <div className="vh-chip vh-chip-c"><Users size={18} /> Trusted by patients</div>
      </div>
    </section>

    <section className="vh-highlights" data-reveal>
      {highlights.map(({ icon: Icon, title, text, photo }) => <div className="vh-highlight" key={title}>
        <div className="vh-highlight-media" style={{ '--vh-media': `url(${photo})` }}><img className="vh-highlight-photo" src={photo} alt="" loading="lazy" /></div>
        <span className="vh-icon"><Icon size={22} /></span><strong>{title}</strong><small>{text}</small>
      </div>)}
    </section>

    <section className="vh-actions" data-reveal>
      {actions.map(({ to, icon: Icon, title, text, cta, tone }) => <Link to={to} className={`vh-action vh-${tone}`} key={title}>
        <span className="vh-icon"><Icon size={26} /></span>
        <div><h3>{title}</h3><p>{text}</p><span className="vh-link">{cta} <ArrowRight size={14} /></span></div>
      </Link>)}
    </section>

    <section className="vh-why" data-reveal>
      <div className="vh-why-copy">
        <span className="vh-why-eyebrow">Why choose CareNova?</span>
        <h2>Better Healthcare<br />for a <span>Healthier</span> Tomorrow</h2>
        <p>We are committed to providing accessible, reliable and patient-centered healthcare services.</p>
        <div className="vh-reasons">
          {reasons.map(({ icon: Icon, title, text, tone }) => <div className={`vh-reason vh-reason-${tone}`} key={title}>
            <span className="vh-reason-icon"><Icon size={26} /></span>
            <div><strong>{title}</strong><small>{text}</small></div>
          </div>)}
        </div>
      </div>
      <div className="vh-why-panel">
        <span className="vh-why-dots" aria-hidden="true" />
        <Plus className="vh-why-cross vh-why-cross-a" size={64} strokeWidth={5} aria-hidden="true" />
        <Plus className="vh-why-cross vh-why-cross-b" size={34} strokeWidth={5} aria-hidden="true" />
        <div className="vh-why-panel-copy">
          <span className="vh-why-kicker">CareNova</span>
          <h3>Your Partner in Health and Wellness</h3>
          <p>We strive to make quality healthcare accessible to everyone, every day.</p>
          <Link to="/register" className="vh-btn vh-btn-white">Create a free account</Link>
        </div>
        <img className="vh-why-doctor" src={whyDoctorPhoto} alt="Smiling CareNova doctor holding a clipboard" loading="lazy" />
      </div>
    </section>
  </div>;
}
