import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardCalendar } from '../components/DashboardCalendar';
import api from '../services/api';
import { Link } from 'react-router-dom';
import {
  FiUsers,
  FiUserCheck,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiCalendar,
  FiAlertCircle,
  FiFolder,
  FiArrowUpRight,
  FiBell,
  FiGift,
  FiAward,
} from 'react-icons/fi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/admin');
        if (res.data?.success) {
          setData(res.data);
        }
      } catch (err) {
        console.error('Failed to load admin metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <MainLayout title="Management Overview">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      </MainLayout>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <MainLayout
      title="Admin Management Overview"
      subtitle="Real-time company workforce analytics, attendance tracking & project status"
    >
      {/* Metric Stat Cards Grid */}
      <div className="row g-3 mb-4">
        {/* Total Employees */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/employees" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Total Active Staff</div>
                <div className="stat-val">{metrics.totalEmployees ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Full directory &rarr;</div>
              </div>
              <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                <FiUsers />
              </div>
            </div>
          </Link>
        </div>

        {/* Managers & Leads */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/managers" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Managers & Leads</div>
                <div className="stat-val">{metrics.activeManagers ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Team leadership &rarr;</div>
              </div>
              <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                <FiUserCheck />
              </div>
            </div>
          </Link>
        </div>

        {/* Present Today */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/attendance/all" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Present Today</div>
                <div className="stat-val text-success">{metrics.presentToday ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Checked in on schedule &rarr;</div>
              </div>
              <div className="stat-icon bg-success bg-opacity-10 text-success">
                <FiCheckCircle />
              </div>
            </div>
          </Link>
        </div>

        {/* Absent Today */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/attendance/all" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Absent Today</div>
                <div className="stat-val text-danger">{metrics.absentToday ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Unrecorded attendance &rarr;</div>
              </div>
              <div className="stat-icon bg-danger bg-opacity-10 text-danger">
                <FiXCircle />
              </div>
            </div>
          </Link>
        </div>

        {/* Late Arrivals */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/attendance/all" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Late Arrivals</div>
                <div className="stat-val text-warning">{metrics.lateArrivals ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Past grace window &rarr;</div>
              </div>
              <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                <FiClock />
              </div>
            </div>
          </Link>
        </div>

        {/* On Leave Today */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/leaves" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">On Leave Today</div>
                <div className="stat-val text-info">{metrics.onLeaveToday ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Approved leaves &rarr;</div>
              </div>
              <div className="stat-icon bg-info bg-opacity-10 text-info">
                <FiCalendar />
              </div>
            </div>
          </Link>
        </div>

        {/* Pending Leave Requests */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/leaves" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Pending Leaves</div>
                <div className="stat-val text-warning">{metrics.pendingLeaves ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>Awaiting review &rarr;</div>
              </div>
              <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                <FiCalendar />
              </div>
            </div>
          </Link>
        </div>

        {/* Missing Daily Updates */}
        <div className="col-xl-3 col-md-6 col-sm-6">
          <Link to="/work-updates" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Missing Updates</div>
                <div className={`stat-val ${metrics.missingUpdatesToday > 0 ? 'text-danger' : 'text-success'}`}>
                  {metrics.missingUpdatesToday ?? 0}
                </div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                  {metrics.missingUpdatesToday > 0 ? 'Pending daily logs \u2192' : 'All submitted \u2192'}
                </div>
              </div>
              <div className={`stat-icon ${metrics.missingUpdatesToday > 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                <FiAlertCircle />
              </div>
            </div>
          </Link>
        </div>

        {/* Active Projects */}
        <div className="col-xl-6 col-md-6">
          <Link to="/projects" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Active Projects</div>
                <div className="stat-val text-primary">{metrics.activeProjects ?? 0}</div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>In-flight client & internal deliverables &rarr;</div>
              </div>
              <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                <FiFolder />
              </div>
            </div>
          </Link>
        </div>

        {/* Overdue Tasks */}
        <div className="col-xl-6 col-md-6">
          <Link to="/projects" className="text-decoration-none">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Overdue Tasks</div>
                <div className={`stat-val ${metrics.overdueTasksCount > 0 ? 'text-danger' : 'text-dark'}`}>
                  {metrics.overdueTasksCount ?? 0}
                </div>
                <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                  {metrics.overdueTasksCount > 0 ? 'Exceeded deadline, review backlog \u2192' : 'No overdue tasks \u2192'}
                </div>
              </div>
              <div className={`stat-icon ${metrics.overdueTasksCount > 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                <FiAlertCircle />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Row 1: Weekly Attendance Trend Chart & Pending Leaves */}
      <div className="row g-4 mb-4">
        {/* Weekly Attendance Trend Chart */}
        <div className="col-lg-8">
          <div className="opt-card h-100 mb-0">
            <div className="opt-card-header">
              <h5 className="mb-0">Weekly Attendance & Punctuality Trend</h5>
              <span className="badge bg-light text-secondary border">Last 7 Days</span>
            </div>
            <div className="opt-card-body" style={{ height: 320 }}>
              {data?.weeklyTrend && data.weeklyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFFFFF', border: 'none', fontSize: '0.85rem' }}
                      itemStyle={{ color: '#E2E8F0' }}
                    />
                    <Bar dataKey="present" fill="#0F5132" radius={[4, 4, 0, 0]} name="Present" />
                    <Bar dataKey="late" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Late Arrivals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                  No attendance data recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pending Leave Requests */}
        <div className="col-lg-4">
          <div className="opt-card h-100 mb-0">
            <div className="opt-card-header">
              <h5 className="mb-0">Pending Leaves</h5>
              <Link to="/leaves" className="text-primary small text-decoration-none fw-semibold">
                View All &rarr;
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.pendingLeaveList && data.pendingLeaveList.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.pendingLeaveList.map((l) => (
                    <div key={l._id} className="list-group-item p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold text-dark small">{l.user?.fullName}</div>
                        <div className="text-muted" style={{ fontSize: '0.76rem' }}>
                          {l.numberOfDays} {l.numberOfDays === 1 ? 'working day' : 'working days'}{(l.lopDays || 0) > 0 ? ` • ${l.paidLeaveDays || 0} paid, ${l.lopDays} LOP` : ''}
                        </div>
                      </div>
                      <Link to="/leaves" className="btn btn-sm btn-outline-primary py-1 px-2" style={{ fontSize: '0.78rem' }}>
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No pending leave applications.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Today's Recent Check-ins & Upcoming Celebrations */}
      <div className="row g-4 mb-4">
        {/* Today's Attendance Table */}
        <div className="col-lg-7">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <h5 className="mb-0">Today's Attendance Feed</h5>
              <Link to="/attendance/all" className="text-primary small text-decoration-none fw-semibold">
                Full Log <FiArrowUpRight />
              </Link>
            </div>
            <div className="table-responsive">
              <table className="opt-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Check In</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentAttendance && data.recentAttendance.length > 0 ? (
                    data.recentAttendance.map((rec) => (
                      <tr key={rec._id}>
                        <td>
                          <div className="fw-semibold text-dark">{rec.user?.fullName}</div>
                          <div className="text-muted" style={{ fontSize: '0.74rem' }}>{rec.user?.employeeId}</div>
                        </td>
                        <td>
                          {rec.checkIn
                            ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td>
                          <span className={`badge-status ${rec.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-4 text-muted small">
                        No check-ins recorded for today yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Calendar & Celebrations Column */}
        <div className="col-lg-5 d-flex flex-column gap-4">
          <DashboardCalendar title="Company Calendar & Holidays" />

          {/* Celebrations: Birthdays & Work Anniversaries */}
          {(data?.upcomingBirthdays?.length > 0 || data?.upcomingAnniversaries?.length > 0) && (
            <div className="opt-card mb-0">
              <div className="opt-card-header bg-light py-2 px-3">
                <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                  <FiGift className="text-primary" /> Staff Celebrations
                </h6>
              </div>
              <div className="opt-card-body p-3">
                {data?.upcomingBirthdays && data.upcomingBirthdays.length > 0 && (
                  <div className="mb-3">
                    <div className="fw-bold text-muted small text-uppercase mb-1" style={{ fontSize: '0.7rem' }}>
                      Birthdays This Month
                    </div>
                    {data.upcomingBirthdays.map((u) => (
                      <div key={u._id} className="d-flex justify-content-between align-items-center py-1 border-bottom border-light">
                        <span className="small fw-medium text-dark">{u.fullName}</span>
                        <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                          {new Date(u.dateOfBirth).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {data?.upcomingAnniversaries && data.upcomingAnniversaries.length > 0 && (
                  <div>
                    <div className="fw-bold text-muted small text-uppercase mb-1" style={{ fontSize: '0.7rem' }}>
                      Work Anniversaries
                    </div>
                    {data.upcomingAnniversaries.map((u) => (
                      <div key={u._id} className="d-flex justify-content-between align-items-center py-1 border-bottom border-light">
                        <span className="small fw-medium text-dark">{u.fullName}</span>
                        <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                          {new Date(u.joiningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Active Project Milestone Progress & Company Announcements */}
      <div className="row g-4">
        {/* Project Milestone Progress */}
        <div className="col-lg-7">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <div className="d-flex align-items-center gap-2">
                <FiFolder className="text-primary" />
                <h5 className="m-0">Active Project Progress & Tasks</h5>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                  Completion: {metrics.taskCompletionRate ?? 0}%
                </span>
                <Link to="/projects" className="text-primary small text-decoration-none fw-semibold">
                  All Projects <FiArrowUpRight />
                </Link>
              </div>
            </div>
            <div className="opt-card-body">
              {data?.projectsWithProgress && data.projectsWithProgress.length > 0 ? (
                <div className="d-flex flex-column gap-3">
                  {data.projectsWithProgress.map((proj) => (
                    <div key={proj._id} className="p-3 border rounded-3 bg-white">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="fw-bold text-dark">{proj.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Client: {proj.clientName || 'Internal'} • Due: {proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <span className={`badge ${proj.priority === 'High' ? 'bg-danger' : proj.priority === 'Medium' ? 'bg-warning text-dark' : 'bg-info'}`}>
                          {proj.priority} Priority
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <div className="progress flex-grow-1" style={{ height: 6, borderRadius: 3, backgroundColor: '#E2E8F0' }}>
                          <div
                            className="progress-bar bg-primary"
                            role="progressbar"
                            style={{ width: `${proj.progress}%` }}
                            aria-valuenow={proj.progress}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          ></div>
                        </div>
                        <span className="small fw-bold text-dark" style={{ minWidth: 38 }}>
                          {proj.progress}%
                        </span>
                      </div>
                      <div className="d-flex justify-content-between text-muted mt-1" style={{ fontSize: '0.73rem' }}>
                        <span>Completed: {proj.completedTasks} / {proj.totalTasks} Tasks</span>
                        <span>{proj.totalTasks - proj.completedTasks} Remaining</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">
                  No active projects currently listed.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company Announcements & Alerts Feed */}
        <div className="col-lg-5">
          <div className="opt-card mb-0 h-100">
            <div className="opt-card-header">
              <div className="d-flex align-items-center gap-2">
                <FiBell className="text-primary" />
                <h5 className="m-0">Announcements & Bulletins</h5>
              </div>
              <Link to="/announcements" className="text-primary small text-decoration-none fw-semibold">
                View All <FiArrowUpRight />
              </Link>
            </div>
            <div className="opt-card-body p-0">
              {data?.recentAnnouncements && data.recentAnnouncements.length > 0 ? (
                <div className="list-group list-group-flush">
                  {data.recentAnnouncements.map((ann) => (
                    <div key={ann._id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <h6 className="fw-semibold text-dark mb-0 small">{ann.title}</h6>
                        <span className={`badge ${ann.priority === 'Urgent' ? 'bg-danger' : 'bg-primary'} badge-sm`}>
                          {ann.priority}
                        </span>
                      </div>
                      <p className="text-muted small mb-1" style={{ lineHeight: 1.4 }}>
                        {ann.description.length > 110 ? `${ann.description.slice(0, 110)}...` : ann.description}
                      </p>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Published {new Date(ann.publishDate).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">No active announcements.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
