import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FileText,
  GraduationCap,
  RefreshCw,
  Stethoscope,
  UserRoundX,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import ProfileSection from '../components/doctors/ProfileSection';
import CredentialList from '../components/doctors/CredentialList';
import AvailabilityBadge, { formatSlotTime } from '../components/doctors/AvailabilityBadge';
import DoctorAvatar from '../components/doctors/DoctorAvatar';
import { displayDoctorName } from '../components/doctors/DoctorCard';
import { getDoctorPublicProfile } from '../services/doctorService';
import './doctorProfile.css';
import './patientDoctors.css';

const describeLoadError = (error) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return { message: 'You are not authorized to view doctor profiles.', retryable: false };
  if (!error?.response) return { message: 'We could not reach the doctor directory. Check your connection and try again.', retryable: true };
  return { message: error?.response?.data?.message || "This doctor's profile could not be loaded right now.", retryable: true };
};

const experienceLabel = (years) => {
  if (years === null || years === undefined) return null;
  if (years < 1) return 'Under a year of experience';
  return `${years} year${years === 1 ? '' : 's'} of experience`;
};

const PatientDoctorProfilePage = () => {
  const { doctorId } = useParams();

  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const data = await getDoctorPublicProfile(doctorId);
      if (data) setProfile(data);
      else setNotFound(true);
    } catch (error) {
      setLoadError(describeLoadError(error));
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  const backLink = (
    <Link to="/patient/doctors" className="dp-back-link">
      <ArrowLeft size={15} /> Back to doctor search
    </Link>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dp-page pd-page">
          {backLink}
          <div className="dp-card"><p className="dp-status">Loading doctor profile...</p></div>
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="dp-page pd-page">
          {backLink}
          <div className="dp-card">
            <div className="alert alert-error" role="alert">
              <span>{loadError.message}</span>
              {loadError.retryable && (
                <button type="button" className="dp-retry-btn" onClick={load}><RefreshCw size={13} /> Retry</button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <DashboardLayout>
        <div className="dp-page pd-page">
          {backLink}
          <div className="dp-card">
            <div className="pd-empty" role="status">
              <span className="pd-empty-icon"><UserRoundX size={26} /></span>
              <h2>Doctor profile not available</h2>
              <p>This doctor has not published a professional profile yet.</p>
              <Link to="/patient/doctors" className="btn btn-green">Back to doctor search</Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const name = displayDoctorName(profile.fullName);
  const availability = profile.availability || {};
  const upcoming = profile.upcomingSlots || [];
  const experience = experienceLabel(profile.yearsOfExperience);

  return (
    <DashboardLayout>
      <div className="dp-page pd-page">
        {backLink}

        <header className="dp-hero">
          <div className="dp-avatar-wrap pd-avatar-wrap">
            <DoctorAvatar doctorId={profile.doctorId} fullName={profile.fullName} size="lg" />
          </div>

          <div className="dp-hero-text">
            <h1 className="dp-hero-title">{name}</h1>
            <p className="dp-hero-name">{profile.specialization}</p>
            <p className="dp-hero-subtitle">Professional profile and consultation availability</p>
            <div className="dp-hero-chips">
              <span className="dp-chip dp-chip-green"><BadgeCheck size={12} /> Doctor</span>
              {profile.specialization && <span className="dp-chip">{profile.specialization}</span>}
              <AvailabilityBadge availability={availability} className="pd-availability-hero" />
            </div>
          </div>

          <svg className="dp-hero-pulse" viewBox="0 0 160 60" aria-hidden="true">
            <path d="M0 30h32l10-18 14 38 12-30 10 18h20l8-12 10 18 8-14h36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M138 4v10M133 9h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </header>

        <div className="dp-card">
          <ProfileSection icon={CalendarClock} title="Consultation Availability">
            {availability.hasAvailableSlots ? (
              <div className="pd-slots">
                <p className="pd-slots-summary">
                  <strong>{availability.availableSlotCount}</strong> open consultation slot{availability.availableSlotCount === 1 ? '' : 's'}.
                  {availability.nextAvailableSlotUtc && <> Next available: <strong>{formatSlotTime(availability.nextAvailableSlotUtc)}</strong>.</>}
                </p>
                {upcoming.length > 0 && (
                  <ul className="pd-slot-list" aria-label="Upcoming consultation slots">
                    {upcoming.map((slot) => (
                      <li key={slot.id} className="pd-slot">
                        <CalendarClock size={13} aria-hidden="true" />
                        {formatSlotTime(slot.startUtc)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="dp-hint">Booking a consultation will be available once the appointment module is live.</p>
              </div>
            ) : (
              <div className="pd-slots">
                <p className="dp-empty">This doctor has no open consultation slots at the moment.</p>
                <p className="dp-hint">Check back later or search for another doctor with open slots.</p>
              </div>
            )}
          </ProfileSection>

          <ProfileSection icon={Stethoscope} title="Specialization" tone="red">
            <div className="dp-spec-block">
              <div className="dp-spec-pill">{profile.specialization}</div>
              <div className="dp-spec-meta">
                <span className="dp-spec-meta-item">
                  <BadgeCheck size={14} aria-hidden="true" /> Reg. No. {profile.registrationNumber}
                </span>
                {experience && (
                  <span className="dp-spec-meta-item">
                    <Briefcase size={14} aria-hidden="true" /> {experience}
                  </span>
                )}
              </div>
              {profile.biography ? (
                <p className="dp-biography">
                  <FileText size={14} aria-hidden="true" /> {profile.biography}
                </p>
              ) : (
                <p className="dp-empty">No professional summary provided.</p>
              )}
            </div>
          </ProfileSection>

          <ProfileSection icon={GraduationCap} title="Qualifications">
            <CredentialList
              items={profile.qualifications}
              titleKey="degree"
              subtitleKey="institution"
              itemLabel="Qualification"
              emptyMessage="No qualifications listed."
            />
          </ProfileSection>

          <ProfileSection icon={Briefcase} title="Experience">
            <CredentialList
              items={profile.experiences}
              titleKey="position"
              subtitleKey="organization"
              itemLabel="Experience"
              emptyMessage="No experience listed."
            />
          </ProfileSection>

          <ProfileSection icon={ClipboardList} title="Other">
            <CredentialList
              items={profile.otherDetails}
              titleKey="title"
              subtitleKey="details"
              itemLabel="Other"
              emptyMessage="No other details listed."
            />
          </ProfileSection>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDoctorProfilePage;
