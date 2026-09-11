import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import userApi from '../api/userApi';
import { Search, CheckCircle, XCircle, RefreshCw, Eye, X } from 'lucide-react';

const ASSIGNABLE_ROLES = ['Patient', 'PharmacyStaff', 'Doctor'];

const ROLE_LABELS = {
  Patient: 'Patient',
  PharmacyStaff: 'Pharmacy Staff',
  Doctor: 'Doctor',
  Admin: 'Admin',
};

const getBadgeClass = (role) => {
  switch (role) {
    case 'Patient': return 'badge-patient';
    case 'Doctor': return 'badge-doctor';
    case 'PharmacyStaff': return 'badge-pharmacy';
    case 'Admin': return 'badge-admin';
    default: return 'badge-patient';
  }
};

const extractErrorMessage = (err, fallback) => err?.response?.data?.message || fallback;

const formatDate = (value) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
};

const asText = (value) => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  return value;
};

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');

  const [rowBusy, setRowBusy] = useState({});
  const [rowError, setRowError] = useState({});

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  const fetchUsers = async (search) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await userApi.getAllUsers(search);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(extractErrorMessage(err, 'Failed to load users. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers('');
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const term = searchInput.trim();
    setAppliedSearch(term);
    fetchUsers(term);
  };

  const handleRoleChange = async (userId, newRole) => {
    setRowError((prev) => ({ ...prev, [userId]: '' }));
    setRowBusy((prev) => ({ ...prev, [userId]: true }));
    try {
      const updated = await userApi.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [userId]: extractErrorMessage(err, 'Failed to update role. Please try again.'),
      }));
    } finally {
      setRowBusy((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    setRowError((prev) => ({ ...prev, [userId]: '' }));
    setRowBusy((prev) => ({ ...prev, [userId]: true }));
    try {
      const updated = await userApi.toggleUserStatus(userId, !currentStatus);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: updated.isActive } : u)));
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [userId]: extractErrorMessage(err, 'Failed to update account status. Please try again.'),
      }));
    } finally {
      setRowBusy((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const requestRoleChange = (user, newRole) => {
    if (newRole === user.role) return;
    setPendingRoleChange({ userId: user.id, fullName: user.fullName, currentRole: user.role, newRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return;
    const { userId, newRole } = pendingRoleChange;
    setPendingRoleChange(null);
    await handleRoleChange(userId, newRole);
  };

  const requestStatusToggle = (user) => {
    setPendingStatusChange({ userId: user.id, fullName: user.fullName, currentStatus: user.isActive });
  };

  const confirmStatusToggle = async () => {
    if (!pendingStatusChange) return;
    const { userId, currentStatus } = pendingStatusChange;
    setPendingStatusChange(null);
    await handleToggleStatus(userId, currentStatus);
  };

  const handleViewUser = async (userId) => {
    setSelectedUserId(userId);
    setUserDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await userApi.getUserById(userId);
      setUserDetail(data);
    } catch (err) {
      setDetailError(extractErrorMessage(err, 'Failed to load user details. Please try again.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedUserId(null);
    setUserDetail(null);
    setDetailError('');
  };

  const filteredUsers = users.filter((u) => selectedRole === 'All' || u.role === selectedRole);

  return (
    <DashboardLayout>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>User Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>View registered users, assign roles, and manage account status</p>
        </div>
        <button onClick={() => fetchUsers(appliedSearch)} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh List
        </button>
      </div>

      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.75rem' }}
              placeholder="Search by full name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select
              className="form-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="Patient">Patient</option>
              <option value="Doctor">Doctor</option>
              <option value="PharmacyStaff">Pharmacy Staff</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={16} /> Search
          </button>
        </form>
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}

      <div className="glass-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Mobile Number</th>
                <th>Role</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ textAlign: 'center' }}>
                    {appliedSearch
                      ? `No matching user found for "${appliedSearch}".`
                      : 'No users to show yet.'}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ textAlign: 'center' }}>
                    Loading users...
                  </td>
                </tr>
              )}
              {!loading && filteredUsers.map((u) => {
                const busy = Boolean(rowBusy[u.id]);
                const error = rowError[u.id];
                const canReassignRole = u.role !== 'Admin';

                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.mobileNumber}</td>
                    <td>
                      {canReassignRole ? (
                        <select
                          className="form-select"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => requestRoleChange(u, e.target.value)}
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${getBadgeClass(u.role)}`}>{ROLE_LABELS[u.role]}</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => requestStatusToggle(u)}
                        disabled={busy}
                        style={{ background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                      >
                        {u.isActive ? (
                          <span className="badge badge-patient"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Active</span>
                        ) : (
                          <span className="badge badge-pharmacy"><XCircle size={12} style={{ marginRight: '4px' }} /> Inactive</span>
                        )}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleViewUser(u.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        <Eye size={14} /> View
                      </button>
                      {error && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                          {error}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUserId && (
        <div className="user-detail-backdrop" onClick={closeDetail}>
          <div className="user-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="user-detail-header">
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>User Details</h2>
              <button type="button" className="icon-button" onClick={closeDetail} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {detailLoading && <p className="profile-status-text">Loading...</p>}
            {detailError && <div className="alert alert-error">{detailError}</div>}

            {userDetail && !detailLoading && (
              <>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Full Name</span>
                  <span className="user-detail-row-value">{asText(userDetail.fullName)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Email Address</span>
                  <span className="user-detail-row-value">{asText(userDetail.email)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Mobile Number</span>
                  <span className="user-detail-row-value">{asText(userDetail.mobileNumber)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Land Phone Number</span>
                  <span className="user-detail-row-value">{asText(userDetail.landPhoneNumber)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Address</span>
                  <span className="user-detail-row-value">{asText(userDetail.address)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Date of Birth</span>
                  <span className="user-detail-row-value">{formatDate(userDetail.dateOfBirth)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Gender</span>
                  <span className="user-detail-row-value">{asText(userDetail.gender)}</span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Role</span>
                  <span className="user-detail-row-value">
                    <span className={`badge ${getBadgeClass(userDetail.role)}`}>{ROLE_LABELS[userDetail.role] || userDetail.role}</span>
                  </span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Account Status</span>
                  <span className="user-detail-row-value">
                    {userDetail.isActive ? (
                      <span className="badge badge-patient"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Active</span>
                    ) : (
                      <span className="badge badge-pharmacy"><XCircle size={12} style={{ marginRight: '4px' }} /> Inactive</span>
                    )}
                  </span>
                </div>
                <div className="user-detail-row">
                  <span className="user-detail-row-label">Registered On</span>
                  <span className="user-detail-row-value">{formatDate(userDetail.createdAt)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRoleChange)}
        title="Change user role?"
        message={
          pendingRoleChange
            ? `Change ${pendingRoleChange.fullName}'s role from ${ROLE_LABELS[pendingRoleChange.currentRole]} to ${ROLE_LABELS[pendingRoleChange.newRole]}?`
            : ''
        }
        confirmLabel="Change Role"
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        title={pendingStatusChange?.currentStatus ? 'Deactivate account?' : 'Activate account?'}
        message={
          pendingStatusChange
            ? `Are you sure you want to ${pendingStatusChange.currentStatus ? 'deactivate' : 'activate'} ${pendingStatusChange.fullName}'s account?`
            : ''
        }
        confirmLabel={pendingStatusChange?.currentStatus ? 'Deactivate' : 'Activate'}
        danger={Boolean(pendingStatusChange?.currentStatus)}
        onConfirm={confirmStatusToggle}
        onCancel={() => setPendingStatusChange(null)}
      />
    </DashboardLayout>
  );
};

export default UserManagementPage;
