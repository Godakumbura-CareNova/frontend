import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import profileApi from '../api/profileApi';
import { User, Mail, Shield, Save, KeyRound, CheckCircle } from 'lucide-react';

const ProfilePage = () => {
  const { user, role, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const updatedUser = await profileApi.updateProfile({ fullName });
      setUser({ ...user, fullName: fullName });
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
              <input type="email" className="form-input" value={email} disabled style={{ opacity: 0.7 }} />
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
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
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
