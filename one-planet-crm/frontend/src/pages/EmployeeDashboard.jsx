import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
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
  FiAward,
  FiLogIn,
  FiLogOut,
  FiPlusCircle,
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
  }, []);

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-in');
      toast.success(res.data.message);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-out');
      toast.success(res.data.message);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Employee Portal">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      </MainLayout>
    );
  }

  const todayAtt = data?.todayAttendance;
  const isCheckedIn = !!todayAtt?.checkIn;
  const isCheckedOut = !!todayAtt?.checkOut;

  return (
    <MainLayout
      title={`Welcome back, ${user?.fullName || 'Colleague'} 👋`}
      subtitle={`Employee ID: ${user?.employeeId || ''} • ${user?.designation || 'Team Member'}`}
    >
      <div className="row g-4 mb-4">
        {/* Today's Attendance & Action Card */}
        <div className="col-lg-6">
          <div className="opt-card h-100 mb-0 border-primary border-opacity-25">
            <div className="opt-card-header bg-light">
              <h5 className="d-flex align-items-center gap-2">
                <FiClock className="text-primary" /> Today's Attendance Session
              </h5>
              <span className={`badge-status ${isCheckedIn ? (todayAtt?.isLate ? 'late' : 'present') : 'pending'}`}>
                {todayAtt ? todayAtt.status : 'Not Checked In'}
              </span>
            </div>
            <div className="opt-card-body">
              <div className="row text-center mb-4">
                <div className="col-4 border-end">
                  <div className="text-muted small">Check In</div>
                  <div className="fw-bold fs-6 mt-1 text-dark">
                    {todayAtt?.checkIn
                      ? new Date(todayAtt.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </div>
                </div>
                <div className="col-4 border-end">
                  <div className="text-muted small">Check Out</div>
                  <div className="fw-bold fs-6 mt-1 text-dark">
                    {todayAtt?.checkOut
                      ? new Date(todayAtt.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-muted small">Working Hours</div>
                  <div className="fw-bold fs-6 mt-1 text-primary">
                    {todayAtt?.workingHours ? `${todayAtt.workingHours} hrs` : '--'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex gap-3">
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckedIn || actionLoading}
                  className="btn btn-success flex-fill py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                >
                  <FiLogIn /> Check In
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={!isCheckedIn || isCheckedOut || actionLoading}
                  className="btn btn-danger flex-fill py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                >
                  <FiLogOut /> Check Out
                </button>
              </div>

              {todayAtt?.isLate && (
                <div className="alert alert-warning py-2 px-3 small mt-3 mb-0">
                  Late arrival recorded (+{todayAtt.lateMinutes} mins).
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Attendance & Leave Summary */}
        <div className="col-lg-6">
          <div className="opt-card h-100 mb-0">
            <div className="opt-card-header">
              <h5>Leave Balances & Monthly Stats</h5>
              <Link to="/leaves" className="btn btn-sm btn-outline-primary py-1 px-2 small">
                Apply Leave
              </Link>
            </div>
            <div className="opt-card-body">
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <div className="p-3 bg-light rounded text-center">
                    <span className="text-muted small">Days Present (This Month)</span>
                    <h4 className="fw-bold text-success m-0 mt-1">{data?.monthSummary?.present ?? 0}</h4>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 bg-light rounded text-center">
                    <span className="text-muted small">Total Hours Worked</span>
                    <h4 className="fw-bold text-primary m-0 mt-1">{data?.monthSummary?.totalHours ?? 0}</h4>
                  </div>
                </div>
              </div>

              <div className="fw-semibold small text-muted mb-2">Available Leave Balance:</div>
              <div className="d-flex flex-wrap gap-2">
                {data?.leaveBalances && data.leaveBalances.length > 0 ? (
                  data.leaveBalances.map((b) => (
                    <div key={b._id} className="badge bg-light text-dark border p-2 text-start flex-fill">
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {b.leaveType?.name}
                      </div>
                      <div className="fw-bold fs-6">
                        {Math.max(0, b.allocated - b.used)} <span className="small fw-normal">days</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted small">No leave quota assigned yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Assigned Tasks & Daily Work Update Status */}
      <div className="row g-4 mb-4">
        {/* Assigned Tasks */}
        <div className="col-lg-7">
          <div className="opt-card h-100 mb-0">
            <div className="opt-card-header">
              <h5>My Assigned Tasks</h5>
              <Link to="/projects" className="btn btn-sm btn-link text-primary p-0 text-decoration-none">
                All Tasks
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.assignedTasks && data.assignedTasks.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.assignedTasks.map((t) => (
                    <div key={t._id} className="list-group-item p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark">{t.title}</div>
                        <div className="text-muted small">
                          Project: {t.project?.name || 'General'} • Due:{' '}
                          {new Date(t.deadline).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`badge-status ${t.status.toLowerCase().replace(' ', '-')}`}>
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
        </div>

        {/* Daily Work Update Prompt */}
        <div className="col-lg-5">
          <div className="opt-card h-100 mb-0">
            <div className="opt-card-header">
              <h5>Today's Work Update</h5>
            </div>
            <div className="opt-card-body">
              {data?.hasSubmittedTodayUpdate ? (
                <div className="text-center py-4">
                  <FiCheckCircle size={48} className="text-success mb-2" />
                  <h6 className="fw-bold">Report Submitted for Today</h6>
                  <p className="text-muted small">
                    Your daily work report has been logged and shared with your manager.
                  </p>
                  <Link to="/work-updates" className="btn btn-outline-primary btn-sm">
                    View / Edit Update
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FiPlusCircle size={48} className="text-primary mb-2" />
                  <h6 className="fw-bold">Daily Report Pending</h6>
                  <p className="text-muted small">
                    Please submit what you worked on today, pending blockers, and tomorrow's plan before the deadline.
                  </p>
                  <Link to="/work-updates" className="btn btn-primary btn-sm">
                    Submit Today's Update
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Announcements & Upcoming Holidays */}
      <div className="row g-4">
        {/* Announcements */}
        <div className="col-lg-7">
          <div className="opt-card mb-0">
            <div className="opt-card-header">
              <h5>Company Announcements</h5>
              <Link to="/announcements" className="btn btn-sm btn-link text-primary p-0 text-decoration-none">
                View All
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.announcements && data.announcements.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.announcements.map((a) => (
                    <div key={a._id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between">
                        <strong className="text-dark">{a.title}</strong>
                        {a.priority === 'Urgent' && <span className="badge bg-danger">Urgent</span>}
                      </div>
                      <p className="text-secondary small mt-1 mb-1">{a.description}</p>
                      <small className="text-muted">
                        Published: {new Date(a.publishDate).toLocaleDateString()}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No announcements at this time.</div>
              )}
            </div>
          </div>
        </div>

        {/* Holidays */}
        <div className="col-lg-5">
          <div className="opt-card mb-0">
            <div className="opt-card-header">
              <h5>Upcoming Holidays 🏖️</h5>
              <Link to="/calendar" className="btn btn-sm btn-link text-primary p-0 text-decoration-none">
                Calendar
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.upcomingHolidays && data.upcomingHolidays.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.upcomingHolidays.map((h) => (
                    <div key={h._id} className="list-group-item p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark small">{h.name}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{h.type}</div>
                      </div>
                      <span className="badge bg-light text-primary border">
                        {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No upcoming holidays scheduled soon.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
