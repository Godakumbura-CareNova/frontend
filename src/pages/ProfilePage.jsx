import React, { useEffect, useMemo, useState } from 'react';
import { Save, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import profileApi from '../api/profileApi';
import { validateProfileForm } from '../utils/validation';

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#f2f2f2"/>' +
    '<circle cx="100" cy="78" r="34" fill="#c8c8c8"/>' +
    '<path d="M34 176c7-34 32-53 66-53s59 19 66 53" fill="#c8c8c8"/>' +
    '</svg>'
  );

const PREVIEW_PROFILE = {
  fullName: 'GCN17 View User',
  email: 'gcn17.view@example.com',
  mobileNumber: '0771234567',
  landPhoneNumber: null,
  address: '45 Lake Road',
  dateOfBirth: '1995-05-10T00:00:00',
  gender: 'Male',
  hasProfilePicture: false,
  profilePictureUrl: null,
};

const asText = (value) => {
  if (value === null || value === undefined) return 'Not provided';

  const text = String(value).trim();
  return text.length > 0 ? text : 'Not provided';
};

const formatDate = (value) => {
  if (!value) return 'Not provided';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';

  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const toDateInputValue = (value) => (value ? String(value).slice(0, 10) : '');

const toEditableProfile = (data) => ({
  fullName: data?.fullName ?? data?.FullName ?? data?.name ?? data?.Name ?? '',
  email: data?.email ?? data?.Email ?? '',
  mobileNumber: data?.mobileNumber ?? data?.MobileNumber ?? '',
  landPhoneNumber: data?.landPhoneNumber ?? data?.LandPhoneNumber ?? '',
  address: data?.address ?? data?.Address ?? '',
  dateOfBirth: toDateInputValue(data?.dateOfBirth ?? data?.DateOfBirth),
  gender: data?.gender ?? data?.Gender ?? '',
});

const ProfilePage = ({ previewMode = false }) => {
  const { user, role, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editableProfile, setEditableProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (previewMode) {
        setProfile(PREVIEW_PROFILE);
        setEditableProfile(toEditableProfile(PREVIEW_PROFILE));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await profileApi.getProfile();
        if (!cancelled) {
          setProfile(data || null);
          setEditableProfile(toEditableProfile(data));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.response?.data?.message || 'Failed to load profile. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [previewMode]);

  const profilePictureUrl = useMemo(() => {
    if (!profile) return DEFAULT_AVATAR;

    const hasPicture = Boolean(profile.hasProfilePicture ?? profile.HasProfilePicture);
    const uploadedUrl = profile.profilePictureUrl ?? profile.ProfilePictureUrl;
    return hasPicture && typeof uploadedUrl === 'string' && uploadedUrl.trim().length > 0
      ? uploadedUrl
      : DEFAULT_AVATAR;
  }, [profile]);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setEditableProfile((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: null }));
  };

  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    setSuccessMessage('');
    setError('');

    const validation = validateProfileForm(editableProfile);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      const updateRequest = {
        fullName: editableProfile.fullName.trim(),
        mobileNumber: editableProfile.mobileNumber.trim(),
        landPhoneNumber: editableProfile.landPhoneNumber.trim() || null,
        address: editableProfile.address.trim(),
        dateOfBirth: editableProfile.dateOfBirth,
        gender: editableProfile.gender,
      };
      const updatedProfile = await profileApi.updateProfile(updateRequest);
      setProfile(updatedProfile);
      setEditableProfile(toEditableProfile(updatedProfile));
      setUser({ ...user, fullName: updateRequest.fullName });
      setSuccessMessage('Profile updated successfully!');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container profile-shell"><div className="glass-card profile-card"><p className="profile-status-text">Loading profile...</p></div></div>;
  }

  if (error && !profile) {
    return <div className="container profile-shell"><div className="glass-card profile-card"><div className="alert alert-error">{error}</div></div></div>;
  }

  const fullName = asText(profile?.fullName ?? profile?.FullName ?? profile?.name ?? profile?.Name);
  const email = asText(profile?.email ?? profile?.Email);
  const mobileNumber = asText(profile?.mobileNumber ?? profile?.MobileNumber);
  const landPhoneNumber = asText(profile?.landPhoneNumber ?? profile?.LandPhoneNumber);
  const address = asText(profile?.address ?? profile?.Address);
  const dateOfBirth = formatDate(profile?.dateOfBirth ?? profile?.DateOfBirth);
  const gender = asText(profile?.gender ?? profile?.Gender);

  return (
    <div className="container profile-shell">
      <div className="glass-card profile-card">
        <div className="profile-header">
          <img src={profilePictureUrl} alt="Customer profile" className="profile-avatar-image" onError={(event) => { event.currentTarget.src = DEFAULT_AVATAR; }} />
          <div>
            <h1 className="profile-title">Customer Profile</h1>
            <p className="profile-subtitle">Your account details</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMessage && <div className="alert alert-success">{successMessage}</div>}

        <div className="grid grid-2">
          <div className="profile-field"><span className="profile-field-label">Full Name</span><span className="profile-field-value">{fullName}</span></div>
          <div className="profile-field"><span className="profile-field-label">Email Address</span><span className="profile-field-value">{email}</span></div>
          <div className="profile-field"><span className="profile-field-label">Mobile Number</span><span className="profile-field-value">{mobileNumber}</span></div>
          <div className="profile-field"><span className="profile-field-label">Land Phone Number</span><span className="profile-field-value">{landPhoneNumber}</span></div>
          <div className="profile-field profile-field-full"><span className="profile-field-label">Address</span><span className="profile-field-value">{address}</span></div>
          <div className="profile-field"><span className="profile-field-label">Date of Birth</span><span className="profile-field-value">{dateOfBirth}</span></div>
          <div className="profile-field"><span className="profile-field-label">Gender</span><span className="profile-field-value">{gender}</span></div>
        </div>

        <form onSubmit={handleProfileUpdate} style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <User color="var(--primary)" size={24} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Profile</h2>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-email">Email Address</label>
            <input id="profile-email" type="email" className="form-input" value={editableProfile?.email || ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-role">Role</label>
            <input id="profile-role" type="text" className="form-input" value={role || ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <ProfileInput id="profile-full-name" label="Full Name" name="fullName" value={editableProfile?.fullName || ''} error={errors.fullName} onChange={handleProfileChange} />
          <ProfileInput id="profile-mobile-number" label="Mobile Number" name="mobileNumber" type="tel" value={editableProfile?.mobileNumber || ''} error={errors.mobileNumber} onChange={handleProfileChange} />
          <ProfileInput id="profile-land-phone-number" label="Land Phone Number (Optional)" name="landPhoneNumber" type="tel" value={editableProfile?.landPhoneNumber || ''} error={errors.landPhoneNumber} onChange={handleProfileChange} />
          <ProfileInput id="profile-address" label="Address" name="address" value={editableProfile?.address || ''} error={errors.address} onChange={handleProfileChange} />
          <ProfileInput id="profile-date-of-birth" label="Date of Birth" name="dateOfBirth" type="date" value={editableProfile?.dateOfBirth || ''} error={errors.dateOfBirth} onChange={handleProfileChange} />
          <div className="form-group">
            <label className="form-label" htmlFor="profile-gender">Gender</label>
            <select id="profile-gender" name="gender" className="form-select" value={editableProfile?.gender || ''} onChange={handleProfileChange}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {errors.gender && <span className="field-error">{errors.gender}</span>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

const ProfileInput = ({ id, label, name, type = 'text', value, error, onChange }) => (
  <div className="form-group">
    <label className="form-label" htmlFor={id}>{label}</label>
    <input id={id} type={type} name={name} className="form-input" value={value} onChange={onChange} />
    {error && <span className="field-error">{error}</span>}
  </div>
);

export default ProfilePage;