import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Calendar,
  Camera,
  ClipboardList,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Save,
  Stethoscope,
  Trash2,
  User,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import ProfileSection from '../components/doctors/ProfileSection';
import ProfileInfoField from '../components/doctors/ProfileInfoField';
import CredentialList from '../components/doctors/CredentialList';
import CredentialListEditor from '../components/doctors/CredentialListEditor';
import AvailabilityManager from '../components/doctors/AvailabilityManager';
import ConsultationFeeSection from '../components/doctors/ConsultationFeeSection';
import profileApi from '../api/profileApi';
import { deleteMyDoctorProfile, getMyDoctorProfile, saveMyDoctorProfile } from '../services/doctorService';
import {
  DOCTOR_PROFILE_MAX_ENTRIES,
  mapServerValidationErrors,
  toDoctorProfileRequest,
  validateDoctorProfileForm,
} from '../utils/doctorValidation';
import { validateProfileForm, validateProfilePictureFile } from '../utils/validation';
import { accountPicturePath } from '../utils/doctorPicture';
import './doctorProfile.css';

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#f2f2f2"/>' +
    '<circle cx="100" cy="78" r="34" fill="#c8c8c8"/>' +
    '<path d="M34 176c7-34 32-53 66-53s59 19 66 53" fill="#c8c8c8"/>' +
    '</svg>'
  );

const asText = (value) => {
  if (value === null || value === undefined) return 'Not provided';
  const text = String(value).trim();
  return text.length > 0 ? text : 'Not provided';
};

const formatDate = (value) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const toDateInputValue = (value) => (value ? String(value).slice(0, 10) : '');

// Same account fields the shared ProfilePage edits, read with the same casing tolerance.
const toAccountForm = (data) => ({
  fullName: data?.fullName ?? data?.FullName ?? data?.name ?? data?.Name ?? '',
  email: data?.email ?? data?.Email ?? '',
  mobileNumber: data?.mobileNumber ?? data?.MobileNumber ?? '',
  landPhoneNumber: data?.landPhoneNumber ?? data?.LandPhoneNumber ?? '',
  address: data?.address ?? data?.Address ?? '',
  dateOfBirth: toDateInputValue(data?.dateOfBirth ?? data?.DateOfBirth),
  gender: data?.gender ?? data?.Gender ?? '',
});

let rowKeySequence = 0;
const nextRowKey = () => `row-${(rowKeySequence += 1)}`;
const yearToText = (value) => (value === null || value === undefined ? '' : String(value));

const emptyQualification = () => ({ key: nextRowKey(), degree: '', institution: '', startYear: '', endYear: '' });
const emptyExperience = () => ({ key: nextRowKey(), position: '', organization: '', startYear: '', endYear: '' });
const emptyOtherDetail = () => ({ key: nextRowKey(), title: '', details: '', startYear: '', endYear: '' });

const toProfessionalForm = (profile) => ({
  specialization: profile?.specialization ?? '',
  profilePicturePath: profile?.profilePicturePath ?? '',
  registrationNumber: profile?.registrationNumber ?? '',
  biography: profile?.biography ?? '',
  consultationFee: profile?.consultationFee === null || profile?.consultationFee === undefined ? '' : String(profile.consultationFee),
  qualifications: (profile?.qualifications ?? []).map((item) => ({
    key: nextRowKey(),
    degree: item.degree ?? '',
    institution: item.institution ?? '',
    startYear: yearToText(item.startYear),
    endYear: yearToText(item.endYear),
  })),
  experiences: (profile?.experiences ?? []).map((item) => ({
    key: nextRowKey(),
    position: item.position ?? '',
    organization: item.organization ?? '',
    startYear: yearToText(item.startYear),
    endYear: yearToText(item.endYear),
  })),
  otherDetails: (profile?.otherDetails ?? []).map((item) => ({
    key: nextRowKey(),
    title: item.title ?? '',
    details: item.details ?? '',
    startYear: yearToText(item.startYear),
    endYear: yearToText(item.endYear),
  })),
});

