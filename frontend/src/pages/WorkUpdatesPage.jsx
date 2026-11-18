import React, { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiPlus,
  FiMessageSquare,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiActivity,
  FiFilter,
  FiRotateCcw,
  FiUser,
  FiBriefcase,
  FiCalendar,
  FiList,
  FiSend,
  FiInfo,
  FiEdit2,
  FiArrowRight,
  FiBell,
} from 'react-icons/fi';

export const WorkUpdatesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';
  const isAdminOrManager = isAdmin || isManager;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Main state
  const [updates, setUpdates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Missing updates state
  const [missingData, setMissingData] = useState(null);
  const [showMissingDrawer, setShowMissingDrawer] = useState(false);
  const [loadingMissing, setLoadingMissing] = useState(false);

  // Filters
  const [filterDate, setFilterDate] = useState(todayStr);
  const [filterUser, setFilterUser] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClarification, setFilterClarification] = useState(false);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [formData, setFormData] = useState({
    date: todayStr,
    project: '',
    timeSpentHours: 8,
    status: 'Completed',
  });

  // Comment / Clarification Modal
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [targetUpdateForComment, setTargetUpdateForComment] = useState(null);
  const [commentData, setCommentData] = useState({
    text: '',
    type: 'Feedback', // 'Feedback' or 'Clarification'
  });
  const [submittingComment, setSubmittingComment] = useState(false);

  // Edit History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryUpdate, setSelectedHistoryUpdate] = useState(null);

  // Fetch Work Updates
  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterUser) params.user = filterUser;
      if (filterTeam) params.team = filterTeam;
      if (filterProject) params.project = filterProject;
      if (filterStatus) params.status = filterStatus;
      if (filterClarification) params.needsClarification = 'true';

      const res = await api.get('/work-updates', { params });
      if (res.data?.success) {
        setUpdates(res.data.updates || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load daily work reports.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Missing Updates for Admin/Manager
  const fetchMissingUpdates = async () => {
    if (!isAdminOrManager) return;
    try {
      setLoadingMissing(true);
      const queryDate = filterDate || todayStr;
      const res = await api.get(`/work-updates/missing?date=${queryDate}`);
      if (res.data?.success) {
        setMissingData(res.data);
      }
    } catch (err) {
      console.error('Failed to load missing updates:', err);
    } finally {
      setLoadingMissing(false);
    }
  };

  // Fetch Dropdown Auxiliary Data
  const fetchAuxiliaryData = async () => {
    try {
      const projectRes = await api.get('/work/projects');
      if (projectRes.data?.success) {
        setProjects(projectRes.data.projects || []);
      }

      if (isAdminOrManager) {
        const empRes = await api.get('/users?limit=100');
        if (empRes.data?.success) {
          setEmployees(empRes.data.users || []);
        }
      }

      if (isAdmin) {
        const teamRes = await api.get('/teams');
        if (teamRes.data?.success) {
          setTeams(teamRes.data.teams || []);
        }
      }
    } catch (err) {
      console.error('Failed to load auxiliary options:', err);
    }
  };

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    fetchUpdates();
    if (isAdminOrManager) {
      fetchMissingUpdates();
    }
  }, [filterDate, filterUser, filterTeam, filterProject, filterStatus, filterClarification]);

  // Reset Filters
  const handleResetFilters = () => {
    setFilterDate(todayStr);
    setFilterUser('');
    setFilterTeam('');
    setFilterProject('');
    setFilterStatus('');
    setFilterClarification(false);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUpdate(null);
    setFormData({
      date: todayStr,
      project: projects[0]?._id || '',
      timeSpentHours: 8,
      status: 'Completed',
    });
    setShowSubmitModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u) => {
    setEditingUpdate(u);
    setFormData({
      date: u.date,
      project: u.project?._id || u.project || '',
      timeSpentHours: u.timeSpentHours || 8,
      status: u.status || 'Completed',
    });
    setShowSubmitModal(true);
  };

  // Submit Work Update Form
  const handleSubmitUpdate = async (e) => {
    e.preventDefault();
    if (!formData.date) {
      toast.warning('Please select a report date.');
      return;
    }
    if (!formData.timeSpentHours || Number(formData.timeSpentHours) <= 0) {
      toast.warning('Please enter valid hours spent.');
      return;
    }

    try {
      const payload = {
        date: formData.date,
        project: formData.project || undefined,
        timeSpentHours: Number(formData.timeSpentHours) || 8,
        status: formData.status,
      };

      const res = await api.post('/work-updates', payload);
      toast.success(res.data?.message || 'Work update logged successfully.');
      setShowSubmitModal(false);
      fetchUpdates();
      if (isAdminOrManager) fetchMissingUpdates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit update.');
    }
  };

  // Open Comment / Clarification Modal
  const handleOpenCommentModal = (u, defaultType = 'Feedback') => {
    setTargetUpdateForComment(u);
    setCommentData({
      text: '',
      type: defaultType,
    });
    setShowCommentModal(true);
  };

  // Submit Comment / Clarification
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentData.text.trim()) {
      toast.warning('Please enter comment text.');
      return;
    }

    try {
      setSubmittingComment(true);
      const res = await api.post(`/work-updates/${targetUpdateForComment._id}/comments`, {
        text: commentData.text.trim(),
        type: commentData.type,
      });

      toast.success(res.data?.message || 'Feedback recorded successfully.');
      setShowCommentModal(false);
      fetchUpdates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post feedback.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Send Reminder Ping to Missing Employee
  const handleSendReminder = (emp) => {
    toast.info(`Reminder ping sent to ${emp.fullName} (${emp.employeeId}).`);
  };

  // Stat calculations
  const stats = useMemo(() => {
    const total = updates.length;
    const completed = updates.filter((u) => u.status === 'Completed').length;
    const inProgress = updates.filter((u) => u.status === 'In Progress').length;
    const blocked = updates.filter((u) => u.status === 'Blocked').length;
    const needsClarificationCount = updates.filter((u) => u.needsClarification).length;
    const totalHours = updates.reduce((acc, u) => acc + (Number(u.timeSpentHours) || 0), 0);
    return { total, completed, inProgress, blocked, needsClarificationCount, totalHours };
  }, [updates]);

  return (
    <MainLayout
      title={isAdminOrManager ? 'Daily Work Updates & Submissions' : 'My Daily Work Updates'}
      subtitle="Track project deliverables, report blockers, review team logs, and resolve feedback"
    >
      {/* Top Action & Stat Overview */}
      <div className="row g-3 mb-4">
        <div className="col-xl-2 col-md-4 col-sm-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Total Logs</div>
              <div className="fs-4 fw-bold text-dark mt-1">{stats.total}</div>
              <div className="small text-muted">{stats.totalHours.toFixed(1)} hrs total</div>
            </div>
            <div className="stat-icon bg-primary bg-opacity-10 text-primary">
              <FiBriefcase />
            </div>
          </div>
        </div>

        <div className="col-xl-2 col-md-4 col-sm-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Completed</div>
              <div className="fs-4 fw-bold text-success mt-1">{stats.completed}</div>
              <div className="small text-muted">Tasks finalized</div>
            </div>
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <FiCheckCircle />
            </div>
          </div>
        </div>

        <div className="col-xl-2 col-md-4 col-sm-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">In Progress</div>
              <div className="fs-4 fw-bold text-info mt-1">{stats.inProgress}</div>
              <div className="small text-muted">Active sprints</div>
            </div>
            <div className="stat-icon bg-info bg-opacity-10 text-info">
              <FiActivity />
            </div>
          </div>
        </div>

        <div className="col-xl-2 col-md-4 col-sm-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Blocked</div>
              <div className={`fs-4 fw-bold mt-1 ${stats.blocked > 0 ? 'text-danger' : 'text-dark'}`}>
                {stats.blocked}
              </div>
              <div className="small text-muted">{stats.blocked > 0 ? 'Roadblocks reported' : 'No blockers'}</div>
            </div>
            <div className="stat-icon bg-danger bg-opacity-10 text-danger">
              <FiAlertTriangle />
            </div>
          </div>
        </div>

        <div className="col-xl-2 col-md-4 col-sm-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Clarifications</div>
              <div className={`fs-4 fw-bold mt-1 ${stats.needsClarificationCount > 0 ? 'text-warning' : 'text-dark'}`}>
                {stats.needsClarificationCount}
              </div>
              <div className="small text-muted">Pending queries</div>
            </div>
            <div className="stat-icon bg-warning bg-opacity-10 text-warning">
              <FiMessageSquare />
            </div>
          </div>
        </div>

        {isAdminOrManager && (
          <div className="col-xl-2 col-md-4 col-sm-6">
            <div
              className="stat-card p-3 h-100 cursor-pointer"
              style={{
                cursor: 'pointer',
                borderColor: missingData?.totalMissing > 0 ? '#FCA5A5' : undefined,
                backgroundColor: missingData?.totalMissing > 0 ? '#FEF2F2' : undefined,
              }}
              onClick={() => setShowMissingDrawer(!showMissingDrawer)}
              title="Click to view employees with missing daily updates"
            >
              <div>
                <div className="text-muted small fw-semibold">Missing Today</div>
                <div className={`fs-4 fw-bold mt-1 ${missingData?.totalMissing > 0 ? 'text-danger' : 'text-success'}`}>
                  {missingData ? missingData.totalMissing : 0}
                </div>
                <div className="small text-muted">
                  {missingData?.totalMissing > 0 ? 'Click to inspect' : 'All submitted'}
                </div>
              </div>
              <div
                className={`stat-icon ${
                  missingData?.totalMissing > 0
                    ? 'bg-danger bg-opacity-10 text-danger'
                    : 'bg-success bg-opacity-10 text-success'
                }`}
              >
                <FiBell />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Missing Updates Alert Banner for Admins/Managers */}
      {isAdminOrManager && missingData && missingData.totalMissing > 0 && (
        <div className="alert alert-warning border-warning d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 shadow-sm">
          <div className="d-flex align-items-center gap-3">
            <div
              className="p-2 rounded-circle bg-warning bg-opacity-25 text-warning d-flex align-items-center justify-content-center"
              style={{ width: 40, height: 40 }}
            >
              <FiAlertTriangle size={20} />
            </div>
            <div>
              <div className="fw-bold text-dark">
                {missingData.totalMissing} Employee{missingData.totalMissing > 1 ? 's' : ''} Missing Daily Work Update
                for {missingData.date}
              </div>
              <div className="small text-muted">
                {missingData.totalSubmitted} of {missingData.totalExpected} active employees logged their progress
                (employees on approved leave are excluded).
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-dark fw-semibold text-nowrap align-self-start align-self-md-auto"
            onClick={() => setShowMissingDrawer(!showMissingDrawer)}
          >
            {showMissingDrawer ? 'Hide Missing Roster' : 'View Missing Roster'}
          </button>
        </div>
      )}

      {/* Expandable Missing Employees Roster */}
      {isAdminOrManager && showMissingDrawer && missingData && (
        <div className="opt-card mb-4 border-warning">
          <div className="opt-card-header bg-light d-flex justify-content-between align-items-center py-2 px-3">
            <div className="fw-bold text-dark d-flex align-items-center gap-2">
              <FiBell className="text-warning" />
              <span>
                Missing Submissions Roster ({missingData.date}) — {missingData.missingEmployees.length} Pending
              </span>
            </div>
            <button className="btn btn-sm btn-link text-muted p-0" onClick={() => setShowMissingDrawer(false)}>
              Close
            </button>
          </div>
          <div className="opt-card-body p-0">
            {missingData.missingEmployees.length === 0 ? (
              <div className="p-4 text-center text-success small fw-semibold">
                <FiCheckCircle className="me-1" /> All expected active employees have submitted their updates for this
                date!
              </div>
            ) : (
              <div className="table-responsive">
                <table className="opt-table table-sm">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Employee ID</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingData.missingEmployees.map((emp) => (
                      <tr key={emp._id}>
                        <td className="fw-semibold text-dark">{emp.fullName}</td>
                        <td>
                          <span className="badge bg-light text-secondary border">{emp.employeeId}</span>
                        </td>
                        <td className="text-muted small">{emp.designation || 'Staff'}</td>
                        <td className="text-muted small">{emp.department}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-xs btn-outline-primary"
                            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                            onClick={() => handleSendReminder(emp)}
                          >
                            <FiSend className="me-1" /> Send Reminder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="opt-card mb-4">
        <div className="opt-card-body p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            {/* Filters Row */}
            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
              <div className="d-flex align-items-center gap-1 text-muted small fw-semibold me-1">
                <FiFilter /> Filters:
              </div>

              {/* Date Filter */}
              <div style={{ minWidth: 150 }}>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  title="Filter by Submission Date"
                />
              </div>

              {/* Employee Filter (Admins & Managers) */}
              {isAdminOrManager && (
                <div style={{ minWidth: 180 }}>
                  <select
                    className="form-select form-select-sm"
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                  >
                    <option value="">All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.fullName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Team Filter (Admins) */}
              {isAdmin && teams.length > 0 && (
                <div style={{ minWidth: 150 }}>
                  <select
                    className="form-select form-select-sm"
                    value={filterTeam}
                    onChange={(e) => setFilterTeam(e.target.value)}
                  >
                    <option value="">All Teams</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project Filter */}
              <div style={{ minWidth: 160 }}>
                <select
                  className="form-select form-select-sm"
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ minWidth: 140 }}>
                <select
                  className="form-select form-select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>

              {/* Clarification Toggle */}
              <div className="form-check form-switch ms-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="clarificationSwitch"
                  checked={filterClarification}
                  onChange={(e) => setFilterClarification(e.target.checked)}
                />
                <label className="form-check-label small text-muted fw-semibold" htmlFor="clarificationSwitch">
                  Needs Clarification
                </label>
              </div>

              {/* Reset Filter Button */}
              <button
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                onClick={handleResetFilters}
                title="Reset all filters to today"
              >
                <FiRotateCcw size={12} /> Reset
              </button>
            </div>

            {/* Log Update Primary Action */}
            <button onClick={handleOpenCreateModal} className="btn-opt-primary text-nowrap">
              <FiPlus /> Log Today's Work Update
            </button>
          </div>
        </div>
      </div>

      {/* Updates Stream / Feed */}
      <div className="row g-4">
        {loading ? (
          <div className="col-12 text-center py-5">
            <div className="spinner-border text-primary spinner-border-sm me-2"></div>
            <span className="text-muted">Loading daily work reports...</span>
          </div>
        ) : updates.length > 0 ? (
          updates.map((u) => {
            const isOwner = u.user?._id === user?._id || u.user === user?._id;
            const canEdit = isOwner || isAdmin;
            const statusClass = u.status ? u.status.toLowerCase().replace(/\s+/g, '-') : 'in-progress';

            return (
              <div key={u._id} className="col-lg-6">
                <div
                  className="opt-card mb-0 h-100 d-flex flex-column"
                  style={{
                    borderColor: u.needsClarification ? '#F59E0B' : undefined,
                  }}
                >
                  {/* Card Header */}
                  <div className="opt-card-header bg-light d-flex justify-content-between align-items-start py-3">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: 'var(--opt-forest)',
                          fontSize: '0.9rem',
                        }}
                      >
                        {u.user?.fullName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="fw-bold text-dark d-flex align-items-center gap-2">
                          <span>{u.user?.fullName || 'Employee'}</span>
                          {u.user?.employeeId && (
                            <span className="badge bg-white text-secondary border small">
                              {u.user.employeeId}
                            </span>
                          )}
                        </div>
                        <div className="text-muted small">
                          {u.user?.designation || 'Staff'} • {u.user?.department?.name || 'Department'} •{' '}
                          <span className="fw-semibold text-dark">{u.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex flex-column align-items-end gap-1">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge-status ${statusClass}`}>{u.status}</span>
                        <span className="badge bg-white text-dark border d-flex align-items-center gap-1">
                          <FiClock size={12} /> {u.timeSpentHours} hrs
                        </span>
                      </div>
                      {u.editHistory && u.editHistory.length > 0 && (
                        <button
                          className="btn btn-link p-0 text-muted small text-decoration-none d-flex align-items-center gap-1"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => {
                            setSelectedHistoryUpdate(u);
                            setShowHistoryModal(true);
                          }}
                        >
                          <FiRotateCcw size={12} /> Edited ({u.editHistory.length}x)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clarification Alert Banner */}
                  {u.needsClarification && (
                    <div className="p-2 px-3 bg-warning bg-opacity-10 border-bottom border-warning d-flex justify-content-between align-items-center">
                      <div className="small fw-semibold text-warning d-flex align-items-center gap-2">
                        <FiAlertTriangle /> Clarification Requested by Manager
                      </div>
                      {isOwner && (
                        <button
                          className="btn btn-xs btn-outline-warning fw-bold"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => handleOpenCommentModal(u, 'Feedback')}
                        >
                          Reply / Resolve
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card Body */}
                  <div className="opt-card-body flex-grow-1 d-flex flex-column gap-3">
                    {/* Project & Client */}
                    <div>
                      <span className="text-muted small fw-semibold">Project / Client: </span>
                      <span className="fw-bold text-primary">
                        {u.project?.name || 'Internal Operations'}
                      </span>
                      {u.project?.clientName && (
                        <span className="text-muted small ms-2">({u.project.clientName})</span>
                      )}
                    </div>

                    {/* Completed Work (if recorded in legacy logs) */}
                    {u.completedWork && (
                      <div>
                        <div className="text-muted small fw-semibold mb-1">Completed Work:</div>
                        <div
                          className="p-2 rounded bg-light border text-dark small"
                          style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}
                        >
                          {u.completedWork}
                        </div>
                      </div>
                    )}

                    {/* Work In Progress */}
                    {u.workInProgress && (
                      <div>
                        <div className="text-muted small fw-semibold mb-1">Work In Progress (WIP):</div>
                        <div
                          className="p-2 rounded bg-opacity-10 border small text-secondary"
                          style={{
                            backgroundColor: '#E0F2FE',
                            borderColor: '#BAE6FD',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {u.workInProgress}
                        </div>
                      </div>
                    )}

                    {/* Pending Work */}
                    {u.pendingWork && (
                      <div>
                        <div className="text-muted small fw-semibold mb-1">Pending Work:</div>
                        <div
                          className="p-2 rounded bg-opacity-10 border small text-secondary"
                          style={{
                            backgroundColor: '#FEF3C7',
                            borderColor: '#FDE68A',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {u.pendingWork}
                        </div>
                      </div>
                    )}

                    {/* Blockers */}
                    {u.blockers && (
                      <div className="p-2 rounded bg-danger bg-opacity-10 border border-danger border-opacity-25">
                        <div className="text-danger small fw-bold d-flex align-items-center gap-1 mb-1">
                          <FiAlertTriangle /> Blockers / Roadblocks:
                        </div>
                        <div className="small text-danger" style={{ whiteSpace: 'pre-line' }}>
                          {u.blockers}
                        </div>
                      </div>
                    )}

                    {/* Next Day Plan */}
                    {u.nextDayPlan && (
                      <div className="d-flex align-items-start gap-2 pt-1">
                        <FiArrowRight className="text-primary mt-1" />
                        <div className="small">
                          <span className="fw-semibold text-dark">Tomorrow's Focus: </span>
                          <span className="text-secondary">{u.nextDayPlan}</span>
                        </div>
                      </div>
                    )}

                    {/* Feedback and Comment Conversation Thread */}
                    {u.comments && u.comments.length > 0 && (
                      <div className="mt-2 pt-3 border-top">
                        <div className="small fw-semibold text-muted mb-2 d-flex align-items-center gap-1">
                          <FiMessageSquare /> Feedback & Discussion Thread ({u.comments.length}):
                        </div>
                        <div className="d-flex flex-column gap-2">
                          {u.comments.map((c, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded border small ${
                                c.type === 'Clarification'
                                  ? 'bg-warning bg-opacity-10 border-warning border-opacity-25'
                                  : 'bg-light'
                              }`}
                            >
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                  <span>{c.author?.fullName || 'Manager'}</span>
                                  {c.author?.role && (
                                    <span className="badge bg-white text-secondary border" style={{ fontSize: '0.7rem' }}>
                                      {c.author.role}
                                    </span>
                                  )}
                                  <span
                                    className={`badge ${
                                      c.type === 'Clarification' ? 'bg-warning text-dark' : 'bg-primary text-white'
                                    }`}
                                    style={{ fontSize: '0.65rem' }}
                                  >
                                    {c.type}
                                  </span>
                                </div>
                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                  {new Date(c.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  • {new Date(c.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="text-dark" style={{ whiteSpace: 'pre-line' }}>
                                {c.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="opt-card-header bg-light py-2 px-3 border-top d-flex justify-content-between align-items-center">
                    <div className="small text-muted">
                      Updated: {new Date(u.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <FiEdit2 size={12} /> Revise Update
                        </button>
                      )}

                      {isAdminOrManager ? (
                        <button
                          onClick={() => handleOpenCommentModal(u, 'Feedback')}
                          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <FiMessageSquare size={12} /> Add Review / Clarify
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenCommentModal(u, 'Feedback')}
                          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <FiMessageSquare size={12} /> Reply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-12">
            <div className="p-5 text-center bg-white rounded border text-muted">
              <div
                className="mx-auto mb-3 rounded-circle bg-light d-flex align-items-center justify-content-center"
                style={{ width: 64, height: 64 }}
              >
                <FiList size={28} className="text-muted" />
              </div>
              <h6 className="fw-bold text-dark mb-1">No Daily Work Updates Found</h6>
              <p className="small text-muted mb-3">
                No submissions match the current query parameters or date ({filterDate || 'all dates'}).
              </p>
              <button onClick={handleOpenCreateModal} className="btn-opt-primary btn-sm mx-auto">
                <FiPlus /> Log Today's Work Report
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Submit / Revise Work Update Modal (Compact Form)                  */}
      {/* ========================================================================= */}
      {showSubmitModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 580 }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark">
                    {editingUpdate ? "Revise Daily Work Update" : "Submit Daily Work Update"}
                  </h5>
                  <div className="small text-muted">
                    Employee: <span className="fw-semibold text-dark">{user?.fullName}</span> ({user?.employeeId})
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowSubmitModal(false)}></button>
              </div>

              <form onSubmit={handleSubmitUpdate}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    {/* 1. Report Date (required) */}
                    <div className="col-sm-4 col-12">
                      <label className="form-label small fw-semibold">Report Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>

                    {/* 2. Project / Client Allocation */}
                    <div className="col-sm-5 col-12">
                      <label className="form-label small fw-semibold">Project / Client Allocation</label>
                      <select
                        className="form-select"
                        value={formData.project}
                        onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                      >
                        <option value="">General Work / Internal Operations</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} {p.clientName ? `(${p.clientName})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Hours Spent (required) */}
                    <div className="col-sm-3 col-12">
                      <label className="form-label small fw-semibold">Hours Spent *</label>
                      <input
                        type="number"
                        min="0.5"
                        max="16"
                        step="0.5"
                        required
                        className="form-control"
                        value={formData.timeSpentHours}
                        onChange={(e) => setFormData({ ...formData, timeSpentHours: e.target.value })}
                      />
                    </div>

                    {/* 4. Today's Deliverable Status (required) in one horizontal row */}
                    <div className="col-12 mt-3">
                      <label className="form-label small fw-semibold mb-2">Today's Deliverable Status *</label>
                      <div className="d-flex gap-2 gap-sm-3">
                        {['Completed', 'In Progress', 'Blocked'].map((st) => (
                          <div
                            key={st}
                            className={`p-2.5 px-3 rounded border cursor-pointer flex-fill text-center d-flex align-items-center justify-content-center ${
                              formData.status === st
                                ? st === 'Completed'
                                  ? 'bg-success bg-opacity-10 border-success text-success fw-bold shadow-sm'
                                  : st === 'In Progress'
                                  ? 'bg-info bg-opacity-10 border-info text-info fw-bold shadow-sm'
                                  : 'bg-danger bg-opacity-10 border-danger text-danger fw-bold shadow-sm'
                                : 'bg-light text-muted'
                            }`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setFormData({ ...formData, status: st })}
                          >
                            <input
                              type="radio"
                              name="updateStatus"
                              value={st}
                              checked={formData.status === st}
                              onChange={() => setFormData({ ...formData, status: st })}
                              className="form-check-input me-2"
                              style={{ cursor: 'pointer', accentColor: 'var(--opt-forest)' }}
                            />
                            <span>{st}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-opt-primary">
                    Submit Work Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Manager Feedback / Request Clarification Modal                    */}
      {/* ========================================================================= */}
      {showCommentModal && targetUpdateForComment && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark">
                    {isAdminOrManager ? 'Provide Feedback / Request Clarification' : 'Reply to Manager Feedback'}
                  </h5>
                  <div className="small text-muted">
                    Update for: <span className="fw-semibold text-dark">{targetUpdateForComment.user?.fullName}</span>{' '}
                    ({targetUpdateForComment.date})
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowCommentModal(false)}></button>
              </div>

              <form onSubmit={handleSubmitComment}>
                <div className="modal-body p-4">
                  {isAdminOrManager && (
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Feedback Type</label>
                      <div className="d-flex gap-2">
                        <div
                          className={`p-2 px-3 rounded border cursor-pointer flex-fill text-center ${
                            commentData.type === 'Feedback'
                              ? 'bg-primary bg-opacity-10 border-primary text-primary fw-bold'
                              : 'bg-light text-muted'
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setCommentData({ ...commentData, type: 'Feedback' })}
                        >
                          <input
                            type="radio"
                            name="commentType"
                            checked={commentData.type === 'Feedback'}
                            onChange={() => setCommentData({ ...commentData, type: 'Feedback' })}
                            className="form-check-input me-2"
                          />
                          General Feedback
                        </div>

                        <div
                          className={`p-2 px-3 rounded border cursor-pointer flex-fill text-center ${
                            commentData.type === 'Clarification'
                              ? 'bg-warning bg-opacity-10 border-warning text-warning fw-bold'
                              : 'bg-light text-muted'
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setCommentData({ ...commentData, type: 'Clarification' })}
                        >
                          <input
                            type="radio"
                            name="commentType"
                            checked={commentData.type === 'Clarification'}
                            onChange={() => setCommentData({ ...commentData, type: 'Clarification' })}
                            className="form-check-input me-2"
                          />
                          Request Clarification
                        </div>
                      </div>
                      {commentData.type === 'Clarification' && (
                        <div className="small text-warning mt-2">
                          <FiInfo className="me-1" /> Requesting clarification marks this report as needing action and
                          prompts the employee to address questions.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">
                      {isAdminOrManager
                        ? commentData.type === 'Clarification'
                          ? 'Clarification Details / Questions *'
                          : 'Manager Feedback & Remarks *'
                        : 'Your Reply / Explanation *'}
                    </label>
                    <textarea
                      className="form-control"
                      rows="4"
                      required
                      placeholder={
                        isAdminOrManager
                          ? commentData.type === 'Clarification'
                            ? 'Specify which tasks need additional details, blocker resolution status, or code references...'
                            : 'Good progress! Please ensure test cases are covered before merging...'
                          : 'Explanation or resolution regarding the requested clarification...'
                      }
                      value={commentData.text}
                      onChange={(e) => setCommentData({ ...commentData, text: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCommentModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-opt-primary" disabled={submittingComment}>
                    {submittingComment ? 'Submitting...' : 'Post Message'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Edit History Snapshot Modal                                      */}
      {/* ========================================================================= */}
      {showHistoryModal && selectedHistoryUpdate && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <FiRotateCcw /> Revision History
                  </h5>
                  <div className="small text-muted">
                    Employee: {selectedHistoryUpdate.user?.fullName} • Date: {selectedHistoryUpdate.date}
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowHistoryModal(false)}></button>
              </div>

              <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="timeline d-flex flex-column gap-3">
                  {selectedHistoryUpdate.editHistory.map((rev, index) => (
                    <div key={index} className="p-3 rounded border bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-secondary text-white">Revision #{index + 1}</span>
                        <div className="small text-muted">
                          Edited by {rev.editedBy?.fullName || 'User'} on{' '}
                          {new Date(rev.editedAt).toLocaleDateString()} at{' '}
                          {new Date(rev.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {rev.reason && (
                        <div className="mb-2 p-2 rounded bg-white border small">
                          <span className="fw-semibold text-primary">Reason: </span>
                          <span className="text-dark">{rev.reason}</span>
                        </div>
                      )}

                      <div className="row g-2 small">
                        <div className="col-md-6">
                          <div className="text-muted fw-semibold">Prior Status & Hours:</div>
                          <div className="text-dark">
                            {rev.previousStatus || 'N/A'} • {rev.previousTimeSpentHours || '8'} hrs
                          </div>
                        </div>

                        <div className="col-12">
                          <div className="text-muted fw-semibold">Prior Completed Work:</div>
                          <div className="p-2 rounded bg-white border text-dark mt-1" style={{ whiteSpace: 'pre-line' }}>
                            {rev.previousCompletedWork}
                          </div>
                        </div>

                        {rev.previousWorkInProgress && (
                          <div className="col-12">
                            <div className="text-muted fw-semibold">Prior Work In Progress:</div>
                            <div className="p-2 rounded bg-white border text-secondary mt-1">
                              {rev.previousWorkInProgress}
                            </div>
                          </div>
                        )}

                        {rev.previousBlockers && (
                          <div className="col-12">
                            <div className="text-danger fw-semibold">Prior Blockers:</div>
                            <div className="p-2 rounded bg-danger bg-opacity-10 border border-danger text-danger mt-1">
                              {rev.previousBlockers}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer bg-light border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
