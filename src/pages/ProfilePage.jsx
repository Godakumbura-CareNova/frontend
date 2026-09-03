import React, { useEffect, useMemo, useState } from 'react';
import profileApi from '../api/profileApi';

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
  if (value === null || value === undefined) {
    return 'Not provided';
  }

  const text = String(value).trim();
  return text.length > 0 ? text : 'Not provided';
};

const formatDate = (value) => {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not provided';
  }

  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const ProfilePage = ({ previewMode = false }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (previewMode) {
        setProfile(PREVIEW_PROFILE);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await profileApi.getProfile();
        if (!cancelled) {
          setProfile(data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load profile. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [previewMode]);

  const profilePictureUrl = useMemo(() => {
    if (!profile) {
      return DEFAULT_AVATAR;
    }

    const hasPicture = Boolean(profile.hasProfilePicture ?? profile.HasProfilePicture);
    const uploadedUrl = profile.profilePictureUrl ?? profile.ProfilePictureUrl;

    return hasPicture && typeof uploadedUrl === 'string' && uploadedUrl.trim().length > 0
      ? uploadedUrl
      : DEFAULT_AVATAR;
  }, [profile]);

  if (loading) {
    return (
      <div className="container profile-shell">
        <div className="glass-card profile-card">
          <p className="profile-status-text">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container profile-shell">
        <div className="glass-card profile-card">
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
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
          <img
            src={profilePictureUrl}
            alt="Customer profile"
            className="profile-avatar-image"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_AVATAR;
            }}
          />
          <div>
            <h1 className="profile-title">Customer Profile</h1>
            <p className="profile-subtitle">Your account details</p>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="profile-field">
            <span className="profile-field-label">Full Name</span>
            <span className="profile-field-value">{fullName}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Email Address</span>
            <span className="profile-field-value">{email}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Mobile Number</span>
            <span className="profile-field-value">{mobileNumber}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Land Phone Number</span>
            <span className="profile-field-value">{landPhoneNumber}</span>
          </div>

          <div className="profile-field profile-field-full">
            <span className="profile-field-label">Address</span>
            <span className="profile-field-value">{address}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Date of Birth</span>
            <span className="profile-field-value">{dateOfBirth}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Gender</span>
            <span className="profile-field-value">{gender}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
