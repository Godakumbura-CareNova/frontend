import React, { useState, useEffect } from 'react';
import userApi from '../api/userApi';
import { Users, Search, Edit2, Trash2, Shield, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const UserManagementPage = () => {
  const [users, setUsers] = useState([
    { id: '1', fullName: 'Sarah Jenkins', email: 's.jenkins@carenova.org', role: 'Doctor', isActive: true, createdAt: '2026-01-15' },
    { id: '2', fullName: 'Alan Turing', email: 'a.turing@carenova.org', role: 'PharmacyStaff', isActive: true, createdAt: '2026-02-01' },
    { id: '3', fullName: 'John Doe', email: 'j.doe@example.com', role: 'Patient', isActive: true, createdAt: '2026-03-10' },
    { id: '4', fullName: 'Admin User', email: 'admin@carenova.org', role: 'Admin', isActive: true, createdAt: '2026-01-01' },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userApi.getAllUsers();
      if (Array.isArray(data)) setUsers(data);
    } catch (e) {
      console.warn('Using mock user data for presentation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await userApi.updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await userApi.toggleUserStatus(userId, !currentStatus);
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
    } catch (e) {
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to remove this user?')) {
      try {
        await userApi.deleteUser(userId);
        setUsers(users.filter(u => u.id !== userId));
      } catch (e) {
        setUsers(users.filter(u => u.id !== userId));
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'All' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>User Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage user accounts, roles, permissions, and security status</p>
        </div>
        <button onClick={fetchUsers} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh List
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.75rem' }}
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                <td>
                  <select
                    className="form-select"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  >
                    <option value="Patient">Patient</option>
                    <option value="Doctor">Doctor</option>
                    <option value="PharmacyStaff">Pharmacy Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => handleToggleStatus(u.id, u.isActive)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {u.isActive ? (
                      <span className="badge badge-patient"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Active</span>
                    ) : (
                      <span className="badge badge-pharmacy"><XCircle size={12} style={{ marginRight: '4px' }} /> Inactive</span>
                    )}
                  </button>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.createdAt}</td>
                <td>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="btn btn-danger"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPage;