const describeSaveError = (error, fallbackMessage) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (status === 400) {
    return {
      message: serverMessage || 'Some of the information entered is invalid. Please review the highlighted fields.',
      fieldErrors: mapServerValidationErrors(error?.response?.data?.errors),
      retryable: false,
    };
  }
  if (status === 401 || status === 403) {
    return { message: 'You are not authorized to update this doctor profile.', fieldErrors: {}, retryable: false };
  }
  return { message: serverMessage || fallbackMessage, fieldErrors: {}, retryable: true };
};

const DoctorProfilePage = () => {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();

  const [account, setAccount] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [accountForm, setAccountForm] = useState(() => toAccountForm(null));
  const [form, setForm] = useState(() => toProfessionalForm(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const fileInputRef = useRef(null);

  const loadEverything = useCallback(async () => {
    setLoading(true);
    setAccountError('');
    setProfileError('');

    const [accountResult, profileResult] = await Promise.allSettled([profileApi.getProfile(), getMyDoctorProfile()]);

    if (accountResult.status === 'fulfilled') {
      setAccount(accountResult.value || null);
      setAccountForm(toAccountForm(accountResult.value));
    } else {
      setAccountError(accountResult.reason?.response?.data?.message || 'Failed to load your account details.');
    }

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
      setForm(toProfessionalForm(profileResult.value));
    } else {
      setProfileError(profileResult.reason?.response?.data?.message || 'Failed to load your professional profile.');
    }

    setLoading(false);

    // The picture lives in user-auth; this profile only records which file it is. A picture uploaded
    // before that was recorded (or changed since) is synced once here, so patients see the current one
    // without the doctor having to save anything. Silent: nothing the doctor asked for has failed.
    const loadedAccount = accountResult.status === 'fulfilled' ? accountResult.value : null;
    const loadedProfile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    if (loadedAccount && loadedProfile) {
      const livePath = accountPicturePath(loadedAccount) ?? '';
      if (livePath !== (loadedProfile.profilePicturePath ?? '')) {
        try {
          const next = toProfessionalForm(loadedProfile);
          next.profilePicturePath = livePath;
          const saved = await saveMyDoctorProfile(toDoctorProfileRequest(next));
          setProfile(saved);
          setForm(toProfessionalForm(saved));
        } catch {
          // Patients keep seeing the previous picture until the next successful save.
        }
      }
    }
  }, []);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  const avatarUrl = useMemo(() => {
    const hasPicture = Boolean(account?.hasProfilePicture ?? account?.HasProfilePicture);
    const url = account?.profilePictureUrl ?? account?.ProfilePictureUrl;
    return hasPicture && typeof url === 'string' && url.trim() ? url : DEFAULT_AVATAR;
  }, [account]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    const validation = validateProfilePictureFile(file);
    if (!validation.isValid) {
      setPictureError(validation.error);
      return;
    }

    setPictureError('');
    setUploading(true);
    try {
      const updated = await profileApi.uploadProfilePicture(file);
      if (updated) {
        setAccount(updated);
        setAccountForm(toAccountForm(updated));
        // The picture itself lives in user-auth; the doctor-payment profile only records which file it is,
        // so patients keep seeing the latest one. Nothing to record until a professional profile exists.
        if (profile) {
          try {
            await saveProfilePicturePath(accountPicturePath(updated));
          } catch {
            setPictureError('Your picture was uploaded, but patients will keep seeing the previous one until you save your profile.');
          }
        }
      }
    } catch (error) {
      setPictureError(error?.response?.data?.message || 'Failed to upload the profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const requestEditing = () => setShowEditConfirm(true);

  const startEditing = () => {
    setShowEditConfirm(false);
    setAccountForm(toAccountForm(account));
    const base = toProfessionalForm(profile);
    setForm(pendingAdd ? withExtraRow(base, pendingAdd.listName, pendingAdd.factory) : base);
    setPendingAdd(null);
    setErrors({});
    setSaveError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setAccountForm(toAccountForm(account));
    setForm(toProfessionalForm(profile));
    setErrors({});
    setSaveError(null);
    setEditing(false);
  };

  const clearError = (key) => {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleAccountChange = (event) => {
    const { name, value } = event.target;
    setAccountForm((current) => ({ ...current, [name]: value }));
    clearError(name);
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    clearError(name);
  };

  const updateListItem = (listName) => (index, field, value) => {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
    clearError(`${listName}[${index}].${field}`);
  };

  const removeListItem = (listName) => (index) => {
    setForm((current) => ({ ...current, [listName]: current[listName].filter((_, itemIndex) => itemIndex !== index) }));
    // Indexed error keys no longer line up once a row is removed; re-validation on save rebuilds them.
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${listName}[`))));
  };

  const withExtraRow = (formState, listName, factory) => {
    if (formState[listName].length >= DOCTOR_PROFILE_MAX_ENTRIES) return formState;
    return { ...formState, [listName]: [...formState[listName], factory()] };
  };

  // From read mode this has to wait for the edit confirmation, so the row is remembered and
  // added once the editor opens; otherwise "Add Other" would leave an empty section behind.
  const addListItem = (listName, factory) => {
    if (!editing) {
      setPendingAdd({ listName, factory });
      requestEditing();
      return;
    }
    setForm((current) => withExtraRow(current, listName, factory));
  };

  const requestRemoval = (listName, label) => (index) => {
    setSaveError(null);
    setPendingRemoval({ listName, label, index });
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval || !profile) return;
    const { listName, label, index } = pendingRemoval;
    setPendingRemoval(null);
    setSaving(true);

    const next = toProfessionalForm(profile);
    next[listName] = next[listName].filter((_, itemIndex) => itemIndex !== index);

    try {
      const saved = await saveMyDoctorProfile(toDoctorProfileRequest(next));
      setProfile(saved);
      setForm(toProfessionalForm(saved));
      showToast(`${label} removed.`, 'danger');
    } catch (error) {
      const described = describeSaveError(error, `Failed to remove the ${label.toLowerCase()}.`);
      setSaveError({ ...described, retry: () => { setPendingRemoval({ listName, label, index }); } });
    } finally {
      setSaving(false);
    }
  };

  // Records which user-auth picture belongs to this doctor. The API replaces the whole profile,
  // so everything else is resent unchanged.
  const saveProfilePicturePath = async (picturePath) => {
    const next = toProfessionalForm(profile);
    next.profilePicturePath = picturePath ?? '';
    const saved = await saveMyDoctorProfile(toDoctorProfileRequest(next));
    setProfile(saved);
    setForm(toProfessionalForm(saved));
    return saved;
  };

  // Specialization is mandatory, so removing it means removing the whole professional profile.
  const deleteProfessionalProfile = async () => {
    setShowDeleteConfirm(false);
    setSaveError(null);
    setSaving(true);

    try {
      await deleteMyDoctorProfile();
      setProfile(null);
      setForm(toProfessionalForm(null));
      setErrors({});
      setEditing(false);
      showToast('Your professional profile has been deleted. Your account details are unchanged.', 'danger');
    } catch (error) {
      const described = describeSaveError(error, 'Failed to delete your professional profile.');
      setSaveError({ ...described, retry: () => setShowDeleteConfirm(true) });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaveError(null);

    const basic = validateProfileForm(accountForm);
    const professional = validateDoctorProfileForm(form);
    const combinedErrors = { ...basic.errors, ...professional.errors };

    if (Object.keys(combinedErrors).length > 0) {
      setErrors(combinedErrors);
      setSaveError({ message: 'Please correct the highlighted fields before saving.', retryable: false });
      return;
    }

    setErrors({});
    setShowSaveConfirm(true);
  };

  // Saves account details (user-auth service) and professional details (doctor-payment service) together.
  const saveProfile = async () => {
    setShowSaveConfirm(false);
    setSaveError(null);
    setSaving(true);

    const accountRequest = {
      fullName: accountForm.fullName.trim(),
      mobileNumber: accountForm.mobileNumber.trim(),
      landPhoneNumber: accountForm.landPhoneNumber.trim() || null,
      address: accountForm.address.trim(),
      dateOfBirth: accountForm.dateOfBirth,
      gender: accountForm.gender,
    };

    // Every save re-syncs which user-auth picture belongs to this doctor, so the snapshot patients see
    // is refreshed even when the picture was uploaded before the professional profile existed.
    const professionalRequest = toDoctorProfileRequest({ ...form, profilePicturePath: accountPicturePath(account) ?? '' });

    const [accountResult, professionalResult] = await Promise.allSettled([
      profileApi.updateProfile(accountRequest),
      saveMyDoctorProfile(professionalRequest),
    ]);

    if (accountResult.status === 'fulfilled') {
      const updated = accountResult.value;
      setAccount(updated);
      setAccountForm(toAccountForm(updated));
      setUser({ ...user, fullName: accountRequest.fullName });
    }
    if (professionalResult.status === 'fulfilled') {
      setProfile(professionalResult.value);
      setForm(toProfessionalForm(professionalResult.value));
    }

    if (accountResult.status === 'fulfilled' && professionalResult.status === 'fulfilled') {
      setEditing(false);
      showToast('Your profile has been saved.');
    } else {
      const failures = [];
      if (accountResult.status === 'rejected') failures.push(describeSaveError(accountResult.reason, 'Failed to save your account details.'));
      if (professionalResult.status === 'rejected') failures.push(describeSaveError(professionalResult.reason, 'Failed to save your professional profile.'));

      const fieldErrors = Object.assign({}, ...failures.map((failure) => failure.fieldErrors));
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      setSaveError({
        message: failures.map((failure) => failure.message).join(' '),
        retryable: failures.some((failure) => failure.retryable),
      });
    }

    setSaving(false);
  };

  const hasProfile = Boolean(profile);
  const fullName = asText(account?.fullName ?? account?.FullName);
  const displayName = fullName === 'Not provided' ? 'Doctor' : fullName;
  const fieldError = (key) => (errors[key] ? <span className="field-error" role="alert">{errors[key]}</span> : null);
  const inputClass = (key) => `form-input${errors[key] ? ' has-error' : ''}`;

  if (loading) {
    return (
      <div className="profile-shell dp-shell">
        <div className="dp-page"><div className="dp-card"><p className="dp-status">Loading your profile...</p></div></div>
      </div>
    );
  }

  const addQualificationButton = (
    <button
      type="button"
      className="dp-add-btn"
      onClick={() => addListItem('qualifications', emptyQualification)}
      disabled={saving || form.qualifications.length >= DOCTOR_PROFILE_MAX_ENTRIES}
    >
      <Plus size={13} /> Add Qualification
    </button>
  );

  const editDetailsButton = editing ? null : (
    <button type="button" className="dp-add-btn" onClick={requestEditing} disabled={saving || Boolean(accountError)}>
      <Pencil size={13} /> Edit Details
    </button>
  );

  const addOtherDetailButton = (
    <button
      type="button"
      className="dp-add-btn"
      onClick={() => addListItem('otherDetails', emptyOtherDetail)}
      disabled={saving || form.otherDetails.length >= DOCTOR_PROFILE_MAX_ENTRIES}
    >
      <Plus size={13} /> Add Other
    </button>
  );

  const editSpecializationButton = editing ? (
    hasProfile && (
      <button type="button" className="dp-add-btn dp-danger-btn" onClick={() => setShowDeleteConfirm(true)} disabled={saving}>
        <Trash2 size={13} /> Delete Specialization
      </button>
    )
  ) : (
    <button type="button" className="dp-add-btn" onClick={requestEditing} disabled={saving || Boolean(accountError)}>
      <Pencil size={13} /> {hasProfile ? 'Edit Specialization' : 'Add Specialization'}
    </button>
  );

  const addExperienceButton = (
    <button
      type="button"
      className="dp-add-btn"
      onClick={() => addListItem('experiences', emptyExperience)}
      disabled={saving || form.experiences.length >= DOCTOR_PROFILE_MAX_ENTRIES}
    >
      <Plus size={13} /> Add Experience
    </button>
  );

  return (
    <div className="profile-shell dp-shell">
      <div className="dp-page">
        <Link to="/doctor-dashboard" className="dp-back-link">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>

        <header className="dp-hero">
          <div className="dp-avatar-wrap">
            <img
              src={avatarUrl}
              alt={`${displayName} profile`}
              className="dp-avatar"
              onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }}
            />
            <button
              type="button"
              className="dp-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={account?.hasProfilePicture ? 'Change profile picture' : 'Add profile picture'}
              title={account?.hasProfilePicture ? 'Change profile picture' : 'Add profile picture'}
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="dp-file-input"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="dp-hero-text">
            <h1 className="dp-hero-title">Doctor Profile</h1>
            <p className="dp-hero-name">Dr. {displayName}</p>
            <p className="dp-hero-subtitle">Manage your account and professional information</p>
            <div className="dp-hero-chips">
              <span className="dp-chip dp-chip-green"><BadgeCheck size={12} /> Doctor</span>
              {hasProfile && profile.specialization && <span className="dp-chip">{profile.specialization}</span>}
            </div>
            {uploading && <p className="dp-hero-note">Uploading picture...</p>}
            {pictureError && <p className="dp-hero-note dp-hero-note-error" role="alert">{pictureError}</p>}
          </div>

          <svg className="dp-hero-pulse" viewBox="0 0 160 60" aria-hidden="true">
            <path d="M0 30h32l10-18 14 38 12-30 10 18h20l8-12 10 18 8-14h36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M138 4v10M133 9h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </header>

        <form className="dp-card" onSubmit={handleSubmit} noValidate>
          {saveError && (
            <div className="alert alert-error" role="alert">
              <span>{saveError.message}</span>
              {saveError.retryable && (
                <button type="button" className="dp-retry-btn" onClick={saveError.retry || saveProfile} disabled={saving}>
                  <RefreshCw size={13} /> Retry
                </button>
              )}
            </div>
          )}
          {profileError && (
            <div className="alert alert-error" role="alert">
              <span>{profileError}</span>
              <button type="button" className="dp-retry-btn" onClick={loadEverything}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}
          {!hasProfile && !profileError && !editing && (
            <div className="dp-callout">
              <Stethoscope size={18} />
              <div>
                <strong>Your professional profile is not set up yet.</strong>
                <p>Add your specialization, qualifications and experience so patients can find accurate information about you.</p>
              </div>
              <button type="button" className="btn btn-green" onClick={requestEditing} disabled={Boolean(accountError)}>Create Profile</button>
            </div>
          )}

          <ProfileSection icon={User} title="Basic Information" action={editDetailsButton}>
            {accountError ? (
              <div className="alert alert-error" role="alert">
                <span>{accountError}</span>
                <button type="button" className="dp-retry-btn" onClick={loadEverything}><RefreshCw size={13} /> Retry</button>
              </div>
            ) : editing ? (
              <div className="dp-form-grid dp-form-grid-3">
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="fullName">Full Name</label>
                  <input id="fullName" name="fullName" className={inputClass('fullName')} value={accountForm.fullName} onChange={handleAccountChange} />
                  {fieldError('fullName')}
                </div>
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="email">Email Address</label>
                  <input id="email" name="email" type="email" className="form-input" value={accountForm.email} readOnly style={{ opacity: 0.7 }} />
                  <span className="dp-field-hint">Email cannot be changed.</span>
                </div>
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="mobileNumber">Mobile Number</label>
                  <input id="mobileNumber" name="mobileNumber" type="tel" className={inputClass('mobileNumber')} value={accountForm.mobileNumber} onChange={handleAccountChange} />
                  {fieldError('mobileNumber')}
                </div>
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="landPhoneNumber">Land Phone Number (Optional)</label>
                  <input id="landPhoneNumber" name="landPhoneNumber" type="tel" className={inputClass('landPhoneNumber')} value={accountForm.landPhoneNumber} onChange={handleAccountChange} />
                  {fieldError('landPhoneNumber')}
                </div>
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="dateOfBirth">Date of Birth</label>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" className={inputClass('dateOfBirth')} value={accountForm.dateOfBirth} onChange={handleAccountChange} />
                  {fieldError('dateOfBirth')}
                </div>
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="gender">Gender</label>
                  <select id="gender" name="gender" className={`form-select${errors.gender ? ' has-error' : ''}`} value={accountForm.gender} onChange={handleAccountChange}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {fieldError('gender')}
                </div>
                <div className="dp-editor-field dp-editor-field-wide">
                  <label className="form-label" htmlFor="address">Address</label>
                  <input id="address" name="address" className={inputClass('address')} value={accountForm.address} onChange={handleAccountChange} />
                  {fieldError('address')}
                </div>
              </div>
            ) : (
              <div className="dp-info-grid">
                <ProfileInfoField icon={User} label="Full Name" value={fullName} />
                <ProfileInfoField icon={Mail} label="Email Address" value={asText(account?.email ?? account?.Email)} />
                <ProfileInfoField icon={Phone} label="Mobile Number" value={asText(account?.mobileNumber ?? account?.MobileNumber)} />
                <ProfileInfoField icon={PhoneCall} label="Land Phone Number" value={asText(account?.landPhoneNumber ?? account?.LandPhoneNumber)} />
                <ProfileInfoField icon={MapPin} label="Address" value={asText(account?.address ?? account?.Address)} />
                <ProfileInfoField icon={Calendar} label="Date of Birth" value={formatDate(account?.dateOfBirth ?? account?.DateOfBirth)} />
                <ProfileInfoField icon={UserRound} label="Gender" value={asText(account?.gender ?? account?.Gender)} />
              </div>
            )}
          </ProfileSection>

          <ProfileSection icon={Stethoscope} title="Specialization" tone="red" action={editSpecializationButton}>
            {editing ? (
              <div className="dp-form-grid">
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="specialization">Specialization</label>
                  <input
                    id="specialization"
                    name="specialization"
                    className={inputClass('specialization')}
                    value={form.specialization}
                    placeholder="e.g. General Practitioner"
                    maxLength={100}
                    onChange={handleFieldChange}
                  />
                  {fieldError('specialization')}
                </div>
                <div className="dp-editor-field">
                  <label className="form-label" htmlFor="registrationNumber">Medical Registration Number</label>
                  <input
                    id="registrationNumber"
                    name="registrationNumber"
                    className={inputClass('registrationNumber')}
                    value={form.registrationNumber}
                    placeholder="e.g. SLMC-12345"
                    maxLength={50}
                    onChange={handleFieldChange}
                  />
                  {fieldError('registrationNumber')}
                </div>
                <div className="dp-editor-field dp-editor-field-wide">
                  <label className="form-label" htmlFor="biography">Professional Summary (optional)</label>
                  <textarea
                    id="biography"
                    name="biography"
                    className={`form-input dp-textarea${errors.biography ? ' has-error' : ''}`}
                    value={form.biography}
                    placeholder="A short summary patients will see on your profile"
                    maxLength={2000}
                    rows={4}
                    onChange={handleFieldChange}
                  />
                  <span className="dp-counter">{form.biography.length}/2000</span>
                  {fieldError('biography')}
                </div>
              </div>
            ) : hasProfile ? (
              <div className="dp-spec-block">
                <div className="dp-spec-pill">{profile.specialization}</div>
                <div className="dp-spec-meta">
                  <span className="dp-spec-meta-item">
                    <BadgeCheck size={14} aria-hidden="true" /> Reg. No. {profile.registrationNumber}
                  </span>
                </div>
                {profile.biography && (
                  <p className="dp-biography">
                    <FileText size={14} aria-hidden="true" /> {profile.biography}
                  </p>
                )}
              </div>
            ) : (
              <p className="dp-empty">No specialization added yet.</p>
            )}
          </ProfileSection>

          <ProfileSection icon={GraduationCap} title="Qualifications" action={addQualificationButton}>
            {editing ? (
              <>
                {fieldError('qualifications')}
                <CredentialListEditor
                  items={form.qualifications}
                  prefix="qualifications"
                  itemLabel="Qualification"
                  fields={[
                    { name: 'degree', label: 'Degree', placeholder: 'e.g. MBBS', maxLength: 100 },
                    { name: 'institution', label: 'Institution', placeholder: 'e.g. University of Colombo', maxLength: 150 },
                  ]}
                  errors={errors}
                  emptyMessage="No qualifications yet. Use Add Qualification to record your degrees."
                  onChange={updateListItem('qualifications')}
                  onRemove={removeListItem('qualifications')}
                />
              </>
            ) : (
              <CredentialList
                items={profile?.qualifications}
                titleKey="degree"
                subtitleKey="institution"
                itemLabel="Qualification"
                emptyMessage="No qualifications added yet."
                onRemove={requestRemoval('qualifications', 'Qualification')}
                disabled={saving}
              />
            )}
          </ProfileSection>

          <ProfileSection icon={Briefcase} title="Experience" action={addExperienceButton}>
            {editing ? (
              <>
                {fieldError('experiences')}
                <CredentialListEditor
                  items={form.experiences}
                  prefix="experiences"
                  itemLabel="Experience"
                  fields={[
                    { name: 'position', label: 'Position', placeholder: 'e.g. Senior Medical Officer', maxLength: 100 },
                    { name: 'organization', label: 'Organization', placeholder: 'e.g. District General Hospital, Colombo', maxLength: 150 },
                  ]}
                  errors={errors}
                  emptyMessage="No experience yet. Use Add Experience to record your positions."
                  onChange={updateListItem('experiences')}
                  onRemove={removeListItem('experiences')}
                />
              </>
            ) : (
              <CredentialList
                items={profile?.experiences}
                titleKey="position"
                subtitleKey="organization"
                itemLabel="Experience"
                emptyMessage="No experience added yet."
                onRemove={requestRemoval('experiences', 'Experience')}
                disabled={saving}
              />
            )}
          </ProfileSection>

          <ProfileSection icon={ClipboardList} title="Other" action={addOtherDetailButton}>
            {editing ? (
              <>
                {fieldError('otherDetails')}
                <CredentialListEditor
                  items={form.otherDetails}
                  prefix="otherDetails"
                  itemLabel="Other"
                  fields={[
                    { name: 'title', label: 'Title', placeholder: 'e.g. Member, Sri Lanka Medical Association', maxLength: 100 },
                    { name: 'details', label: 'Details (optional)', placeholder: 'e.g. award, membership, publication or training notes', maxLength: 300 },
                  ]}
                  errors={errors}
                  emptyMessage="Nothing added yet. Use Add Other for memberships, awards, publications or training."
                  onChange={updateListItem('otherDetails')}
                  onRemove={removeListItem('otherDetails')}
                />
              </>
            ) : (
              <CredentialList
                items={profile?.otherDetails}
                titleKey="title"
                subtitleKey="details"
                itemLabel="Other"
                emptyMessage="No other details added yet."
                onRemove={requestRemoval('otherDetails', 'Other detail')}
                disabled={saving}
              />
            )}
          </ProfileSection>

          {editing && (
            <div className="dp-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-green" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>

        <ConsultationFeeSection hasProfile={hasProfile} disabled={saving} />

        <AvailabilityManager hasProfile={hasProfile} disabled={saving} />
      </div>

      <ConfirmDialog
        open={showEditConfirm}
        title={hasProfile ? 'Edit your profile?' : 'Create your professional profile?'}
        message="You will be able to update your account details, specialization, qualifications and experience. Nothing is saved until you confirm your changes."
        confirmLabel={hasProfile ? 'Yes, Edit' : 'Yes, Create'}
        onConfirm={startEditing}
        onCancel={() => { setShowEditConfirm(false); setPendingAdd(null); }}
      />

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title={pendingRemoval ? `Remove this ${pendingRemoval.label.toLowerCase()}?` : ''}
        message="It will be removed from your professional profile immediately."
        confirmLabel="Yes, Remove"
        danger
        busy={saving}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your specialization?"
        message="A doctor profile cannot exist without a specialization, so this deletes your whole professional profile: specialization, registration number, summary, qualifications and experience. Your account details (name, contact, photo) are not affected."
        confirmLabel="Yes, Delete"
        danger
        busy={saving}
        onConfirm={deleteProfessionalProfile}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={showSaveConfirm}
        title="Save profile changes?"
        message="Your account details and professional profile will be updated."
        confirmLabel="Yes, Save"
        busy={saving}
        onConfirm={saveProfile}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </div>
  );
};

export default DoctorProfilePage;
