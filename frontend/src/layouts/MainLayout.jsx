import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiGrid,
  FiUsers,
  FiClock,
  FiCalendar,
  FiFileText,
  FiBookOpen,
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
  FiSearch,
  FiX,
  FiChevronDown,
  FiAlertCircle,
  FiCheckCircle,
  FiMapPin,
  FiPhone,
  FiMail,
  FiBriefcase,
  FiInfo,
  FiLock,
  FiImage,
  FiCheck,
} from 'react-icons/fi';

export const MainLayout = ({ children, title = 'Dashboard', subtitle = '' }) => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Profile dropdown & banner states
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);
  const profileDropdownRef = useRef(null);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState('profile'); // 'profile' | 'password'
  const [profileSaving, setProfileSaving] = useState(false);

  // Close mobile drawer and dropdowns whenever route changes
  useEffect(() => {
    setMobileOpen(false);
    setShowProfileDropdown(false);
    setShowNotificationPanel(false);
    setShowMobileSearch(false);
  }, [location.pathname]);

  // Handle Escape key to close mobile drawer and dropdowns
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setShowProfileDropdown(false);
        setShowNotificationPanel(false);
        setShowMobileSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showProfileDropdown]);

  // Self Profile Form
  const [profileForm, setProfileForm] = useState({
    profilePicture: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bio: '',
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

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const notificationPanelRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const res = await api.get('/communication/notifications');
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(typeof res.data.unreadCount === 'number' ? res.data.unreadCount : 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const handleSync = () => fetchNotifications();
    window.addEventListener('notifications-updated', handleSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleSync);
    };
  }, []);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(event.target)
      ) {
        setShowNotificationPanel(false);
      }
    };
    if (showNotificationPanel) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showNotificationPanel]);

  const handleToggleNotificationPanel = () => {
    const nextState = !showNotificationPanel;
    setShowNotificationPanel(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      // Optimistically update UI immediately
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const res = await api.put('/communication/notifications/mark-read', { id: notificationId });
      if (res.data?.success && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistically update UI immediately
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      const res = await api.put('/communication/notifications/mark-read', {});
      if (res.data?.success && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
      toast.success('All notifications marked as read.');
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (item) => {
    if (!item.isRead) {
      await handleMarkAsRead(item._id);
    }
    setShowNotificationPanel(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const formatNotificationTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'Policy':
        return <FiBookOpen className="text-primary" size={15} />;
      case 'Announcement':
        return <FiBell className="text-warning" size={15} />;
      case 'Leave':
        return <FiCalendar className="text-info" size={15} />;
      case 'Attendance':
        return <FiClock className="text-success" size={15} />;
      default:
        return <FiInfo className="text-secondary" size={15} />;
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleOpenProfileModal = () => {
    setProfileTab('profile');
    setProfileForm({
      profilePicture: user?.profilePicture || '',
      phone: user?.phone || '',
      address: user?.address || '',
      dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.substring(0, 10) : '',
      bio: user?.bio || '',
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
    try {
      setProfileSaving(true);
      const res = await api.put('/auth/profile', profileForm);
      if (res.data?.success) {
        toast.success(res.data.message || 'Profile updated successfully.');
        if (res.data.user) {
          updateUser(res.data.user);
        }
        setShowProfileModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
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

  const handleQuickSearchSubmit = (e) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const term = quickSearch.trim();
    if (user?.role === 'Admin' || user?.role === 'Manager') {
      navigate(`/employees?search=${encodeURIComponent(term)}`);
    } else {
      navigate(`/projects`);
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
      title: 'Company Policies',
      to: '/policies',
      icon: <FiBookOpen className="nav-icon" />,
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
  ];

  return (
    <div className="app-layout">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          title="Close Navigation Drawer"
          aria-label="Close Navigation Drawer"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!collapsed ? (
            <div className="sidebar-brand">
              <div className="logo-icon">OP</div>
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">One Planet</span>
                <span className="sidebar-brand-tag">Enterprise CRM</span>
              </div>
            </div>
          ) : (
            <div className="sidebar-brand justify-content-center w-100">
              <div className="logo-icon">OP</div>
            </div>
          )}
          <button
            className="btn btn-link text-secondary p-0 border-0 d-none d-xl-block"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
          </button>
          <button
            className="btn btn-link text-secondary p-0 border-0 mobile-sidebar-toggle ms-auto"
            onClick={() => setMobileOpen(false)}
            title="Close Menu"
            aria-label="Close Menu"
          >
            <FiX size={20} />
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
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-grow-1">
                <div className="fw-semibold text-truncate small text-dark" style={{ lineHeight: 1.2 }}>
                  {user?.fullName}
                </div>
                <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
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
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="main-wrapper">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="d-flex align-items-center gap-2 gap-sm-3 overflow-hidden">
            <button
              className="top-nav-icon-btn mobile-sidebar-toggle flex-shrink-0"
              onClick={() => setMobileOpen(!mobileOpen)}
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <FiMenu size={18} />
            </button>
            <div className="nav-title-group text-truncate" style={{ minWidth: 0 }}>
              <h2 className="text-truncate">{title}</h2>
              {subtitle && <p className="text-truncate d-none d-md-block">{subtitle}</p>}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 gap-sm-3 flex-shrink-0">
            {/* Quick Search (Desktop / Tablet) */}
            <form onSubmit={handleQuickSearchSubmit} className="top-search-box d-none d-md-block">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search CRM..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
              />
            </form>

            <div className="nav-actions">
              {/* Quick Search Button (Mobile Only) */}
              <button
                type="button"
                onClick={() => setShowMobileSearch(!showMobileSearch)}
                className="top-nav-icon-btn d-md-none"
                title="Search CRM"
                aria-label="Search CRM"
              >
                <FiSearch size={16} />
              </button>
              {/* Profile Menu Dropdown */}
              <div className="position-relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="d-flex align-items-center gap-2 btn btn-link text-decoration-none p-1 border rounded-pill bg-white shadow-sm"
                  style={{ borderColor: 'var(--opt-border-light)' }}
                  title="User Profile Menu"
                >
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user.fullName}
                      className="rounded-circle"
                      style={{ width: 32, height: 32, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: '0.82rem',
                        backgroundColor:
                          user?.role === 'Admin'
                            ? 'var(--opt-forest)'
                            : user?.role === 'Manager'
                            ? '#0284C7'
                            : '#475569',
                      }}
                    >
                      {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="d-none d-md-block text-start pe-1" style={{ lineHeight: 1.1 }}>
                    <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.82rem', maxWidth: 110 }}>
                      {user?.fullName || 'User'}
                    </div>
                    <span
                      className="badge p-0"
                      style={{
                        fontSize: '0.68rem',
                        color:
                          user?.role === 'Admin'
                            ? 'var(--opt-forest)'
                            : user?.role === 'Manager'
                            ? '#0369a1'
                            : '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      {user?.role}
                    </span>
                  </div>
                  <FiChevronDown size={14} className="text-muted pe-1 d-none d-sm-inline" />
                </button>

                {/* Dropdown Menu Container */}
                {showProfileDropdown && (
                  <div
                    className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border p-0 top-nav-dropdown-panel"
                    style={{
                      width: 330,
                      maxWidth: 'calc(100vw - 20px)',
                      zIndex: 1050,
                      borderColor: 'var(--opt-border-light)',
                    }}
                  >
                    {/* Dropdown Header */}
                    <div className="p-3 border-bottom bg-light bg-opacity-50">
                      <div className="d-flex align-items-center gap-3">
                        {user?.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={user.fullName}
                            className="rounded-circle border"
                            style={{ width: 48, height: 48, objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center shadow-sm"
                            style={{
                              width: 48,
                              height: 48,
                              fontSize: 18,
                              backgroundColor:
                                user?.role === 'Admin'
                                  ? 'var(--opt-forest)'
                                  : user?.role === 'Manager'
                                  ? '#0284C7'
                                  : '#475569',
                            }}
                          >
                            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="overflow-hidden flex-grow-1">
                          <h6 className="m-0 fw-bold text-dark text-truncate">{user?.fullName}</h6>
                          <div className="text-muted small text-truncate" style={{ fontSize: '0.78rem' }}>
                            {user?.email}
                          </div>
                          <div className="d-flex align-items-center gap-1 mt-1">
                            <span
                              className={`badge ${
                                user?.role === 'Admin'
                                  ? 'bg-success'
                                  : user?.role === 'Manager'
                                  ? 'bg-primary'
                                  : 'bg-secondary'
                              }`}
                              style={{ fontSize: '0.68rem' }}
                            >
                              {user?.role}
                            </span>
                            <span className="badge bg-light text-dark border" style={{ fontSize: '0.68rem' }}>
                              {user?.employeeId}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Profile Completion Bar */}
                      <div className="mt-3 pt-2 border-top">
                        <div className="d-flex justify-content-between align-items-center small mb-1">
                          <span className="fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>
                            Profile Completion
                          </span>
                          <span className="fw-bold text-dark" style={{ fontSize: '0.75rem' }}>
                            {user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)}%
                          </span>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div
                            className={`progress-bar ${
                              (user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)) === 100
                                ? 'bg-success'
                                : (user?.profileCompletion?.percentage ?? 40) >= 60
                                ? 'bg-info'
                                : 'bg-warning'
                            }`}
                            style={{
                              width: `${user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detailed Corporate Meta */}
                    <div className="p-3 border-bottom small" style={{ fontSize: '0.8rem' }}>
                      <div className="d-flex justify-content-between py-1 border-bottom border-light">
                        <span className="text-muted">Designation:</span>
                        <span className="fw-semibold text-dark text-truncate" style={{ maxWidth: 170 }}>
                          {user?.designation || 'Specialist'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom border-light">
                        <span className="text-muted">Department:</span>
                        <span className="fw-semibold text-dark text-truncate" style={{ maxWidth: 170 }}>
                          {user?.department?.name || 'Operations'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom border-light">
                        <span className="text-muted">Contact:</span>
                        <span className="fw-semibold text-dark">{user?.phone || 'Not provided'}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom border-light">
                        <span className="text-muted">Joining Date:</span>
                        <span className="fw-semibold text-dark">
                          {user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between py-1">
                        <span className="text-muted">Reporting Manager:</span>
                        <span className="fw-semibold text-dark text-truncate" style={{ maxWidth: 170 }}>
                          {user?.reportingManager?.fullName || 'Direct'}
                        </span>
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="p-2">
                      <button
                        type="button"
                        className="dropdown-item d-flex align-items-center gap-2 p-2 rounded text-dark"
                        onClick={() => {
                          setShowProfileDropdown(false);
                          handleOpenProfileModal();
                        }}
                      >
                        <FiUser size={15} className="text-primary" />
                        <span className="small fw-semibold">View & Edit Profile</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item d-flex align-items-center gap-2 p-2 rounded text-dark"
                        onClick={() => {
                          setShowProfileDropdown(false);
                          handleOpenProfileModal();
                          setProfileTab('password');
                        }}
                      >
                        <FiKey size={15} className="text-secondary" />
                        <span className="small fw-semibold">Change Password</span>
                      </button>
                      <hr className="my-1" />
                      <button
                        type="button"
                        className="dropdown-item d-flex align-items-center gap-2 p-2 rounded text-danger"
                        onClick={() => {
                          setShowProfileDropdown(false);
                          handleLogout();
                        }}
                      >
                        <FiLogOut size={15} />
                        <span className="small fw-semibold">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Bell & Dropdown Panel */}
              <div className="position-relative" ref={notificationPanelRef}>
                <button
                  type="button"
                  onClick={handleToggleNotificationPanel}
                  className="top-nav-icon-btn shadow-none"
                  title="Notifications"
                  aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                >
                  <FiBell size={17} />
                  {unreadCount > 0 && (
                    <span
                      className="top-nav-badge-count"
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 18,
                        height: 18,
                        padding: '0 4px',
                        borderRadius: 9999,
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #FFFFFF',
                        lineHeight: 1,
                        boxShadow: '0 1px 3px rgba(220, 38, 38, 0.35)',
                      }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {showNotificationPanel && (
                  <div
                    className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border p-0 top-nav-dropdown-panel"
                    style={{
                      width: 360,
                      maxWidth: 'calc(100vw - 20px)',
                      zIndex: 1060,
                      borderColor: 'var(--opt-border, #E2E8F0)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    {/* Panel Header */}
                    <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-light bg-opacity-50">
                      <div className="d-flex align-items-center gap-2">
                        <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                          Notifications
                        </h6>
                        {unreadCount > 0 && (
                          <span
                            className="badge rounded-pill fw-semibold"
                            style={{
                              fontSize: '0.7rem',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                            }}
                          >
                            {unreadCount} unread
                          </span>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold"
                            style={{ fontSize: '0.76rem', color: 'var(--opt-forest, #0F5132)' }}
                            title="Mark all notifications as read"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowNotificationPanel(false)}
                          className="btn btn-sm btn-link p-0 text-muted shadow-none"
                          title="Close"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div
                      style={{
                        maxHeight: 380,
                        overflowY: 'auto',
                      }}
                    >
                      {notificationsLoading && notifications.length === 0 ? (
                        <div className="p-4 text-center">
                          <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-center text-muted">
                          <FiBell size={26} className="text-secondary opacity-50 mb-2" />
                          <div className="small fw-semibold text-dark">No notifications yet</div>
                          <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                            You will receive updates on policies, leaves and announcements here.
                          </div>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-2.5 px-3 border-bottom d-flex align-items-start gap-2.5 ${
                              !n.isRead ? 'bg-light bg-opacity-75' : 'bg-white'
                            }`}
                            style={{
                              cursor: 'pointer',
                              borderLeft: !n.isRead ? '3px solid var(--opt-forest, #0F5132)' : '3px solid transparent',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                              style={{
                                width: 32,
                                height: 32,
                                backgroundColor: !n.isRead ? '#E8F5E9' : '#F1F5F9',
                              }}
                            >
                              {getNotificationIcon(n.type)}
                            </div>
                            <div className="flex-grow-1 overflow-hidden">
                              <div className="d-flex align-items-center justify-content-between gap-1.5">
                                <span
                                  className={`small text-truncate ${!n.isRead ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}
                                  style={{ fontSize: '0.82rem' }}
                                >
                                  {n.title}
                                </span>
                                <span className="text-muted flex-shrink-0" style={{ fontSize: '0.68rem' }}>
                                  {formatNotificationTime(n.createdAt)}
                                </span>
                              </div>
                              <p
                                className="mb-1 text-muted"
                                style={{
                                  fontSize: '0.76rem',
                                  lineHeight: 1.35,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {n.message}
                              </p>
                              <div className="d-flex align-items-center justify-content-between pt-0.5">
                                <span
                                  className="badge bg-light text-secondary border py-0 px-1.5"
                                  style={{ fontSize: '0.65rem' }}
                                >
                                  {n.type || 'System'}
                                </span>
                                {!n.isRead && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkAsRead(n._id, e)}
                                    className="btn btn-link p-0 text-decoration-none small fw-semibold"
                                    style={{ fontSize: '0.72rem', color: 'var(--opt-forest, #0F5132)' }}
                                    title="Mark as read"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Panel Footer */}
                    <div className="p-2.5 px-3 border-top bg-light bg-opacity-50 text-center">
                      <NavLink
                        to="/announcements"
                        onClick={() => setShowNotificationPanel(false)}
                        className="small text-decoration-none fw-semibold d-inline-flex align-items-center gap-1"
                        style={{ color: 'var(--opt-forest, #0F5132)', fontSize: '0.78rem' }}
                      >
                        <span>View all announcements & notices</span>
                        <span>&rarr;</span>
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop / Tablet Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="btn-opt-secondary d-none d-sm-inline-flex align-items-center gap-1.5"
                title="Log out"
              >
                <FiLogOut size={15} />
                <span>Logout</span>
              </button>

              {/* Mobile Logout Icon Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="top-nav-icon-btn d-inline-flex d-sm-none text-danger"
                title="Log out"
                aria-label="Log out"
              >
                <FiLogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Expandable Mobile Quick Search Drawer */}
        {showMobileSearch && (
          <div className="p-2 px-3 bg-white border-bottom d-flex align-items-center gap-2 d-md-none shadow-sm">
            <form
              onSubmit={(e) => {
                handleQuickSearchSubmit(e);
                setShowMobileSearch(false);
              }}
              className="flex-grow-1"
            >
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <FiSearch size={14} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search employees, tasks..."
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-sm btn-success text-white px-2.5"
                  style={{ backgroundColor: '#0F5132', borderColor: '#0F5132' }}
                >
                  Search
                </button>
              </div>
            </form>
            <button
              type="button"
              className="btn btn-sm btn-link text-muted p-1"
              onClick={() => setShowMobileSearch(false)}
              aria-label="Close search"
            >
              <FiX size={18} />
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="page-container">
          {/* Profile Incomplete Notification Banner for Employees & Managers */}
          {user?.role !== 'Admin' &&
            (user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)) < 100 &&
            !dismissBanner && (
              <div
                className="alert alert-warning border d-flex flex-wrap align-items-center justify-content-between p-3 mb-4 rounded-3 shadow-sm gap-2"
                style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-circle bg-warning bg-opacity-25 text-warning d-flex align-items-center justify-content-center">
                    <FiAlertCircle size={22} className="text-warning-emphasis" />
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                      Profile Needs Completion ({user?.profileCompletion?.percentage ?? 40}% Completed)
                    </div>
                    <div className="text-muted small">
                      Please complete your contact number, emergency contact, and address to finalize your employee record.
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-warning text-dark fw-semibold"
                    onClick={handleOpenProfileModal}
                  >
                    Complete Profile Now →
                  </button>
                  <button
                    type="button"
                    className="btn-close btn-sm"
                    onClick={() => setDismissBanner(true)}
                    title="Dismiss notification"
                  />
                </div>
              </div>
            )}

          {children}
        </main>
      </div>

      {/* ================= MY PROFILE & SETTINGS MODAL ================= */}
      {showProfileModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)' }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-light pb-3">
                <div className="d-flex align-items-center gap-3">
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user.fullName}
                      className="rounded-circle border"
                      style={{ width: 44, height: 44, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center"
                      style={{ width: 44, height: 44, fontSize: 18 }}
                    >
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0">{user?.fullName}</h5>
                    <div className="text-muted small">
                      {user?.designation || 'Specialist'} •{' '}
                      <span className="fw-semibold text-primary">{user?.employeeId}</span>
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
                    {/* Profile Completion Indicator */}
                    <div className="p-3 bg-light rounded-3 mb-4 border">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold small text-dark">Profile Completion Status</span>
                        <span className="badge bg-success bg-opacity-10 text-success fw-bold">
                          {user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)}%
                        </span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div
                          className={`progress-bar ${
                            (user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)) === 100
                              ? 'bg-success'
                              : 'bg-primary'
                          }`}
                          style={{
                            width: `${user?.profileCompletion?.percentage ?? (user?.isProfileComplete ? 100 : 40)}%`,
                          }}
                        />
                      </div>
                      {user?.profileCompletion?.missingFields && user.profileCompletion.missingFields.length > 0 && (
                        <div className="mt-2 text-muted small" style={{ fontSize: '0.78rem' }}>
                          Missing recommended fields:{' '}
                          <span className="text-secondary fw-semibold">
                            {user.profileCompletion.missingFields.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Read-Only Corporate Record */}
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
                      <h6 className="fw-bold text-muted small text-uppercase m-0">
                        Corporate Record (HR Managed • Read-Only)
                      </h6>
                      <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
                        <FiLock size={10} className="me-1" />
                        Admin Controlled
                      </span>
                    </div>
                    <div className="row g-2 mb-4 small">
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Full Name:</span>
                        <span className="fw-semibold text-dark">{user?.fullName}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Corporate Email:</span>
                        <span className="fw-semibold text-dark">{user?.email}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Employee ID:</span>
                        <span className="fw-semibold text-primary">{user?.employeeId}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">System Role:</span>
                        <span className="fw-semibold text-success">{user?.role}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Department:</span>
                        <span className="fw-semibold text-dark">{user?.department?.name || 'Unassigned'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Designation:</span>
                        <span className="fw-semibold text-dark">{user?.designation || 'Specialist'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Reporting Manager:</span>
                        <span className="fw-semibold text-dark">{user?.reportingManager?.fullName || 'Direct'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Joining Date:</span>
                        <span className="fw-semibold text-dark">
                          {user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Employment Status:</span>
                        <span className="fw-semibold text-dark">{user?.status || 'Active'}</span>
                      </div>
                      <div className="col-sm-6 d-flex justify-content-between p-2 bg-light rounded">
                        <span className="text-muted">Shift Timing:</span>
                        <span className="fw-semibold text-dark">
                          {user?.shiftTiming?.startTime || '09:30'} - {user?.shiftTiming?.endTime || '18:30'}
                        </span>
                      </div>
                    </div>

                    {/* Editable Personal & Contact Information */}
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
                      <h6 className="fw-bold text-muted small text-uppercase m-0">
                        Editable Personal & Contact Details
                      </h6>
                      <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: '0.68rem' }}>
                        Self-Service
                      </span>
                    </div>
                    <div className="row g-3">
                      {/* Profile Picture URL */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Profile Photo URL</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">
                            <FiImage size={15} />
                          </span>
                          <input
                            type="url"
                            className="form-control"
                            placeholder="https://example.com/avatar.jpg"
                            value={profileForm.profilePicture}
                            onChange={(e) => setProfileForm({ ...profileForm, profilePicture: e.target.value })}
                          />
                        </div>
                        <div className="form-text" style={{ fontSize: '0.72rem' }}>
                          Paste a direct image URL for your dashboard avatar.
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Contact Phone Number</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">
                            <FiPhone size={15} />
                          </span>
                          <input
                            type="tel"
                            className="form-control"
                            placeholder="+91 98765 43210"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Date of Birth */}
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Date of Birth</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">
                            <FiCalendar size={15} />
                          </span>
                          <input
                            type="date"
                            className="form-control"
                            value={profileForm.dateOfBirth}
                            onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Current Address */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Current Residential Address</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">
                            <FiMapPin size={15} />
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Apartment, Street, City, State, PIN"
                            value={profileForm.address}
                            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Bio */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Professional Bio / About Me</label>
                        <textarea
                          rows={2}
                          className="form-control form-control-sm"
                          placeholder="Brief description of your expertise, responsibilities, or background..."
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        />
                      </div>

                      {/* Emergency Contact Header */}
                      <div className="col-12 mt-3 pt-2 border-top">
                        <span className="small fw-bold text-muted text-uppercase">Emergency Contact Details</span>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Contact Name</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Full Name"
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
                          className="form-control form-control-sm"
                          placeholder="e.g. Spouse, Parent, Sibling"
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
                          className="form-control form-control-sm"
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
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setShowProfileModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={profileSaving} className="btn btn-sm btn-primary">
                      {profileSaving ? (
                        <span className="spinner-border spinner-border-sm me-1" />
                      ) : (
                        <FiCheckCircle className="me-1" />
                      )}
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
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setShowProfileModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-primary">
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
