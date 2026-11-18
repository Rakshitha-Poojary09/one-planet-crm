import React, { useEffect, useState } from 'react';
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
  FiTrash2,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiLock,
  FiKey,
  FiCopy,
  FiFolder,
} from 'react-icons/fi';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const Employees = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('basic'); // 'basic' | 'timing' | 'contact' | 'documents'
  const [editingId, setEditingId] = useState(null);

  // View Modal State
  const [viewEmployee, setViewEmployee] = useState(null);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [generatedPass, setGeneratedPass] = useState('');
  const [resettingPass, setResettingPass] = useState(false);

  // New Document Input State for Add/Edit
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    employeeId: '',
    role: 'Employee',
    department: '',
    designation: '',
    reportingManager: '',
    assignedTeam: '',
    assignedProjects: [],
    employmentType: 'Full-Time',
    phone: '',
    dateOfBirth: '',
    joiningDate: '',
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

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (selectedDept) params.department = selectedDept;
      if (selectedRole) params.role = selectedRole;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/users', { params });
      if (res.data?.success) {
        setEmployees(res.data.users);
      }
    } catch (err) {
      toast.error('Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliary = async () => {
    try {
      const [deptRes, teamRes, userRes, projRes] = await Promise.all([
        api.get('/departments'),
        api.get('/teams'),
        api.get('/users'),
        api.get('/work/projects'),
      ]);
      if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
      if (teamRes.data?.success) setTeams(teamRes.data.teams || []);
      if (projRes.data?.success) setProjects(projRes.data.projects || []);
      if (userRes.data?.success) {
        const potentialManagers = (userRes.data.users || []).filter(
          (u) => u.role === 'Admin' || u.role === 'Manager'
        );
        setManagers(potentialManagers);
      }
    } catch (err) {
      console.error('Failed to fetch auxiliary data:', err);
    }
  };

  useEffect(() => {
    fetchAuxiliary();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [selectedDept, selectedRole, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEmployees();
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setModalTab('basic');
    setFormData({
      fullName: '',
      email: '',
      password: '',
      employeeId: '',
      role: 'Employee',
      department: departments[0]?._id || '',
      designation: '',
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

  const handleOpenEditModal = (emp) => {
    setEditingId(emp._id);
    setModalTab('basic');
    setFormData({
      fullName: emp.fullName || '',
      email: emp.email || '',
      password: '', // blank unless changing
      employeeId: emp.employeeId || '',
      role: emp.role || 'Employee',
      department: emp.department?._id || emp.department || '',
      designation: emp.designation || '',
      reportingManager: emp.reportingManager?._id || emp.reportingManager || '',
      assignedTeam: emp.assignedTeam?._id || emp.assignedTeam || '',
      assignedProjects: emp.assignedProjects
        ? emp.assignedProjects.map((p) => p._id || p)
        : [],
      employmentType: emp.employmentType || 'Full-Time',
      phone: emp.phone || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
      address: emp.address || '',
      shiftTiming: {
        startTime: emp.shiftTiming?.startTime || '09:30',
        endTime: emp.shiftTiming?.endTime || '18:30',
        graceMinutes: emp.shiftTiming?.graceMinutes !== undefined ? emp.shiftTiming.graceMinutes : 15,
      },
      weeklyOff: emp.weeklyOff && emp.weeklyOff.length > 0 ? emp.weeklyOff : ['Saturday', 'Sunday'],
      emergencyContact: {
        name: emp.emergencyContact?.name || '',
        relationship: emp.emergencyContact?.relationship || '',
        phone: emp.emergencyContact?.phone || '',
      },
      documents: emp.documents || [],
    });
    setShowModal(true);
  };

  const handleWeeklyOffToggle = (day) => {
    setFormData((prev) => {
      const exists = prev.weeklyOff.includes(day);
      const updated = exists ? prev.weeklyOff.filter((d) => d !== day) : [...prev.weeklyOff, day];
      return { ...prev, weeklyOff: updated };
    });
  };

  const handleAddDocument = (e) => {
    e.preventDefault();
    if (!newDocName.trim() || !newDocUrl.trim()) {
      toast.warning('Please enter both document title and file URL.');
      return;
    }
    const newDoc = {
      name: newDocName.trim(),
      fileUrl: newDocUrl.trim(),
      uploadDate: new Date(),
    };
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));
    setNewDocName('');
    setNewDocUrl('');
  };

  const handleRemoveDocument = (index) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, idx) => idx !== index),
    }));
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update
        const payload = { ...formData };
        if (!payload.password || payload.password.trim() === '') {
          delete payload.password;
        }
        const res = await api.put(`/users/${editingId}`, payload);
        toast.success(res.data.message || 'Employee updated successfully.');
      } else {
        // Create
        if (!formData.password) {
          toast.warning('Temporary password is required for new employee.');
          return;
        }
        const res = await api.post('/users', formData);
        toast.success(res.data.message || 'Employee account created successfully.');
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    }
  };

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

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    if (!window.confirm(`Are you sure you want to change this employee status to ${nextStatus}?`)) {
      return;
    }
    try {
      const res = await api.patch(`/users/${id}/status`, { status: nextStatus });
      toast.success(res.data.message || 'Status updated successfully.');
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change status.');
    }
  };

  return (
    <MainLayout title="Employee Management" subtitle="Manage accounts, profiles, shift timings, and reporting structure">
      {/* Top Action Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        {/* Search & Filters */}
        <div className="d-flex flex-wrap gap-2 flex-grow-1" style={{ maxWidth: 840 }}>
          <form onSubmit={handleSearchSubmit} className="input-group" style={{ maxWidth: 280 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, ID, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
              <FiSearch />
            </button>
          </form>

          <select
            className="form-select"
            style={{ maxWidth: 180 }}
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

          <select
            className="form-select"
            style={{ maxWidth: 150 }}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Employee">Employee</option>
          </select>

          <select
            className="form-select"
            style={{ maxWidth: 150 }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Probation">Probation</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>

        {/* Add Employee Button (Admin only) */}
        {isAdmin && (
          <button onClick={handleOpenAddModal} className="btn-opt-primary">
            <FiPlus /> Add New Employee
          </button>
        )}
      </div>

      {/* Employees Table */}
      <div className="opt-card mb-0">
        <div className="table-responsive">
          <table className="opt-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Designation & Role</th>
                <th>Reporting & Team</th>
                <th>Shift & Work Hours</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                    Loading employee directory...
                  </td>
                </tr>
              ) : employees.length > 0 ? (
                employees.map((emp) => (
                  <tr key={emp._id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center"
                          style={{ width: 38, height: 38, fontSize: 14 }}
                        >
                          {emp.fullName ? emp.fullName.charAt(0) : 'U'}
                        </div>
                        <div>
                          <div className="fw-semibold text-dark">{emp.fullName}</div>
                          <div className="text-muted small">
                            <span className="badge bg-light text-dark border me-1">{emp.employeeId}</span>
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="fw-medium text-dark">{emp.department?.name || 'Unassigned'}</span>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{emp.designation || 'Associate'}</div>
                      <span
                        className={`badge ${
                          emp.role === 'Admin'
                            ? 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                            : emp.role === 'Manager'
                            ? 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25'
                            : 'bg-light text-secondary border'
                        }`}
                      >
                        {emp.role}
                      </span>
                    </td>
                    <td>
                      <div className="small">
                        <span className="text-muted">Lead: </span>
                        <strong>{emp.reportingManager?.fullName || 'None'}</strong>
                      </div>
                      <div className="small text-muted">
                        Team: {emp.assignedTeam?.name || 'General Core'}
                      </div>
                      {emp.assignedProjects && emp.assignedProjects.length > 0 && (
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {emp.assignedProjects.map((p) => (
                            <span key={p._id || p} className="badge bg-light text-primary border" style={{ fontSize: '0.68rem' }}>
                              📁 {p.name || 'Project'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="small text-dark fw-medium">
                        <FiClock className="me-1 text-muted" />
                        {emp.shiftTiming?.startTime || '09:30'} - {emp.shiftTiming?.endTime || '18:30'}
                      </div>
                      <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        Off: {(emp.weeklyOff || ['Sat', 'Sun']).join(', ')}
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status ${emp.employmentStatus ? emp.employmentStatus.toLowerCase() : 'active'}`}>
                        {emp.employmentStatus || 'Active'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          onClick={() => setViewEmployee(emp)}
                          className="btn btn-sm btn-outline-primary p-1 px-2"
                          title="View Profile"
                        >
                          <FiEye size={14} />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(emp)}
                              className="btn btn-sm btn-outline-secondary p-1 px-2"
                              title="Edit Employee"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setResetModalUser(emp);
                                setResetPasswordVal('');
                                setGeneratedPass('');
                              }}
                              className="btn btn-sm btn-outline-warning p-1 px-2"
                              title="Reset Password"
                            >
                              <FiKey size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(emp._id, emp.employmentStatus)}
                              className={`btn btn-sm ${
                                emp.employmentStatus === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'
                              } p-1 px-2`}
                              title={emp.employmentStatus === 'Active' ? 'Deactivate' : 'Activate'}
                            >
                              {emp.employmentStatus === 'Active' ? <FiX size={14} /> : <FiCheck size={14} />}
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
                    No employees found matching the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= VIEW PROFILE MODAL ================= */}
      {viewEmployee && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-light">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center"
                    style={{ width: 48, height: 48, fontSize: 20 }}
                  >
                    {viewEmployee.fullName?.charAt(0)}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0">{viewEmployee.fullName}</h5>
                    <div className="text-muted small">
                      {viewEmployee.designation} • <span className="fw-semibold text-primary">{viewEmployee.employeeId}</span>
                    </div>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setViewEmployee(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-4">
                  {/* Column 1: Organization & Role */}
                  <div className="col-md-6">
                    <h6 className="fw-bold text-muted small text-uppercase mb-3 pb-1 border-bottom">
                      Organization Details
                    </h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Role:</span>
                        <span className="fw-semibold">{viewEmployee.role}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Department:</span>
                        <span className="fw-semibold">{viewEmployee.department?.name || 'Unassigned'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Reporting Manager:</span>
                        <span className="fw-semibold">{viewEmployee.reportingManager?.fullName || 'None'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Assigned Team:</span>
                        <span className="fw-semibold">{viewEmployee.assignedTeam?.name || 'General Core'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Employment Type:</span>
                        <span className="fw-semibold">{viewEmployee.employmentType}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Status:</span>
                        <span className={`badge-status ${viewEmployee.employmentStatus?.toLowerCase()}`}>
                          {viewEmployee.employmentStatus}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Joining Date:</span>
                        <span className="fw-semibold">
                          {viewEmployee.joiningDate ? new Date(viewEmployee.joiningDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Shift, Timing & Schedule */}
                  <div className="col-md-6">
                    <h6 className="fw-bold text-muted small text-uppercase mb-3 pb-1 border-bottom">
                      Shift Timing & Work Schedule
                    </h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Shift Hours:</span>
                        <span className="fw-semibold">
                          {viewEmployee.shiftTiming?.startTime || '09:30'} to {viewEmployee.shiftTiming?.endTime || '18:30'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Grace Period:</span>
                        <span className="fw-semibold">{viewEmployee.shiftTiming?.graceMinutes ?? 15} mins</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Weekly Off Days:</span>
                        <span className="fw-semibold">{(viewEmployee.weeklyOff || ['Saturday', 'Sunday']).join(', ')}</span>
                      </div>
                    </div>

                    <h6 className="fw-bold text-muted small text-uppercase mt-4 mb-3 pb-1 border-bottom">
                      Personal & Emergency Contact
                    </h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Email:</span>
                        <span className="fw-semibold">{viewEmployee.email}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Phone:</span>
                        <span className="fw-semibold">{viewEmployee.phone || 'Not provided'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Address:</span>
                        <span className="fw-semibold">{viewEmployee.address || 'Not provided'}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Emergency Contact:</span>
                        <span className="fw-semibold">
                          {viewEmployee.emergencyContact?.name
                            ? `${viewEmployee.emergencyContact.name} (${viewEmployee.emergencyContact.relationship || 'Contact'}) - ${viewEmployee.emergencyContact.phone}`
                            : 'None recorded'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Projects Section */}
                  <div className="col-12">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom">
                      Assigned Projects & Work Streams
                    </h6>
                    {viewEmployee.assignedProjects && viewEmployee.assignedProjects.length > 0 ? (
                      <div className="d-flex flex-wrap gap-2">
                        {viewEmployee.assignedProjects.map((p) => (
                          <div
                            key={p._id || p}
                            className="p-2 border rounded bg-light d-flex align-items-center gap-2 small"
                          >
                            <FiFolder className="text-primary" />
                            <span className="fw-semibold text-dark">{p.name || 'Project'}</span>
                            {p.clientName && <span className="text-muted">({p.clientName})</span>}
                            {p.status && (
                              <span className="badge bg-white text-secondary border ms-1" style={{ fontSize: '0.7rem' }}>
                                {p.status}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">No specific projects currently assigned.</div>
                    )}
                  </div>

                  {/* Documents Section with Security Protection */}
                  <div className="col-12">
                    <h6 className="fw-bold text-muted small text-uppercase mb-2 pb-1 border-bottom d-flex align-items-center justify-content-between">
                      <span>Authorized Employment Documents</span>
                      <span className="badge bg-light text-secondary border fw-normal" style={{ fontSize: '0.72rem' }}>
                        <FiShield className="me-1" /> Confidential HR Records
                      </span>
                    </h6>
                    {isAdmin || currentUser?._id === viewEmployee?._id || currentUser?.role === 'Manager' ? (
                      viewEmployee.documents && viewEmployee.documents.length > 0 ? (
                        <div className="row g-2">
                          {viewEmployee.documents.map((doc, idx) => (
                            <div key={idx} className="col-md-6">
                              <div className="p-2 border rounded d-flex justify-content-between align-items-center bg-light">
                                <div className="d-flex align-items-center gap-2 small">
                                  <FiFileText className="text-primary" />
                                  <span className="fw-medium">{doc.name}</span>
                                </div>
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-primary py-0 px-2"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  View
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted small">No employment documents uploaded for this profile.</div>
                      )
                    ) : (
                      <div className="p-3 bg-light rounded text-muted small border d-flex align-items-center gap-2">
                        <FiShield className="text-secondary" />
                        Employment documents are restricted to authorized personnel.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary" onClick={() => setViewEmployee(null)}>
                  Close
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const empToEdit = viewEmployee;
                      setViewEmployee(null);
                      handleOpenEditModal(empToEdit);
                    }}
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT EMPLOYEE MODAL ================= */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header pb-2">
                <div>
                  <h5 className="modal-title fw-bold">
                    {editingId ? 'Edit Employee Profile' : 'Onboard New Employee'}
                  </h5>
                  <div className="text-muted small">
                    Configure corporate account, reporting line, timings, and employment records
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              {/* Modal Navigation Tabs */}
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
                      2. Shift & Weekly Offs
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalTab === 'contact' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setModalTab('contact')}
                    >
                      3. Contact & Emergency
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${modalTab === 'documents' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setModalTab('documents')}
                    >
                      4. Documents ({formData.documents.length})
                    </button>
                  </li>
                </ul>
              </div>

              <form onSubmit={handleSaveEmployee}>
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
                          placeholder="e.g. Aarav Sharma"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Corporate Email *</label>
                        <input
                          type="email"
                          className="form-control"
                          required
                          disabled={!!editingId}
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
                          placeholder="e.g. OPT-1005"
                          disabled={!!editingId}
                          value={formData.employeeId}
                          onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">User Role *</label>
                        <select
                          className="form-select"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                          <option value="Employee">Employee / Intern</option>
                          <option value="Manager">Team Leader / Manager</option>
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
                          placeholder="e.g. Senior Software Engineer"
                          value={formData.designation}
                          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Reporting Manager</label>
                        <select
                          className="form-select"
                          value={formData.reportingManager}
                          onChange={(e) => setFormData({ ...formData, reportingManager: e.target.value })}
                        >
                          <option value="">No Reporting Manager</option>
                          {managers
                            .filter((m) => m._id !== editingId)
                            .map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.fullName} ({m.role} - {m.employeeId})
                              </option>
                            ))}
                        </select>
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
                          <option value="Intern">Intern</option>
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

                      {/* Project Assignments */}
                      <div className="col-12">
                        <label className="form-label small fw-semibold">
                          Assigned Projects & Work Streams ({formData.assignedProjects.length} selected)
                        </label>
                        <div
                          className="p-2 border rounded bg-light d-flex flex-wrap gap-2"
                          style={{ maxHeight: 150, overflowY: 'auto' }}
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
                                  className={`p-1 px-2 rounded border small cursor-pointer d-flex align-items-center gap-2 ${
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

                  {/* TAB 2: SHIFT TIMINGS & WEEKLY OFFS */}
                  {modalTab === 'timing' && (
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="alert alert-info py-2 small mb-3">
                          Working hours and weekly offs are factored into daily attendance calculations and absence tracking.
                        </div>
                      </div>

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
                          min="0"
                          max="60"
                          className="form-control"
                          value={formData.shiftTiming.graceMinutes}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              shiftTiming: { ...formData.shiftTiming, graceMinutes: Number(e.target.value) },
                            })
                          }
                        />
                      </div>

                      <div className="col-12 mt-4">
                        <label className="form-label small fw-semibold d-block">Configured Weekly Offs</label>
                        <div className="d-flex flex-wrap gap-2">
                          {WEEKDAYS.map((day) => {
                            const isChecked = formData.weeklyOff.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleWeeklyOffToggle(day)}
                                className={`btn btn-sm ${isChecked ? 'btn-primary' : 'btn-outline-secondary'}`}
                              >
                                {isChecked && <FiCheck className="me-1" />}
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CONTACT & EMERGENCY */}
                  {modalTab === 'contact' && (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Contact Phone Number</label>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Residential Address</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Apartment, Street, City"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>

                      <div className="col-12 mt-3">
                        <h6 className="fw-bold small text-muted text-uppercase mb-2">Emergency Contact Details</h6>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Contact Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Ramesh Sharma"
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
                          placeholder="e.g. Father, Spouse"
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
                          placeholder="+91 98765 00000"
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

                  {/* TAB 4: EMPLOYMENT DOCUMENTS */}
                  {modalTab === 'documents' && (
                    <div>
                      <div className="p-3 bg-light rounded border mb-3">
                        <div className="fw-semibold small mb-2">Attach Authorized Document</div>
                        <div className="row g-2">
                          <div className="col-md-5">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Document Name (e.g. Offer Letter)"
                              value={newDocName}
                              onChange={(e) => setNewDocName(e.target.value)}
                            />
                          </div>
                          <div className="col-md-5">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="File or Cloud Document URL"
                              value={newDocUrl}
                              onChange={(e) => setNewDocUrl(e.target.value)}
                            />
                          </div>
                          <div className="col-md-2">
                            <button
                              type="button"
                              onClick={handleAddDocument}
                              className="btn btn-sm btn-primary w-100"
                            >
                              Add Doc
                            </button>
                          </div>
                        </div>
                      </div>

                      <h6 className="fw-bold small text-muted text-uppercase mb-2">Attached Documents</h6>
                      {formData.documents && formData.documents.length > 0 ? (
                        <div className="list-group">
                          {formData.documents.map((doc, idx) => (
                            <div
                              key={idx}
                              className="list-group-item d-flex justify-content-between align-items-center py-2"
                            >
                              <div>
                                <div className="fw-semibold small">{doc.name}</div>
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                  {doc.fileUrl}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument(idx)}
                                className="btn btn-sm text-danger p-0 border-0"
                                title="Remove document"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted small">No documents attached yet.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingId ? 'Save Profile Changes' : 'Create Employee Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADMIN PASSWORD RESET MODAL ================= */}
      {resetModalUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
              <div className="modal-header bg-light border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <FiKey className="text-warning" /> Reset Employee Password
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
                        Provide this temporary password to the employee. They should update it upon next sign in.
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
