import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import profileApi from '../api/profileApi';
import { User, Mail, Shield, Save, KeyRound, CheckCircle } from 'lucide-react';
import { validateProfileForm } from '../utils/validation';

const emptyProfile = {
  fullName: '',
  email: '',
  mobileNumber: '',
  landPhoneNumber: '',
  address: '',
  dateOfBirth: '',
  gender: '',
};

const toDateInputValue = (value) => (value ? String(value).slice(0, 10) : '');

const ProfilePage = () => {
  const { user, role, setUser } = useAuth();
  const [profile, setProfile] = useState({
    ...emptyProfile,
    fullName: user?.fullName || '',
    email: user?.email || '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const data = await profileApi.getProfile();
        if (!cancelled) {
          setProfile({
            fullName: data?.fullName ?? data?.FullName ?? '',
            email: data?.email ?? data?.Email ?? '',
            mobileNumber: data?.mobileNumber ?? data?.MobileNumber ?? '',
            landPhoneNumber: data?.landPhoneNumber ?? data?.LandPhoneNumber ?? '',
            address: data?.address ?? data?.Address ?? '',
            dateOfBirth: toDateInputValue(data?.dateOfBirth ?? data?.DateOfBirth),
            gender: data?.gender ?? data?.Gender ?? '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load profile.' });
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: null }));
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const validation = validateProfileForm(profile);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);

    try {
      const updateRequest = {
        fullName: profile.fullName.trim(),
        mobileNumber: profile.mobileNumber.trim(),
        landPhoneNumber: profile.landPhoneNumber.trim() || null,
        address: profile.address.trim(),
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
      };
      const updatedProfile = await profileApi.updateProfile(updateRequest);
      setProfile((current) => ({
        ...current,
        fullName: updatedProfile?.fullName ?? updatedProfile?.FullName ?? current.fullName,
        mobileNumber: updatedProfile?.mobileNumber ?? updatedProfile?.MobileNumber ?? current.mobileNumber,
        landPhoneNumber: updatedProfile?.landPhoneNumber ?? updatedProfile?.LandPhoneNumber ?? current.landPhoneNumber,
        address: updatedProfile?.address ?? updatedProfile?.Address ?? current.address,
        dateOfBirth: toDateInputValue(updatedProfile?.dateOfBirth ?? updatedProfile?.DateOfBirth ?? current.dateOfBirth),
        gender: updatedProfile?.gender ?? updatedProfile?.Gender ?? current.gender,
      }));
      setUser({ ...user, fullName: updateRequest.fullName });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      await profileApi.changePassword({ currentPassword, newPassword });
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>User Profile Settings</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage your personal details and authentication credentials</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-2">
        {/* Personal Info Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <User color="var(--primary)" size={24} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Personal Information</h2>
          </div>

          <form onSubmit={handleProfileUpdate}>
            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <input type="email" className="form-input" value={profile.email} readOnly style={{ opacity: 0.7 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <div>
                <span className={`badge badge-${role.toLowerCase()}`}>{role}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="fullName"
                className="form-input"
                value={profile.fullName}
                onChange={handleProfileChange}
              />
              {errors.fullName && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input type="tel" name="mobileNumber" className="form-input" value={profile.mobileNumber} onChange={handleProfileChange} />
              {errors.mobileNumber && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.mobileNumber}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Land Phone Number (Optional)</label>
              <input type="tel" name="landPhoneNumber" className="form-input" value={profile.landPhoneNumber} onChange={handleProfileChange} />
              {errors.landPhoneNumber && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.landPhoneNumber}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" name="address" className="form-input" value={profile.address} onChange={handleProfileChange} />
              {errors.address && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.address}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" name="dateOfBirth" className="form-input" value={profile.dateOfBirth} onChange={handleProfileChange} />
              {errors.dateOfBirth && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.dateOfBirth}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Gender</label>
              <select name="gender" className="form-select" value={profile.gender} onChange={handleProfileChange}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{errors.gender}</span>}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={18} /> Save Changes
            </button>
          </form>
        </div>

        {/* Security / Password Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <KeyRound color="var(--warning)" size={24} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Security & Password</h2>
          </div>

          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-secondary" disabled={loading}>
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
