import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiGrid,
  FiUsers,
  FiClock,
  FiCalendar,
  FiFileText,
  FiFolder,
  FiCheckSquare,
  FiBell,
  FiSettings,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiShield,
  FiAward,
  FiUser,
  FiKey,
  FiUserCheck,
} from 'react-icons/fi';

export const MainLayout = ({ children, title = 'Dashboard', subtitle = '' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState('profile'); // 'profile' | 'password'

  // Self Profile Form
  const [profileForm, setProfileForm] = useState({
    phone: '',
    address: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
    },
  });

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenProfileModal = () => {
    setProfileTab('profile');
    setProfileForm({
      phone: user?.phone || '',
      address: user?.address || '',
      emergencyContact: {
        name: user?.emergencyContact?.name || '',
        relationship: user?.emergencyContact?.relationship || '',
        phone: user?.emergencyContact?.phone || '',
      },
    });
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowProfileModal(true);
  };

  const handleUpdateSelfProfile = async (e) => {
    e.preventDefault();
    if (!user?._id) return;
    try {
      const res = await api.put(`/users/${user._id}`, profileForm);
      if (res.data?.success) {
        toast.success(res.data.message || 'Profile updated successfully.');
        setShowProfileModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.warning('Please enter current and new password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.warning('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.warning('New password and confirmation do not match.');
      return;
    }

    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Password changed successfully!');
        setShowProfileModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    }
  };

  const role = user?.role || 'Employee';

  // Role based navigation items
  const navItems = [
    {
      title: 'Dashboard',
      to: role === 'Admin' ? '/admin/dashboard' : role === 'Manager' ? '/manager/dashboard' : '/employee/dashboard',
      icon: <FiGrid className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: 'Employees Directory',
      to: '/employees',
      icon: <FiUsers className="nav-icon" />,
      roles: ['Admin', 'Manager'],
    },
    {
      title: 'Manager Management',
      to: '/managers',
      icon: <FiUserCheck className="nav-icon" />,
      roles: ['Admin'],
    },
    {
      title: role === 'Admin' || role === 'Manager' ? 'Attendance Logs' : 'My Attendance',
      to: role === 'Admin' || role === 'Manager' ? '/attendance/all' : '/attendance/my',
      icon: <FiClock className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: role === 'Admin' || role === 'Manager' ? 'Leave Requests' : 'My Leave',
      to: '/leaves',
      icon: <FiCalendar className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: role === 'Admin' || role === 'Manager' ? 'Work Reports' : 'Daily Updates',
      to: '/work-updates',
      icon: <FiFileText className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: 'Projects & Tasks',
      to: '/projects',
      icon: <FiFolder className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: 'Company Calendar',
      to: '/calendar',
      icon: <FiAward className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: 'Announcements',
      to: '/announcements',
      icon: <FiBell className="nav-icon" />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      title: 'Reports & Export',
      to: '/reports',
      icon: <FiCheckSquare className="nav-icon" />,
      roles: ['Admin', 'Manager'],
    },
    {
      title: 'System Settings',
      to: '/settings',
      icon: <FiSettings className="nav-icon" />,
      roles: ['Admin'],
    },
    {
      title: 'Audit Logs',
      to: '/audit-logs',
      icon: <FiShield className="nav-icon" />,
      roles: ['Admin'],
    },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <div className="sidebar-brand">
              <div className="logo-icon">OP</div>
              <span>One Planet</span>
            </div>
          )}
          <button
            className="btn btn-link text-white p-0 border-0 d-none d-lg-block"
            onClick={() => setCollapsed(!collapsed)}
            title="Toggle sidebar"
          >
            {collapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
          </button>
        </div>

        <ul className="sidebar-nav">
          {navItems
            .filter((item) => item.roles.includes(role))
            .map((item, idx) => (
              <li key={idx} className="sidebar-nav-item">
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.title : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.icon}
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </li>
            ))}
        </ul>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-footer">
          <div
            className="sidebar-user-pill"
            style={{ cursor: 'pointer' }}
            onClick={handleOpenProfileModal}
            title="Click to view My Profile & Settings"
          >
            <div className="sidebar-user-avatar">
              {user?.fullName ? user.fullName.charAt(0) : 'U'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-grow-1">
                <div className="text-white fw-semibold text-truncate small">{user?.fullName}</div>
                <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>
                  {user?.role} • {user?.employeeId}
                </div>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="btn btn-link text-danger p-1 ms-auto"
              title="Logout"
            >
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="main-wrapper">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="d-flex align-items-center gap-3">
            <button
              className="top-nav-icon-btn d-lg-none"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <FiMenu size={20} />
            </button>
            <div className="nav-title-group">
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>

          <div className="nav-actions">
            <button
              onClick={handleOpenProfileModal}
              className="top-nav-icon-btn"
              title="My Profile & Settings"
            >
              <FiUser size={18} />
            </button>
            <NavLink to="/announcements" className="top-nav-icon-btn" title="Announcements & Notifications">
              <FiBell size={18} />
              <span className="badge-dot"></span>
            </NavLink>
            <button onClick={handleLogout} className="btn-opt-secondary d-none d-sm-inline-flex">
              <FiLogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-container">{children}</main>
      </div>

      {/* ================= MY PROFILE & SETTINGS MODAL ================= */}
      {showProfileModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-light pb-2">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center"
                    style={{ width: 44, height: 44, fontSize: 18 }}
                  >
                    {user?.fullName?.charAt(0)}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0">{user?.fullName}</h5>
                    <div className="text-muted small">
                      {user?.designation} • <span className="fw-semibold text-primary">{user?.employeeId}</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowProfileModal(false)}></button>
              </div>

              {/* Tabs */}
              <div className="px-4 pt-2 border-bottom bg-light">
                <ul className="nav nav-pills gap-2 pb-2">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${profileTab === 'profile' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setProfileTab('profile')}
                    >
                      <FiUser className="me-1" /> My Profile & Contact
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${profileTab === 'password' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setProfileTab('password')}
                    >
                      <FiKey className="me-1" /> Change Password
                    </button>
                  </li>
                </ul>
              </div>

              {profileTab === 'profile' ? (
                <form onSubmit={handleUpdateSelfProfile}>
                  <div className="modal-body p-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    {/* Read-Only Corporate Record */}
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom">
                      Corporate Record (Read-Only)
                    </h6>
                    <div className="row g-2 mb-4 small">
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Corporate Email:</span>
                        <span className="fw-semibold text-dark">{user?.email}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">System Role:</span>
                        <span className="fw-semibold text-primary">{user?.role}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Department:</span>
                        <span className="fw-semibold text-dark">{user?.department?.name || 'Unassigned'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Reporting Manager:</span>
                        <span className="fw-semibold text-dark">{user?.reportingManager?.fullName || 'None'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Assigned Team:</span>
                        <span className="fw-semibold text-dark">{user?.assignedTeam?.name || 'Core Operations'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Shift Timing:</span>
                        <span className="fw-semibold text-dark">
                          {user?.shiftTiming?.startTime || '09:30'} - {user?.shiftTiming?.endTime || '18:30'}
                        </span>
                      </div>
                    </div>

                    {/* Editable Contact & Emergency Fields */}
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom">
                      Editable Contact Information
                    </h6>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Phone Number</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="+91 98765 43210"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Current Address</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Apartment, Street, City"
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        />
                      </div>

                      <div className="col-12 mt-3">
                        <span className="small fw-bold text-muted text-uppercase">Emergency Contact</span>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Contact Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Contact person name"
                          value={profileForm.emergencyContact.name}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              emergencyContact: { ...profileForm.emergencyContact, name: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Relationship</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Spouse, Parent"
                          value={profileForm.emergencyContact.relationship}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              emergencyContact: { ...profileForm.emergencyContact, relationship: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Emergency Phone</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="+91 98765 00000"
                          value={profileForm.emergencyContact.phone}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              emergencyContact: { ...profileForm.emergencyContact, phone: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer bg-light">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Profile Updates
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleChangePasswordSubmit}>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Current Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        required
                        placeholder="Enter your current password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">New Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        required
                        placeholder="Min 6 characters"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Confirm New Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        required
                        placeholder="Repeat new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="modal-footer bg-light">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Change Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
