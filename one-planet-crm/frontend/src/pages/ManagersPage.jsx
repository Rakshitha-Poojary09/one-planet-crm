import React, { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiCheck,
  FiX,
  FiEye,
  FiClock,
  FiFileText,
  FiShield,
  FiCalendar,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiLock,
  FiKey,
  FiCopy,
  FiFolder,
  FiUsers,
  FiUserCheck,
  FiUserPlus,
  FiRotateCcw,
  FiFilter,
  FiArrowRight,
  FiBriefcase,
} from 'react-icons/fi';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const ManagersPage = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';

  // Data states
  const [managers, setManagers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('basic'); // 'basic' | 'timing' | 'contact' | 'projects'
  const [editingId, setEditingId] = useState(null);

  // View Details Modal State
  const [viewManager, setViewManager] = useState(null);

  // Assign Reports Modal State
  const [assignModalManager, setAssignModalManager] = useState(null);
  const [selectedEmployeeIdsToAdd, setSelectedEmployeeIdsToAdd] = useState([]);
  const [assigningReports, setAssigningReports] = useState(false);

  // Reassign Single Report Modal State
  const [reassignModalReport, setReassignModalReport] = useState(null);
  const [newTargetManagerId, setNewTargetManagerId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [generatedPass, setGeneratedPass] = useState('');
  const [resettingPass, setResettingPass] = useState(false);

  // Create / Edit Form Data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    employeeId: '',
    role: 'Manager',
    department: '',
    designation: 'Team Leader',
    reportingManager: '',
    assignedTeam: '',
    assignedProjects: [],
    employmentType: 'Full-Time',
    phone: '',
    dateOfBirth: '',
    joiningDate: new Date().toISOString().split('T')[0],
    address: '',
    shiftTiming: {
      startTime: '09:30',
      endTime: '18:30',
      graceMinutes: 15,
    },
    weeklyOff: ['Saturday', 'Sunday'],
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
    },
    documents: [],
  });

  // Fetch managers list
  const fetchManagers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (selectedDept) params.department = selectedDept;
      if (selectedTeam) params.team = selectedTeam;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/managers', { params });
      if (res.data?.success) {
        setManagers(res.data.managers || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load manager directory.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown options & all employees for assignment
  const fetchAuxiliary = async () => {
    try {
      const [deptRes, teamRes, projRes, empRes] = await Promise.all([
        api.get('/departments'),
        api.get('/teams'),
        api.get('/work/projects'),
        api.get('/managers/available-employees'),
      ]);
      if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
      if (teamRes.data?.success) setTeams(teamRes.data.teams || []);
      if (projRes.data?.success) setProjects(projRes.data.projects || []);
      if (empRes.data?.success) setAvailableEmployees(empRes.data.employees || []);
    } catch (err) {
      console.error('Failed to load auxiliary options:', err);
    }
  };

  useEffect(() => {
    fetchAuxiliary();
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [selectedDept, selectedTeam, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchManagers();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('');
    setSelectedTeam('');
    setSelectedStatus('');
  };

  // Open Create Modal
  const handleOpenAddModal = () => {
    setEditingId(null);
    setModalTab('basic');
    setFormData({
      fullName: '',
      email: '',
      password: '',
      employeeId: '',
      role: 'Manager',
      department: departments[0]?._id || '',
      designation: 'Team Leader',
      reportingManager: '',
      assignedTeam: '',
      assignedProjects: [],
      employmentType: 'Full-Time',
      phone: '',
      dateOfBirth: '',
      joiningDate: new Date().toISOString().split('T')[0],
      address: '',
      shiftTiming: {
        startTime: '09:30',
        endTime: '18:30',
        graceMinutes: 15,
      },
      weeklyOff: ['Saturday', 'Sunday'],
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
      },
      documents: [],
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (m) => {
    setEditingId(m._id);
    setModalTab('basic');
    setFormData({
      fullName: m.fullName || '',
      email: m.email || '',
      password: '', // Leave blank unless updating
      employeeId: m.employeeId || '',
      role: m.role || 'Manager',
      department: m.department?._id || m.department || '',
      designation: m.designation || 'Team Leader',
      reportingManager: m.reportingManager?._id || m.reportingManager || '',
      assignedTeam: m.assignedTeam?._id || m.assignedTeam || '',
      assignedProjects: m.assignedProjects ? m.assignedProjects.map((p) => p._id || p) : [],
      employmentType: m.employmentType || 'Full-Time',
      phone: m.phone || '',
      dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split('T')[0] : '',
      joiningDate: m.joiningDate ? m.joiningDate.split('T')[0] : '',
      address: m.address || '',
      shiftTiming: {
        startTime: m.shiftTiming?.startTime || '09:30',
        endTime: m.shiftTiming?.endTime || '18:30',
        graceMinutes: m.shiftTiming?.graceMinutes !== undefined ? m.shiftTiming.graceMinutes : 15,
      },
      weeklyOff: m.weeklyOff && m.weeklyOff.length > 0 ? m.weeklyOff : ['Saturday', 'Sunday'],
      emergencyContact: {
        name: m.emergencyContact?.name || '',
        relationship: m.emergencyContact?.relationship || '',
        phone: m.emergencyContact?.phone || '',
      },
      documents: m.documents || [],
    });
    setShowModal(true);
  };

  // Save Manager (Create or Update)
  const handleSaveManager = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload = { ...formData };
        if (!payload.password || payload.password.trim() === '') {
          delete payload.password;
        }
        const res = await api.put(`/managers/${editingId}`, payload);
        toast.success(res.data.message || 'Manager updated successfully.');
      } else {
        if (!formData.password) {
          toast.warning('Temporary password is required for new manager account.');
          return;
        }
        const res = await api.post('/managers', formData);
        toast.success(res.data.message || 'Manager created successfully.');
      }
      setShowModal(false);
      fetchManagers();
      fetchAuxiliary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    }
  };

  // Toggle Account Status
  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    if (!window.confirm(`Are you sure you want to change this manager account status to ${nextStatus}?`)) {
      return;
    }
    try {
      const res = await api.patch(`/managers/${id}/status`, { status: nextStatus });
      toast.success(res.data.message || 'Status updated successfully.');
      fetchManagers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // Open Assign Reports Modal
  const handleOpenAssignModal = async (manager) => {
    try {
      const res = await api.get(`/managers/${manager._id}`);
      if (res.data?.success) {
        setAssignModalManager(res.data.manager);
        setSelectedEmployeeIdsToAdd([]);
      }
    } catch (err) {
      setAssignModalManager(manager);
    }
  };

  // Submit Assigned Reports
  const handleSubmitAssignReports = async (e) => {
    e.preventDefault();
    if (!assignModalManager || selectedEmployeeIdsToAdd.length === 0) {
      toast.warning('Please select at least one employee to assign.');
      return;
    }
    try {
      setAssigningReports(true);
      const res = await api.post(`/managers/${assignModalManager._id}/assign-reports`, {
        employeeIds: selectedEmployeeIdsToAdd,
      });
      toast.success(res.data.message || 'Employees successfully assigned.');
      setAssignModalManager(null);
      fetchManagers();
      fetchAuxiliary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign employees.');
    } finally {
      setAssigningReports(false);
    }
  };

  // Handle Reassign Single Report
  const handleReassignReportSubmit = async (e) => {
    e.preventDefault();
    if (!reassignModalReport) return;
    try {
      setReassigning(true);
      const res = await api.post(`/managers/${reassignModalReport.currentManagerId}/reassign-report`, {
        employeeId: reassignModalReport.employee._id,
        newManagerId: newTargetManagerId || null,
      });
      toast.success(res.data.message || 'Employee reassigned successfully.');
      setReassignModalReport(null);
      fetchManagers();
      fetchAuxiliary();
      if (viewManager) {
        // Refresh view manager modal
        const refRes = await api.get(`/managers/${viewManager._id}`);
        if (refRes.data?.success) setViewManager(refRes.data.manager);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign employee.');
    } finally {
      setReassigning(false);
    }
  };

  // Admin Reset Password
  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    try {
      setResettingPass(true);
      const res = await api.post(`/users/${resetModalUser._id}/reset-password`, {
        password: resetPasswordVal.trim() || undefined,
      });
      if (res.data?.success) {
        setGeneratedPass(res.data.temporaryPassword);
        toast.success(res.data.message || 'Password reset successfully.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResettingPass(false);
    }
  };

  // Top Metrics
  const stats = useMemo(() => {
    const total = managers.length;
    const active = managers.filter((m) => m.employmentStatus === 'Active').length;
    const inactive = total - active;
    const totalReports = managers.reduce((acc, m) => acc + (m.directReportsCount || 0), 0);
    return { total, active, inactive, totalReports };
  }, [managers]);

  return (
    <MainLayout
      title="Manager & Team Leader Administration"
      subtitle="Oversee management personnel, direct reporting structures, team assignments, and leadership accounts"
    >
      {/* 4 Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-xl-3 col-md-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Total Managers</div>
              <div className="fs-4 fw-bold text-dark mt-1">{stats.total}</div>
              <div className="small text-muted">Leadership & Team Leads</div>
            </div>
            <div className="stat-icon bg-primary bg-opacity-10 text-primary">
              <FiUserCheck />
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Active Managers</div>
              <div className="fs-4 fw-bold text-success mt-1">{stats.active}</div>
              <div className="small text-muted">Authorized to supervise</div>
            </div>
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <FiCheck />
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Inactive Managers</div>
              <div className={`fs-4 fw-bold mt-1 ${stats.inactive > 0 ? 'text-danger' : 'text-dark'}`}>
                {stats.inactive}
              </div>
              <div className="small text-muted">Deactivated accounts</div>
            </div>
            <div className="stat-icon bg-danger bg-opacity-10 text-danger">
              <FiX />
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="stat-card p-3 h-100">
            <div>
              <div className="text-muted small fw-semibold">Assigned Direct Reports</div>
              <div className="fs-4 fw-bold text-info mt-1">{stats.totalReports}</div>
              <div className="small text-muted">Employees actively managed</div>
            </div>
            <div className="stat-icon bg-info bg-opacity-10 text-info">
              <FiUsers />
            </div>
          </div>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="opt-card mb-4">
        <div className="opt-card-body p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
              <div className="d-flex align-items-center gap-1 text-muted small fw-semibold me-1">
                <FiFilter /> Filters:
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="input-group input-group-sm" style={{ maxWidth: 260 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search name, ID, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn btn-outline-primary" type="submit">
                  <FiSearch />
                </button>
              </form>

              {/* Department Filter */}
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 170 }}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Team Filter */}
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 160 }}
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 140 }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Probation">Probation</option>
                <option value="Terminated">Terminated</option>
              </select>

              {/* Reset Button */}
              <button
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                onClick={handleResetFilters}
                title="Reset filters"
              >
                <FiRotateCcw size={12} /> Reset
              </button>
            </div>

            {/* Add Manager Primary Action */}
            {isAdmin && (
              <button onClick={handleOpenAddModal} className="btn-opt-primary text-nowrap">
                <FiPlus /> Add New Manager
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Managers Directory Table */}
      <div className="opt-card mb-0">
        <div className="table-responsive">
          <table className="opt-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Employee ID</th>
                <th>Department & Designation</th>
                <th>Assigned Team & Projects</th>
                <th>Direct Reports</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                    Loading management directory...
                  </td>
                </tr>
              ) : managers.length > 0 ? (
                managers.map((m) => (
                  <tr key={m._id}>
                    {/* Manager Name & Email */}
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center"
                          style={{
                            width: 38,
                            height: 38,
                            backgroundColor: '#064E3B',
                            fontSize: '0.85rem',
                          }}
                        >
                          {m.fullName?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <div className="fw-bold text-dark d-flex align-items-center gap-2">
                            <span>{m.fullName}</span>
                            <span
                              className={`badge ${
                                m.role === 'Admin'
                                  ? 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                                  : 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25'
                              }`}
                              style={{ fontSize: '0.68rem' }}
                            >
                              {m.role}
                            </span>
                          </div>
                          <div className="text-muted small">
                            {m.email} {m.phone ? `• ${m.phone}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td>
                      <span className="badge bg-light text-dark border fw-semibold">{m.employeeId}</span>
                    </td>

                    {/* Department & Designation */}
                    <td>
                      <div className="fw-semibold text-dark">{m.designation || 'Team Leader'}</div>
                      <div className="text-muted small">{m.department?.name || 'General Core'}</div>
                    </td>

                    {/* Team & Projects */}
                    <td>
                      <div className="small">
                        <span className="text-muted">Team: </span>
                        <strong>{m.assignedTeam?.name || 'General'}</strong>
                      </div>
                      {m.assignedProjects && m.assignedProjects.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {m.assignedProjects.map((p) => (
                            <span
                              key={p._id || p}
                              className="badge bg-light text-primary border"
                              style={{ fontSize: '0.68rem' }}
                            >
                              📁 {p.name || 'Project'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          No project allocations
                        </div>
                      )}
                    </td>

                    {/* Direct Reports Count & Manage Button */}
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className={`badge ${
                            m.directReportsCount > 0
                              ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                              : 'bg-light text-muted border'
                          } py-1 px-2`}
                        >
                          <FiUsers className="me-1" />
                          {m.directReportsCount} Employee{m.directReportsCount !== 1 ? 's' : ''}
                        </span>

                        {isAdmin && (
                          <button
                            onClick={() => handleOpenAssignModal(m)}
                            className="btn btn-xs btn-outline-primary"
                            style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                            title="Assign / Manage Direct Reports"
                          >
                            <FiUserPlus size={11} /> Manage
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge-status ${m.employmentStatus ? m.employmentStatus.toLowerCase() : 'active'}`}>
                        {m.employmentStatus || 'Active'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {/* View Details */}
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.get(`/managers/${m._id}`);
                              if (res.data?.success) setViewManager(res.data.manager);
                              else setViewManager(m);
                            } catch {
                              setViewManager(m);
                            }
                          }}
                          className="btn btn-sm btn-outline-primary p-1 px-2"
                          title="View Profile & Team"
                        >
                          <FiEye size={14} />
                        </button>

                        {isAdmin && (
                          <>
                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(m)}
                              className="btn btn-sm btn-outline-secondary p-1 px-2"
                              title="Edit Manager"
                            >
                              <FiEdit2 size={14} />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResetModalUser(m);
                                setResetPasswordVal('');
                                setGeneratedPass('');
                              }}
                              className="btn btn-sm btn-outline-warning p-1 px-2"
                              title="Reset Password"
                            >
                              <FiKey size={14} />
                            </button>

                            {/* Status Toggle */}
                            <button
                              onClick={() => handleToggleStatus(m._id, m.employmentStatus)}
                              className={`btn btn-sm ${
                                m.employmentStatus === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'
                              } p-1 px-2`}
                              title={m.employmentStatus === 'Active' ? 'Deactivate' : 'Activate'}
                            >
                              {m.employmentStatus === 'Active' ? <FiX size={14} /> : <FiCheck size={14} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <FiUsers size={32} className="text-muted mb-2 d-block mx-auto" />
                    <div className="fw-bold text-dark">No Managers Found</div>
                    <div className="small text-muted">No manager accounts match your query parameters.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: View Manager Profile & Direct Reports Modal                       */}
      {/* ========================================================================= */}
      {viewManager && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center"
                    style={{ width: 48, height: 48, backgroundColor: '#064E3B', fontSize: 18 }}
                  >
                    {viewManager.fullName?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0">{viewManager.fullName}</h5>
                    <div className="text-muted small">
                      {viewManager.designation} • <span className="fw-semibold text-primary">{viewManager.employeeId}</span> •{' '}
                      <span className={`badge-status ${viewManager.employmentStatus?.toLowerCase()}`}>
                        {viewManager.employmentStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setViewManager(null)}></button>
              </div>

              <div className="modal-body p-4" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                <div className="row g-4 mb-4">
                  {/* Organization & Role */}
                  <div className="col-md-6">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom">
                      Organizational Information
                    </h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Department:</span>
                        <span className="fw-semibold">{viewManager.department?.name || 'Unassigned'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Assigned Team:</span>
                        <span className="fw-semibold">{viewManager.assignedTeam?.name || 'General'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Reports To:</span>
                        <span className="fw-semibold">{viewManager.reportingManager?.fullName || 'Senior Leadership / None'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Employment Type:</span>
                        <span className="fw-semibold">{viewManager.employmentType}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Joining Date:</span>
                        <span className="fw-semibold">
                          {viewManager.joiningDate ? new Date(viewManager.joiningDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Shift Timing */}
                  <div className="col-md-6">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom">
                      Contact & Shift Schedule
                    </h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Corporate Email:</span>
                        <span className="fw-semibold">{viewManager.email}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Phone Number:</span>
                        <span className="fw-semibold">{viewManager.phone || 'Not provided'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Shift Hours:</span>
                        <span className="fw-semibold">
                          {viewManager.shiftTiming?.startTime || '09:30'} - {viewManager.shiftTiming?.endTime || '18:30'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Weekly Off Days:</span>
                        <span className="fw-semibold">{(viewManager.weeklyOff || ['Saturday', 'Sunday']).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Projects */}
                  <div className="col-12">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom">
                      Assigned Projects & Work Streams
                    </h6>
                    {viewManager.assignedProjects && viewManager.assignedProjects.length > 0 ? (
                      <div className="d-flex flex-wrap gap-2">
                        {viewManager.assignedProjects.map((p) => (
                          <div key={p._id || p} className="p-2 border rounded bg-light d-flex align-items-center gap-2 small">
                            <FiFolder className="text-primary" />
                            <span className="fw-semibold text-dark">{p.name || 'Project'}</span>
                            {p.clientName && <span className="text-muted">({p.clientName})</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">No specific projects currently assigned.</div>
                    )}
                  </div>

                  {/* Direct Reports Team Roster */}
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                      <h6 className="fw-bold text-muted small text-uppercase m-0">
                        Employees Reporting to {viewManager.fullName} ({viewManager.directReports?.length || 0})
                      </h6>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            const mgr = viewManager;
                            setViewManager(null);
                            handleOpenAssignModal(mgr);
                          }}
                          className="btn btn-xs btn-outline-primary"
                        >
                          <FiUserPlus className="me-1" /> Add / Reassign Staff
                        </button>
                      )}
                    </div>

                    {viewManager.directReports && viewManager.directReports.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle">
                          <thead className="table-light small">
                            <tr>
                              <th>Employee</th>
                              <th>Employee ID</th>
                              <th>Department</th>
                              <th>Designation</th>
                              <th>Status</th>
                              {isAdmin && <th className="text-end">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="small">
                            {viewManager.directReports.map((emp) => (
                              <tr key={emp._id}>
                                <td className="fw-semibold text-dark">{emp.fullName}</td>
                                <td>
                                  <span className="badge bg-light text-secondary border">{emp.employeeId}</span>
                                </td>
                                <td>{emp.department?.name || 'General'}</td>
                                <td>{emp.designation || 'Staff'}</td>
                                <td>
                                  <span className={`badge-status ${emp.employmentStatus?.toLowerCase()}`}>
                                    {emp.employmentStatus}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td className="text-end">
                                    <button
                                      onClick={() => {
                                        setReassignModalReport({
                                          employee: emp,
                                          currentManagerId: viewManager._id,
                                          currentManagerName: viewManager.fullName,
                                        });
                                        setNewTargetManagerId('');
                                      }}
                                      className="btn btn-xs btn-outline-secondary"
                                      title="Reassign to another manager"
                                    >
                                      Reassign
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 text-center bg-light rounded text-muted small">
                        No employees currently reporting to this manager.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setViewManager(null)}>
                  Close
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-opt-primary"
                    onClick={() => {
                      const mToEdit = viewManager;
                      setViewManager(null);
                      handleOpenEditModal(mToEdit);
                    }}
                  >
                    Edit Manager
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Create / Edit Manager Modal                                      */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark">
                    {editingId ? 'Edit Manager Profile' : 'Onboard New Manager'}
                  </h5>
                  <div className="text-muted small">
                    Configure leadership credentials, department, team leadership, and work schedules
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              {/* Modal Tabs */}
              <div className="px-4 pt-2 border-bottom bg-light">
                <ul className="nav nav-pills gap-2 pb-2">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalTab === 'basic' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setModalTab('basic')}
                    >
                      1. Basic & Role
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalTab === 'timing' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setModalTab('timing')}
                    >
                      2. Shift & Timing
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalTab === 'contact' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setModalTab('contact')}
                    >
                      3. Contact Details
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalTab === 'projects' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setModalTab('projects')}
                    >
                      4. Assigned Projects ({formData.assignedProjects.length})
                    </button>
                  </li>
                </ul>
              </div>

              <form onSubmit={handleSaveManager}>
                <div className="modal-body p-4" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  {/* TAB 1: BASIC & ROLE */}
                  {modalTab === 'basic' && (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Full Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="e.g. Priya Verma"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Work Email *</label>
                        <input
                          type="email"
                          className="form-control"
                          required
                          placeholder="name@oneplanet.tech"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          {editingId ? 'Reset Password (optional)' : 'Temporary Password *'}
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder={editingId ? 'Leave blank to preserve password' : 'Min 6 characters'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Employee ID (Optional Auto-Gen)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. OPT-1002"
                          value={formData.employeeId}
                          onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Role *</label>
                        <select
                          className="form-select"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                          <option value="Manager">Manager / Team Leader</option>
                          <option value="Admin">Admin / Management</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Department</label>
                        <select
                          className="form-select"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        >
                          <option value="">Select Department</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Designation</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Engineering Lead"
                          value={formData.designation}
                          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Assigned Team</label>
                        <select
                          className="form-select"
                          value={formData.assignedTeam}
                          onChange={(e) => setFormData({ ...formData, assignedTeam: e.target.value })}
                        >
                          <option value="">No Team Assigned</option>
                          {teams.map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Senior Reporting Manager</label>
                        <select
                          className="form-select"
                          value={formData.reportingManager}
                          onChange={(e) => setFormData({ ...formData, reportingManager: e.target.value })}
                        >
                          <option value="">Senior Management / None</option>
                          {managers
                            .filter((m) => m._id !== editingId)
                            .map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.fullName} ({m.role} - {m.employeeId})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Employment Type</label>
                        <select
                          className="form-select"
                          value={formData.employmentType}
                          onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                        >
                          <option value="Full-Time">Full-Time</option>
                          <option value="Part-Time">Part-Time</option>
                          <option value="Contract">Contract</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Joining Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.joiningDate}
                          onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Date of Birth</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.dateOfBirth}
                          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SHIFT TIMINGS & WEEKLY OFFS */}
                  {modalTab === 'timing' && (
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Shift Start Time *</label>
                        <input
                          type="time"
                          className="form-control"
                          required
                          value={formData.shiftTiming.startTime}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              shiftTiming: { ...formData.shiftTiming, startTime: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Shift End Time *</label>
                        <input
                          type="time"
                          className="form-control"
                          required
                          value={formData.shiftTiming.endTime}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              shiftTiming: { ...formData.shiftTiming, endTime: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Grace Period (Minutes)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="60"
                          value={formData.shiftTiming.graceMinutes}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              shiftTiming: { ...formData.shiftTiming, graceMinutes: Number(e.target.value) },
                            })
                          }
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label small fw-semibold">Weekly Off Days</label>
                        <div className="d-flex flex-wrap gap-2">
                          {WEEKDAYS.map((day) => {
                            const isOff = formData.weeklyOff.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const updated = isOff
                                    ? formData.weeklyOff.filter((d) => d !== day)
                                    : [...formData.weeklyOff, day];
                                  setFormData({ ...formData, weeklyOff: updated });
                                }}
                                className={`btn btn-sm ${isOff ? 'btn-primary' : 'btn-outline-secondary'}`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CONTACT DETAILS */}
                  {modalTab === 'contact' && (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Phone Number</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="+91 9876543210"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label small fw-semibold">Residential Address</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Complete residential address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        ></textarea>
                      </div>

                      <div className="col-12">
                        <h6 className="fw-bold text-muted small text-uppercase mt-2 mb-2 pb-1 border-bottom">
                          Emergency Contact
                        </h6>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Contact Person Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.emergencyContact.name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergencyContact: { ...formData.emergencyContact, name: e.target.value },
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
                          value={formData.emergencyContact.relationship}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergencyContact: { ...formData.emergencyContact, relationship: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Emergency Phone</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={formData.emergencyContact.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              emergencyContact: { ...formData.emergencyContact, phone: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ASSIGNED PROJECTS */}
                  {modalTab === 'projects' && (
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="alert alert-info py-2 small mb-2">
                          Select the projects and client deliverables this manager supervises.
                        </div>
                      </div>

                      <div className="col-12">
                        <div
                          className="p-3 border rounded bg-light d-flex flex-wrap gap-2"
                          style={{ maxHeight: 250, overflowY: 'auto' }}
                        >
                          {projects.length > 0 ? (
                            projects.map((p) => {
                              const isAssigned = formData.assignedProjects.includes(p._id);
                              return (
                                <div
                                  key={p._id}
                                  onClick={() => {
                                    const updated = isAssigned
                                      ? formData.assignedProjects.filter((id) => id !== p._id)
                                      : [...formData.assignedProjects, p._id];
                                    setFormData({ ...formData, assignedProjects: updated });
                                  }}
                                  className={`p-2 px-3 rounded border small cursor-pointer d-flex align-items-center gap-2 ${
                                    isAssigned
                                      ? 'bg-primary text-white border-primary fw-semibold'
                                      : 'bg-white text-dark'
                                  }`}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <input
                                    type="checkbox"
                                    className="form-check-input m-0"
                                    checked={isAssigned}
                                    readOnly
                                  />
                                  <span>{p.name}</span>
                                  {p.clientName && (
                                    <span className="small opacity-75">({p.clientName})</span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-muted small">No active projects available to assign.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-opt-primary">
                    {editingId ? 'Save Manager Profile' : 'Create Manager Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Assign / Manage Direct Reports Modal                             */}
      {/* ========================================================================= */}
      {assignModalManager && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <FiUserPlus className="text-primary" /> Assign Direct Reports
                  </h5>
                  <div className="small text-muted">
                    Supervising Manager: <span className="fw-semibold text-dark">{assignModalManager.fullName}</span>{' '}
                    ({assignModalManager.employeeId})
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setAssignModalManager(null)}></button>
              </div>

              <form onSubmit={handleSubmitAssignReports}>
                <div className="modal-body p-4" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  {/* Current Reports */}
                  <h6 className="fw-bold text-muted small text-uppercase mb-2">
                    Currently Assigned Reports ({assignModalManager.directReports?.length || 0})
                  </h6>
                  {assignModalManager.directReports && assignModalManager.directReports.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2 mb-4">
                      {assignModalManager.directReports.map((emp) => (
                        <div
                          key={emp._id}
                          className="p-2 border rounded bg-white small d-flex align-items-center gap-2"
                        >
                          <FiUser className="text-success" />
                          <span className="fw-semibold text-dark">{emp.fullName}</span>
                          <span className="badge bg-light text-secondary border">{emp.employeeId}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-light rounded text-muted small mb-4">
                      No employees are currently assigned to report to this manager.
                    </div>
                  )}

                  {/* Add New Employees to Report to this Manager */}
                  <h6 className="fw-bold text-muted small text-uppercase mb-2">
                    Select Staff Members to Assign ({selectedEmployeeIdsToAdd.length} selected)
                  </h6>
                  <p className="small text-muted mb-2">
                    Select active employees below. Saving will update their reporting manager relationship in MongoDB.
                  </p>

                  <div
                    className="p-3 border rounded bg-light d-flex flex-column gap-2"
                    style={{ maxHeight: 220, overflowY: 'auto' }}
                  >
                    {availableEmployees
                      .filter((e) => e._id !== assignModalManager._id)
                      .map((emp) => {
                        const isAlreadyReporting =
                          assignModalManager.directReports?.some((r) => r._id === emp._id) ||
                          emp.reportingManager?._id === assignModalManager._id;
                        const isSelected = selectedEmployeeIdsToAdd.includes(emp._id);

                        return (
                          <div
                            key={emp._id}
                            onClick={() => {
                              if (isAlreadyReporting) return;
                              const updated = isSelected
                                ? selectedEmployeeIdsToAdd.filter((id) => id !== emp._id)
                                : [...selectedEmployeeIdsToAdd, emp._id];
                              setSelectedEmployeeIdsToAdd(updated);
                            }}
                            className={`p-2 rounded border small d-flex justify-content-between align-items-center ${
                              isAlreadyReporting
                                ? 'bg-light text-muted opacity-75'
                                : isSelected
                                ? 'bg-primary text-white border-primary fw-semibold'
                                : 'bg-white text-dark cursor-pointer'
                            }`}
                            style={{ cursor: isAlreadyReporting ? 'not-allowed' : 'pointer' }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="checkbox"
                                className="form-check-input m-0"
                                checked={isAlreadyReporting || isSelected}
                                disabled={isAlreadyReporting}
                                readOnly
                              />
                              <span>
                                {emp.fullName} ({emp.employeeId})
                              </span>
                              <span className="small opacity-75">• {emp.department?.name || 'General'}</span>
                            </div>

                            <span className="small">
                              {isAlreadyReporting
                                ? 'Already Reporting'
                                : emp.reportingManager
                                ? `Current: ${emp.reportingManager.fullName}`
                                : 'Unassigned'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setAssignModalManager(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-opt-primary" disabled={assigningReports}>
                    {assigningReports ? 'Saving...' : 'Confirm Assignments'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Reassign Single Report Modal                                     */}
      {/* ========================================================================= */}
      {reassignModalReport && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark">Reassign Employee</h5>
                  <div className="small text-muted">
                    Employee: <span className="fw-semibold text-dark">{reassignModalReport.employee.fullName}</span> (
                    {reassignModalReport.employee.employeeId})
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setReassignModalReport(null)}></button>
              </div>

              <form onSubmit={handleReassignReportSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Current Supervising Manager</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled
                      value={reassignModalReport.currentManagerName}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Transfer to New Manager *</label>
                    <select
                      className="form-select"
                      value={newTargetManagerId}
                      onChange={(e) => setNewTargetManagerId(e.target.value)}
                    >
                      <option value="">Unassign / No Manager</option>
                      {managers
                        .filter((m) => m._id !== reassignModalReport.currentManagerId)
                        .map((m) => (
                          <option key={m._id} value={m._id}>
                            {m.fullName} ({m.role} - {m.employeeId})
                          </option>
                        ))}
                    </select>
                    <div className="small text-muted mt-1">
                      Selecting a new manager updates the employee's reportingManager reference in MongoDB.
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setReassignModalReport(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-opt-primary" disabled={reassigning}>
                    {reassigning ? 'Transferring...' : 'Confirm Reassignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: Reset Password Modal                                             */}
      {/* ========================================================================= */}
      {resetModalUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <FiKey className="text-warning" /> Reset Manager Password
                  </h5>
                  <div className="small text-muted">
                    Account: <span className="fw-semibold text-dark">{resetModalUser.fullName}</span> ({resetModalUser.employeeId})
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setResetModalUser(null)}></button>
              </div>

              <form onSubmit={handleAdminResetPassword}>
                <div className="modal-body p-4">
                  {generatedPass ? (
                    <div className="alert alert-success border-success">
                      <div className="fw-bold mb-1 text-success d-flex align-items-center gap-2">
                        <FiCheck /> Password Successfully Reset!
                      </div>
                      <p className="small text-muted mb-2">
                        Provide this temporary password to the manager. They should update it upon next sign in.
                      </p>
                      <div className="d-flex align-items-center gap-2 p-2 bg-white rounded border">
                        <code className="fs-6 fw-bold text-dark flex-grow-1 user-select-all">{generatedPass}</code>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedPass);
                            toast.info('Copied temporary password to clipboard!');
                          }}
                        >
                          <FiCopy size={12} /> Copy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="small text-muted mb-3">
                        Enter a new password or leave blank to automatically generate a secure 10-character temporary password.
                      </p>

                      <div className="mb-3">
                        <label className="form-label small fw-semibold">New Password (Optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Leave blank to auto-generate"
                          value={resetPasswordVal}
                          onChange={(e) => setResetPasswordVal(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="modal-footer bg-light border-top">
                  <button type="button" className="btn btn-secondary" onClick={() => setResetModalUser(null)}>
                    {generatedPass ? 'Close' : 'Cancel'}
                  </button>
                  {!generatedPass && (
                    <button type="submit" className="btn-opt-primary" disabled={resettingPass}>
                      {resettingPass ? 'Resetting...' : 'Confirm Reset Password'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
