import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardCalendar } from '../components/DashboardCalendar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import {
  FiClock,
  FiCalendar,
  FiCheckCircle,
  FiFolder,
  FiBell,
  FiLogIn,
  FiLogOut,
  FiPlusCircle,
  FiArrowUpRight,
  FiTrendingUp,
  FiInfo,
  FiAlertCircle,
} from 'react-icons/fi';

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard/employee');
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load employee metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const handleSync = () => {
      fetchDashboard();
    };
    window.addEventListener('attendance-updated', handleSync);
    return () => window.removeEventListener('attendance-updated', handleSync);
  }, []);

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-in');
      toast.success(res.data?.message || 'Login recorded successfully!');
      fetchDashboard();
      window.dispatchEvent(new CustomEvent('attendance-updated', { detail: res.data?.attendance }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-out');
      toast.success(res.data?.message || 'Logout recorded successfully!');
      fetchDashboard();
      window.dispatchEvent(new CustomEvent('attendance-updated', { detail: res.data?.attendance }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Logout failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Employee Workspace">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      </MainLayout>
    );
  }

  const todayAtt = data?.todayAttendance;
  const isCheckedIn = !!todayAtt?.checkIn;
  const isCheckedOut = !!todayAtt?.checkOut;
  const accrual = data?.accrualSummary || {};
  const availableBalance =
    accrual.availableBalance ??
    (data?.leaveBalances && data.leaveBalances.length > 0
      ? Math.max(0, (data.leaveBalances[0]?.allocated ?? 12) - (data.leaveBalances[0]?.used ?? 0))
      : 0);

  return (
    <MainLayout
      title={`Welcome back, ${user?.fullName || 'Colleague'} 👋`}
      subtitle={`Employee ID: ${user?.employeeId || ''} • ${user?.designation || 'Team Member'} • ${user?.department?.name || 'Operations'}`}
    >
      {/* Prominent Compact Horizontal Header-Style Attendance Bar */}
      <div
        className="opt-card mb-4 border rounded-3 bg-white shadow-sm overflow-hidden"
        style={{ borderColor: 'var(--opt-border, #E2E8F0)' }}
      >
        <div className="p-3 d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3">
          {/* 1. Today's Attendance Label + Clock Icon + Current Attendance Status + Date */}
          <div className="d-flex align-items-center gap-2.5">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 38,
                height: 38,
                background: 'var(--opt-forest-light, #E8F5E9)',
                color: 'var(--opt-forest, #0F5132)',
                border: '1px solid var(--opt-forest-border, #C8E6C9)',
              }}
            >
              <FiClock size={19} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                  Today's Attendance
                </h6>
                <span
                  className="badge px-2 py-0.5 rounded-pill fw-semibold"
                  style={{
                    fontSize: '0.72rem',
                    backgroundColor: isCheckedOut
                      ? '#DCFCE7'
                      : isCheckedIn
                      ? '#E8F5E9'
                      : '#F1F5F9',
                    color: isCheckedOut
                      ? '#15803D'
                      : isCheckedIn
                      ? '#0F5132'
                      : '#64748B',
                    border: `1px solid ${
                      isCheckedOut
                        ? '#86EFAC'
                        : isCheckedIn
                        ? '#A7F3D0'
                        : '#E2E8F0'
                    }`,
                  }}
                >
                  {isCheckedOut
                    ? 'Completed for Today'
                    : isCheckedIn
                    ? 'Active Punch-In Session'
                    : 'Not Checked In'}
                </span>
              </div>
              <div className="small text-muted mt-0.5" style={{ fontSize: '0.75rem' }}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* 2. Punch In Time | Punch Out Time | Working Hours in a Fluid Layout */}
          <div
            className="d-flex align-items-center justify-content-between py-1.5 px-2 px-sm-3 rounded-2 flex-grow-1"
            style={{
              background: '#F8FAFC',
              border: '1px solid var(--opt-border, #E2E8F0)',
              maxWidth: '100%',
            }}
          >
            <div className="text-center flex-fill pe-2 border-end" style={{ minWidth: 0 }}>
              <span
                className="text-muted d-block fw-semibold text-truncate"
                style={{ fontSize: '0.65rem', letterSpacing: '0.4px' }}
              >
                PUNCH IN
              </span>
              <strong className="text-dark" style={{ fontSize: '0.84rem' }}>
                {todayAtt?.checkIn
                  ? new Date(todayAtt.checkIn).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--'}
              </strong>
            </div>

            <div className="text-center flex-fill px-2 border-end" style={{ minWidth: 0 }}>
              <span
                className="text-muted d-block fw-semibold text-truncate"
                style={{ fontSize: '0.65rem', letterSpacing: '0.4px' }}
              >
                PUNCH OUT
              </span>
              <strong className="text-dark" style={{ fontSize: '0.84rem' }}>
                {todayAtt?.checkOut
                  ? new Date(todayAtt.checkOut).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--'}
              </strong>
            </div>

            <div className="text-center flex-fill ps-2" style={{ minWidth: 0 }}>
              <span
                className="text-muted d-block fw-semibold text-truncate"
                style={{ fontSize: '0.65rem', letterSpacing: '0.4px' }}
              >
                WORKING HOURS
              </span>
              <strong
                style={{
                  fontSize: '0.84rem',
                  color: isCheckedOut || isCheckedIn ? '#0F5132' : '#64748B',
                }}
              >
                {isCheckedOut && todayAtt?.workingHours
                  ? `${todayAtt.workingHours} hrs`
                  : isCheckedIn
                  ? 'In Progress'
                  : '0 hrs'}
              </strong>
            </div>
          </div>

          {/* 3. Attendance Controls Displayed: Login & Logout (Touch-Friendly) */}
          <div className="d-flex align-items-center gap-2 flex-shrink-0 flex-grow-1 flex-lg-grow-0">
            <button
              onClick={handleCheckIn}
              disabled={isCheckedIn || actionLoading}
              className="btn btn-attendance-checkin shadow-none flex-fill flex-lg-grow-0"
              title={
                isCheckedIn
                  ? `Logged in at ${todayAtt?.checkIn ? new Date(todayAtt.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                  : 'Click to record login'
              }
            >
              {actionLoading && !isCheckedIn ? (
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
              ) : (
                <>
                  <FiLogIn size={14} />
                  <span>Login</span>
                </>
              )}
            </button>

            <button
              onClick={handleCheckOut}
              disabled={!isCheckedIn || isCheckedOut || actionLoading}
              className="btn btn-attendance-checkout shadow-none flex-fill flex-lg-grow-0"
              title={
                !isCheckedIn
                  ? 'Login first to enable logout'
                  : isCheckedOut
                  ? 'Attendance completed for today'
                  : 'Click to record logout'
              }
            >
              {actionLoading && isCheckedIn && !isCheckedOut ? (
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
              ) : (
                <>
                  <FiLogOut size={14} />
                  <span>Logout</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4. Compact Notification Strip (Late Arrival & Early Departure) */}
        {((isCheckedIn && todayAtt?.isLate) || (isCheckedOut && todayAtt?.isEarlyDeparture)) && (
          <div className="px-3 pb-2.5 pt-0">
            {isCheckedIn && todayAtt?.isLate && (
              <div
                className="alert alert-warning py-1.5 px-3 small mb-0 d-flex align-items-center gap-2 rounded-2 border"
                style={{
                  fontSize: '0.78rem',
                  backgroundColor: '#FFFBEB',
                  borderColor: '#FDE68A',
                  color: '#92400E',
                }}
              >
                <FiAlertCircle className="flex-shrink-0 text-warning" size={14} />
                <span>
                  Late arrival recorded for today (+{todayAtt.lateMinutes} minutes beyond grace period).
                </span>
              </div>
            )}
            {isCheckedOut && todayAtt?.isEarlyDeparture && (
              <div
                className="alert alert-info py-1.5 px-3 small mt-1.5 mb-0 d-flex align-items-center gap-2 rounded-2 border"
                style={{
                  fontSize: '0.78rem',
                  backgroundColor: '#EFF6FF',
                  borderColor: '#BFDBFE',
                  color: '#1E40AF',
                }}
              >
                <FiAlertCircle className="flex-shrink-0 text-info" size={14} />
                <span>
                  Early departure recorded for today (-{todayAtt.earlyDepartureMinutes} minutes before shift end).
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row g-4">
        {/* Left Column: My Assigned Tasks -> Announcements */}
        <div className="col-lg-6 d-flex flex-column" style={{ gap: '18px' }}>
          {/* 1. My Assigned Tasks */}
          <div className="opt-card mb-0">
            <div className="opt-card-header">
              <h5 className="mb-0">My Assigned Tasks</h5>
              <Link to="/projects" className="text-primary small text-decoration-none fw-semibold">
                Kanban & Tasks <FiArrowUpRight />
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.assignedTasks && data.assignedTasks.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.assignedTasks.map((t) => (
                    <div key={t._id} className="list-group-item p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">{t.title}</div>
                        <div className="text-muted small" style={{ fontSize: '0.76rem' }}>
                          Project: {t.project?.name || 'General'} • Due:{' '}
                          {t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <span className={`badge-status ${t.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">You currently have no pending tasks. Great job!</div>
              )}
            </div>
          </div>

          {/* 3. Today's Work Update (Moved to Left Side) */}
          <div className="opt-card mb-0">
            <div className="opt-card-header">
              <h5 className="mb-0">Today's Work Update</h5>
            </div>
            <div className="opt-card-body">
              {data?.hasSubmittedTodayUpdate ? (
                <div className="text-center py-3">
                  <FiCheckCircle size={40} className="text-success mb-2" />
                  <h6 className="fw-bold text-dark">Report Submitted for Today</h6>
                  <p className="text-muted small mb-3">
                    Your daily work report has been logged and shared with your manager.
                  </p>
                  <Link to="/work-updates" className="btn btn-outline-secondary btn-sm">
                    View / Edit Update
                  </Link>
                </div>
              ) : (
                <div className="text-center py-3">
                  <FiPlusCircle size={40} className="text-primary mb-2" />
                  <h6 className="fw-bold text-dark">Daily Report Pending</h6>
                  <p className="text-muted small mb-3">
                    Please submit what you worked on today, pending blockers, and tomorrow's plan before the daily deadline.
                  </p>
                  <Link to="/work-updates" className="btn btn-primary btn-sm">
                    Submit Today's Update
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* 4. Company Announcements */}
          <div className="opt-card mb-0">
            <div className="opt-card-header">
              <h5 className="mb-0">Company Announcements</h5>
              <Link to="/announcements" className="text-primary small text-decoration-none fw-semibold">
                View All <FiArrowUpRight />
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.announcements && data.announcements.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.announcements.map((a) => (
                    <div key={a._id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong className="text-dark small">{a.title}</strong>
                        {a.priority === 'Urgent' && <span className="badge bg-danger" style={{ fontSize: '0.68rem' }}>Urgent</span>}
                      </div>
                      <p className="text-secondary small mb-1">{a.description}</p>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Published: {new Date(a.publishDate).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No announcements at this time.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Company Calendar -> Leave Balance */}
        <div className="col-lg-6 d-flex flex-column" style={{ gap: '18px' }}>
          {/* 1. Company Calendar & Holidays */}
          <DashboardCalendar title="Company Calendar & Holidays" showManageLink={false} />

          {/* 2. Simplified Leave Balance */}
          <div className="opt-card mb-0">
            <div className="opt-card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <FiCalendar className="text-primary" />
                <h5 className="mb-0">Leave Balance</h5>
              </div>
              <Link to="/leaves" className="text-primary small text-decoration-none fw-semibold">
                Apply Leave &rarr;
              </Link>
            </div>
            <div className="opt-card-body p-3">
              <div
                className="p-3 bg-light border rounded-3 text-center"
                style={{ borderColor: 'var(--opt-border-light)' }}
              >
                <div
                  className="text-muted small text-uppercase fw-semibold mb-2"
                  style={{ fontSize: '0.76rem', letterSpacing: '0.8px' }}
                >
                  NET AVAILABLE BALANCE
                </div>
                <div className="d-flex align-items-baseline justify-content-center gap-2 my-1">
                  <span
                    className="fw-bold"
                    style={{ fontSize: '2.8rem', color: 'var(--opt-forest)', lineHeight: 1 }}
                  >
                    {availableBalance}
                  </span>
                  <span className="text-muted small fw-medium">days ready for use</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
