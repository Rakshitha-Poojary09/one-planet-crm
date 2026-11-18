import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardCalendar } from '../components/DashboardCalendar';
import api from '../services/api';
import { Link } from 'react-router-dom';
import {
  FiUsers,
  FiCheckCircle,
  FiCalendar,
  FiAlertCircle,
  FiFolder,
  FiFileText,
  FiArrowUpRight,
  FiClock,
} from 'react-icons/fi';

export const ManagerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/manager');
        if (res.data?.success) {
          setData(res.data);
        }
      } catch (err) {
        console.error('Failed to load manager metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <MainLayout title="Team Leader Operations">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      </MainLayout>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <MainLayout
      title="Team Operations"
      subtitle="Monitor your team's live attendance, review pending leaves & oversee active deliverables"
    >
      {/* 6 Compact Manager Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-xl-4 col-md-6">
          <Link to="/employees" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Assigned Team Members</div>
                <div className="stat-val">{metrics.totalTeamMembers ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Direct reports directory &rarr;</div>
              </div>
              <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                <FiUsers />
              </div>
            </div>
          </Link>
        </div>

        <div className="col-xl-4 col-md-6">
          <Link to="/attendance/all" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Team Present Today</div>
                <div className="stat-val text-success">{metrics.presentTeamToday ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Active today &rarr;</div>
              </div>
              <div className="stat-icon bg-success bg-opacity-10 text-success">
                <FiCheckCircle />
              </div>
            </div>
          </Link>
        </div>

        <div className="col-xl-4 col-md-6">
          <Link to="/leaves" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Pending Leave Approvals</div>
                <div className="stat-val text-warning">{metrics.pendingLeavesCount ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Awaiting manager action &rarr;</div>
              </div>
              <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                <FiCalendar />
              </div>
            </div>
          </Link>
        </div>

        <div className="col-xl-4 col-md-6">
          <Link to="/work-updates" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Missing Daily Updates</div>
                <div className={`stat-val ${metrics.missingUpdatesCount > 0 ? 'text-danger' : 'text-success'}`}>
                  {metrics.missingUpdatesCount ?? 0}
                </div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Today's unsubmitted reports &rarr;</div>
              </div>
              <div className={`stat-icon ${metrics.missingUpdatesCount > 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                <FiAlertCircle />
              </div>
            </div>
          </Link>
        </div>

        <div className="col-xl-4 col-md-6">
          <Link to="/projects" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Active Team Projects</div>
                <div className="stat-val text-info">{metrics.activeProjectsCount ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Deliverables in flight &rarr;</div>
              </div>
              <div className="stat-icon bg-info bg-opacity-10 text-info">
                <FiFolder />
              </div>
            </div>
          </Link>
        </div>

        <div className="col-xl-4 col-md-6">
          <Link to="/projects" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Overdue Tasks</div>
                <div className={`stat-val ${metrics.overdueTasksCount > 0 ? 'text-danger' : 'text-dark'}`}>
                  {metrics.overdueTasksCount ?? 0}
                </div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Tasks past target deadline &rarr;</div>
              </div>
              <div className={`stat-icon ${metrics.overdueTasksCount > 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                <FiAlertCircle />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Team Attendance & Pending Leave Approvals */}
      <div className="row g-4 mb-4">
        {/* Team Attendance Today */}
        <div className="col-lg-7">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <h5 className="mb-0">Team Attendance (Today)</h5>
              <Link to="/attendance/all" className="text-primary small text-decoration-none fw-semibold">
                Full Log <FiArrowUpRight />
              </Link>
            </div>
            <div className="table-responsive">
              <table className="opt-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Designation</th>
                    <th>Check In</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.teamAttendance && data.teamAttendance.length > 0 ? (
                    data.teamAttendance.map((rec) => (
                      <tr key={rec._id}>
                        <td>
                          <div className="fw-semibold text-dark">{rec.user?.fullName}</div>
                          <div className="text-muted" style={{ fontSize: '0.74rem' }}>{rec.user?.employeeId}</div>
                        </td>
                        <td>{rec.user?.designation || '-'}</td>
                        <td>
                          {rec.checkIn
                            ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td>
                          <span className={`badge-status ${rec.status ? rec.status.toLowerCase().replace(/\s+/g, '-') : 'present'}`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-4 text-muted small">
                        No team check-ins logged for today yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="col-lg-5">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <h5 className="mb-0">Team Leave Requests</h5>
              <Link to="/leaves" className="text-primary small text-decoration-none fw-semibold">
                Manage in Leaves &rarr;
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.pendingLeaveApprovals && data.pendingLeaveApprovals.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.pendingLeaveApprovals.map((l) => (
                    <div key={l._id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong className="text-dark small">{l.user?.fullName}</strong>
                        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25" style={{ fontSize: '0.72rem' }}>
                          {l.leaveType?.name || 'Leave'}
                        </span>
                      </div>
                      <div className="text-muted small">
                        Reason: {l.reason} ({l.numberOfDays} {l.numberOfDays === 1 ? 'working day' : 'working days'}{(l.lopDays || 0) > 0 ? ` • ${l.paidLeaveDays || 0} paid, ${l.lopDays} LOP` : ''})
                      </div>
                      <div className="mt-2 text-end">
                        <Link to="/leaves" className="btn btn-sm btn-outline-primary py-0 px-2" style={{ fontSize: '0.78rem' }}>
                          Review Application
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No pending team leave applications.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row: Recent Team Daily Work Updates & Interactive Calendar */}
      <div className="row g-4">
        {/* Recent Team Daily Work Updates */}
        <div className="col-lg-7">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <h5 className="mb-0">Recent Team Work Updates</h5>
              <Link to="/work-updates" className="text-primary small text-decoration-none fw-semibold">
                All Work Reports <FiArrowUpRight />
              </Link>
            </div>
            <div className="table-responsive">
              <table className="opt-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Project</th>
                    <th>Completed Work</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.teamUpdates && data.teamUpdates.length > 0 ? (
                    data.teamUpdates.map((u) => (
                      <tr key={u._id}>
                        <td className="text-muted small">{u.date}</td>
                        <td>
                          <div className="fw-semibold text-dark">{u.user?.fullName}</div>
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border">
                            {u.project?.name || 'General Operations'}
                          </span>
                        </td>
                        <td className="small text-muted">{u.completedWork.substring(0, 85)}...</td>
                        <td>
                          <span className={`badge-status ${u.status ? u.status.toLowerCase().replace(/\s+/g, '-') : 'approved'}`}>
                            {u.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-muted small">
                        No team updates submitted recently.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Company Calendar with Holiday Highlighting */}
        <div className="col-lg-5">
          <DashboardCalendar title="Company Calendar & Holidays" showManageLink={false} />
        </div>
      </div>
    </MainLayout>
  );
};
