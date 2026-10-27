import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import api from '../services/api';
import { Link } from 'react-router-dom';
import {
  FiUsers,
  FiCheckCircle,
  FiCalendar,
  FiAlertCircle,
  FiFolder,
  FiFileText,
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
      <MainLayout title="Team Leader Dashboard">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      </MainLayout>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <MainLayout title="Team Operations" subtitle="Monitor your team's attendance, tasks & project deliverables">
      {/* 6 Manager Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-xl-4 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Assigned Team Members</div>
              <div className="stat-val">{metrics.totalTeamMembers ?? 0}</div>
            </div>
            <div className="stat-icon bg-primary bg-opacity-10 text-primary">
              <FiUsers />
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Team Present Today</div>
              <div className="stat-val text-success">{metrics.presentTeamToday ?? 0}</div>
            </div>
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <FiCheckCircle />
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Pending Leave Approvals</div>
              <div className="stat-val text-warning">{metrics.pendingLeavesCount ?? 0}</div>
            </div>
            <div className="stat-icon bg-warning bg-opacity-10 text-warning">
              <FiCalendar />
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Missing Daily Updates</div>
              <div className="stat-val text-danger">{metrics.missingUpdatesCount ?? 0}</div>
            </div>
            <div className="stat-icon bg-danger bg-opacity-10 text-danger">
              <FiAlertCircle />
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Active Team Projects</div>
              <div className="stat-val text-info">{metrics.activeProjectsCount ?? 0}</div>
            </div>
            <div className="stat-icon bg-info bg-opacity-10 text-info">
              <FiFolder />
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Overdue Tasks</div>
              <div className="stat-val text-danger">{metrics.overdueTasksCount ?? 0}</div>
            </div>
            <div className="stat-icon bg-danger bg-opacity-10 text-danger">
              <FiAlertCircle />
            </div>
          </div>
        </div>
      </div>

      {/* Team Attendance & Pending Leave Approvals */}
      <div className="row g-4 mb-4">
        {/* Team Attendance Today */}
        <div className="col-lg-7">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <h5>Team Attendance (Today)</h5>
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
                          <div className="text-muted small">{rec.user?.employeeId}</div>
                        </td>
                        <td>{rec.user?.designation || '-'}</td>
                        <td>
                          {rec.checkIn
                            ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td>
                          <span className={`badge-status ${rec.status.toLowerCase().replace(' ', '-')}`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-4 text-muted">
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
              <h5>Team Leave Requests</h5>
              <Link to="/leaves" className="btn btn-sm btn-link text-primary p-0 text-decoration-none">
                Review in Leaves
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.pendingLeaveApprovals && data.pendingLeaveApprovals.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.pendingLeaveApprovals.map((l) => (
                    <div key={l._id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between">
                        <strong className="text-dark small">{l.user?.fullName}</strong>
                        <span className="badge bg-warning text-dark">{l.leaveType?.name}</span>
                      </div>
                      <div className="text-muted small mt-1">
                        Reason: {l.reason} ({l.numberOfDays} days)
                      </div>
                      <div className="mt-2 text-end">
                        <Link to="/leaves" className="btn btn-sm btn-primary py-0 px-2" style={{ fontSize: '0.78rem' }}>
                          Take Action
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

      {/* Recent Team Daily Work Updates */}
      <div className="opt-card mb-0">
        <div className="opt-card-header">
          <h5>Recent Team Work Updates</h5>
          <Link to="/work-updates" className="btn btn-sm btn-link text-primary p-0 text-decoration-none">
            All Work Reports
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
                    <td>{u.date}</td>
                    <td>
                      <div className="fw-semibold text-dark">{u.user?.fullName}</div>
                    </td>
                    <td>{u.project?.name || 'General Operations'}</td>
                    <td>{u.completedWork.substring(0, 75)}...</td>
                    <td>
                      <span className={`badge-status ${u.status.toLowerCase().replace(' ', '-')}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    No team updates submitted recently.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};
