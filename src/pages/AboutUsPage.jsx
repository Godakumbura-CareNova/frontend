import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import OpeningHours from '../components/public/OpeningHours';
import InformationStatus from '../components/public/InformationStatus';
import usePharmacyInformation from '../hooks/usePharmacyInformation';
import { pharmacyImageUrl } from '../services/pharmacyInformationService';
import teamPhoto from '../assets/about-pharmacy-team.jpg';
import patientCarePhoto from '../assets/about-patient-care.jpg';
import './pharmacyInformation.css';

function Photograph({ image }) {
  const [failed, setFailed] = useState(false);
  return <figure>{failed ? <p role="status">This photograph is currently unavailable.</p> : <img src={pharmacyImageUrl(image.url)} alt={image.caption} onError={() => setFailed(true)} loading="lazy" />}<figcaption>{image.caption}</figcaption></figure>;
}
export default function AboutUsPage() {
  const state = usePharmacyInformation(); const { data } = state;
  return <DashboardLayout><div className="pharmacy-info-page">
    <header className="welcome-banner"><h1>About <span className="welcome-name">CareNova</span></h1><p>Get to know your pharmacy and the care we provide.</p></header>
    <InformationStatus {...state} />
    {!state.loading && !state.error && data && <>
      <section className="management-card pharmacy-split"><div><h2>Our pharmacy</h2><p className="pharmacy-preserve-lines">{data.introduction}</p><h3>Our background</h3><p className="pharmacy-preserve-lines">{data.background || 'Our pharmacy background has not been published yet.'}</p></div><img className="pharmacy-feature-photo" src={teamPhoto} alt="CareNova pharmacists checking medicines together" /></section>
      <section className="management-card"><h2>Our services</h2><div className="quicklink-row">{data.services?.length ? data.services.map(service => <article className="quicklink-card" key={service.title}><div><h3 className="quicklink-card-title">{service.title}</h3><p className="quicklink-card-subtitle">{service.description}</p></div></article>) : <p>Service information has not been published yet.</p>}</div></section>
      <div className="pharmacy-mission-row"><img className="pharmacy-feature-photo" src={patientCarePhoto} alt="CareNova pharmacist helping a patient with their medicine" loading="lazy" /><div className="pharmacy-mission-cards"><section className="management-card"><h2>Our mission</h2><p className="pharmacy-preserve-lines">{data.mission || 'Our mission has not been published yet.'}</p></section><section className="management-card"><h2>Our vision</h2><p className="pharmacy-preserve-lines">{data.vision || 'Our vision has not been published yet.'}</p></section></div></div>
      <OpeningHours hours={data.openingHours} />
      <section className="management-card"><h2>Our pharmacy & team</h2>{data.images?.length ? <div className="pharmacy-gallery">{data.images.map(image => <Photograph key={image.url} image={image} />)}</div> : <p className="empty-state">Pharmacy and staff photographs have not been published yet.</p>}</section>
    </>}
  </div></DashboardLayout>;
}
