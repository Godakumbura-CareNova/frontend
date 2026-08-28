import React, { useEffect, useMemo, useRef, useState } from 'react';
import profileApi from '../api/profileApi';
import { validateProfilePictureFile, validateProfileForm } from '../utils/validation';
import { Camera, Pencil, X } from 'lucide-react';

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

const toDateInputValue = (value) => {
  if (!value) {
    return '';
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
};

const buildEditForm = (profile) => ({
  fullName: profile?.fullName ?? profile?.FullName ?? '',
  mobileNumber: profile?.mobileNumber ?? profile?.MobileNumber ?? '',
  landPhoneNumber: profile?.landPhoneNumber ?? profile?.LandPhoneNumber ?? '',
  address: profile?.address ?? profile?.Address ?? '',
  dateOfBirth: toDateInputValue(profile?.dateOfBirth ?? profile?.DateOfBirth),
  gender: profile?.gender ?? profile?.Gender ?? '',
});

const ProfilePage = ({ previewMode = false }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(buildEditForm(null));
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: '', text: '' });

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

    if (hasPicture && typeof uploadedUrl === 'string' && uploadedUrl.trim().length > 0) {
      return uploadedUrl;
    }

    return DEFAULT_AVATAR;
  }, [profile]);

  const uploadFile = async (file) => {
    setPictureError('');
    setUploading(true);

    try {
      const updatedProfile = await profileApi.uploadProfilePicture(file);
      setProfile(updatedProfile || null);
      setLastFile(null);
    } catch (err) {
      setPictureError(
        err?.response?.data?.message || 'Failed to upload the profile picture. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarEditClick = () => {
    if (uploading || previewMode) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) {
      return;
    }

    const validation = validateProfilePictureFile(file);
    if (!validation.isValid) {
      setPictureError(validation.error);
      setLastFile(null);
      return;
    }

    setLastFile(file);
    await uploadFile(file);
  };

  const handleRetry = () => {
    if (lastFile) {
      uploadFile(lastFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleStartEdit = () => {
    setEditForm(buildEditForm(profile));
    setEditErrors({});
    setEditMessage({ type: '', text: '' });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditErrors({});
    setEditMessage({ type: '', text: '' });
  };

  const handleEditFieldChange = (field) => (event) => {
    const { value } = event.target;
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditMessage({ type: '', text: '' });

    const { isValid, errors } = validateProfileForm(editForm);
    setEditErrors(errors);
    if (!isValid) {
      return;
    }

    setEditSaving(true);
    try {
      const updatedProfile = await profileApi.updateProfile({
        fullName: editForm.fullName.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        landPhoneNumber: editForm.landPhoneNumber.trim(),
        address: editForm.address.trim(),
        dateOfBirth: editForm.dateOfBirth,
        gender: editForm.gender,
      });
      setProfile(updatedProfile || null);
      setIsEditing(false);
    } catch (err) {
      setEditMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setEditSaving(false);
    }
  };

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

  const fullName = asText(profile?.fullName ?? profile?.FullName);
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
          <div className="profile-avatar-wrap">
            <img
              src={profilePictureUrl}
              alt="Customer profile"
              className="profile-avatar-image"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
            {!previewMode && (
              <button
                type="button"
                className={`profile-avatar-edit-btn${uploading ? ' uploading' : ''}`}
                onClick={handleAvatarEditClick}
                disabled={uploading}
                title={profile?.hasProfilePicture ? 'Change profile picture' : 'Add profile picture'}
                aria-label={profile?.hasProfilePicture ? 'Change profile picture' : 'Add profile picture'}
              >
                <Camera size={15} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="profile-picture-input"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          <div className="profile-header-text">
            <div className="profile-header-title-row">
              <h1 className="profile-title">Customer Profile</h1>
              {!previewMode && !isEditing && (
                <button type="button" className="profile-edit-toggle-btn" onClick={handleStartEdit}>
                  <Pencil size={13} />
                  Edit
                </button>
              )}
            </div>
            <p className="profile-subtitle">Your account details</p>
            {uploading && <p className="profile-picture-status">Uploading picture...</p>}
            {pictureError && (
              <div className="profile-picture-error">
                {pictureError}
                <button type="button" className="retry-link" onClick={handleRetry}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleEditSubmit} noValidate>
            {editMessage.text && (
              <div className={`alert alert-${editMessage.type}`}>{editMessage.text}</div>
            )}

            <div className="grid grid-2 profile-edit-grid">
              <div className="form-row">
                <label className="field-label" htmlFor="edit-fullName">Full Name</label>
                <input
                  id="edit-fullName"
                  className="field-input"
                  type="text"
                  value={editForm.fullName}
                  onChange={handleEditFieldChange('fullName')}
                />
                {editErrors.fullName && <span className="field-error">{editErrors.fullName}</span>}
              </div>

              <div className="form-row">
                <label className="field-label">Email Address</label>
                <input className="field-input" type="email" value={email} disabled />
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="edit-mobileNumber">Mobile Number</label>
                <input
                  id="edit-mobileNumber"
                  className="field-input"
                  type="text"
                  value={editForm.mobileNumber}
                  onChange={handleEditFieldChange('mobileNumber')}
                />
                {editErrors.mobileNumber && <span className="field-error">{editErrors.mobileNumber}</span>}
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="edit-landPhoneNumber">Land Phone Number</label>
                <input
                  id="edit-landPhoneNumber"
                  className="field-input"
                  type="text"
                  value={editForm.landPhoneNumber}
                  onChange={handleEditFieldChange('landPhoneNumber')}
                />
                {editErrors.landPhoneNumber && <span className="field-error">{editErrors.landPhoneNumber}</span>}
              </div>

              <div className="form-row form-row-single">
                <label className="field-label" htmlFor="edit-address">Address</label>
                <input
                  id="edit-address"
                  className="field-input"
                  type="text"
                  value={editForm.address}
                  onChange={handleEditFieldChange('address')}
                />
                {editErrors.address && <span className="field-error">{editErrors.address}</span>}
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="edit-dateOfBirth">Date of Birth</label>
                <input
                  id="edit-dateOfBirth"
                  className="field-input"
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={handleEditFieldChange('dateOfBirth')}
                />
                {editErrors.dateOfBirth && <span className="field-error">{editErrors.dateOfBirth}</span>}
              </div>

              <div className="form-row">
                <label className="field-label" htmlFor="edit-gender">Gender</label>
                <select
                  id="edit-gender"
                  className="field-input"
                  value={editForm.gender}
                  onChange={handleEditFieldChange('gender')}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {editErrors.gender && <span className="field-error">{editErrors.gender}</span>}
              </div>
            </div>

            <div className="profile-edit-actions">
              <button type="submit" className="submit-button" disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="profile-edit-cancel-btn"
                onClick={handleCancelEdit}
                disabled={editSaving}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </form>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
