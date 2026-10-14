import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Stethoscope, Pill, ShieldCheck, Users, ArrowRight, Search, HeartPulse, Sparkles, Truck } from 'lucide-react';
import useReveal from './useReveal';
import heroPhoto from '../../assets/doctor.jpg';
import '../../styles/visitor-home.css';

const highlights = [
  { icon: Calendar, title: 'Easy Appointment Booking', text: 'Pick a doctor and a time that suits you.' },
  { icon: Users, title: 'Trusted Doctors', text: 'Published, verified professional profiles.' },
  { icon: Pill, title: 'Online Pharmacy', text: 'Browse medicines and order in a few clicks.' },
  { icon: ShieldCheck, title: 'Secure & Reliable Care', text: 'Your details stay private and protected.' },
];

const actions = [
  { to: '/patient/doctors', icon: Stethoscope, title: 'Consult a Doctor', text: 'Book appointments with qualified and experienced doctors.', cta: 'Book Now', tone: 'red' },
  { to: '/patient/medicines', icon: Pill, title: 'Order from Pharmacy', text: 'Find genuine medicines and check prescription needs.', cta: 'Shop Now', tone: 'green' },
  { to: '/about', icon: Sparkles, title: 'Our Services', text: 'Explore the healthcare services designed for you.', cta: 'Learn More', tone: 'red' },
];

const reasons = [
  { icon: HeartPulse, title: 'Patient Focused', text: 'Your well-being comes first.' },
  { icon: ShieldCheck, title: 'Trusted Professionals', text: 'Experienced and qualified doctors.' },
  { icon: Sparkles, title: 'Modern Technology', text: 'Simple, secure and convenient.' },
  { icon: Truck, title: 'Complete Healthcare', text: 'From consultation to pharmacy and more.' },
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
        <img className="vh-photo" src={heroPhoto} alt="Smiling CareNova doctor with a stethoscope" />
        <div className="vh-chip vh-chip-a"><Stethoscope size={18} /> Expert doctors</div>
        <div className="vh-chip vh-chip-b"><Pill size={18} /> Online pharmacy</div>
        <div className="vh-chip vh-chip-c"><Users size={18} /> Trusted by patients</div>
      </div>
    </section>

    <section className="vh-highlights" data-reveal>
      {highlights.map(({ icon: Icon, title, text }) => <div className="vh-highlight" key={title}>
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
        <h2>Why Choose CareNova?</h2>
        <p>We are committed to providing accessible, reliable and patient-centered healthcare services.</p>
        <div className="vh-reasons">
          {reasons.map(({ icon: Icon, title, text }) => <div className="vh-reason" key={title}><Icon size={22} /><strong>{title}</strong><small>{text}</small></div>)}
        </div>
      </div>
      <div className="vh-why-panel">
        <h3>Your Partner in Health and Wellness</h3>
        <p>We strive to make quality healthcare accessible to everyone, every day.</p>
        <Link to="/register" className="vh-btn vh-btn-white">Create a free account <ArrowRight size={16} /></Link>
      </div>
    </section>
  </div>;
}
