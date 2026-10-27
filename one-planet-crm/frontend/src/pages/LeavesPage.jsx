import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiPlus,
  FiCalendar,
  FiCheck,
  FiX,
  FiClock,
  FiTrash2,
  FiPaperclip,
  FiUsers,
  FiFilter,
  FiSettings,
} from 'react-icons/fi';

export const LeavesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');

  // Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayPeriod: 'None',
    reason: '',
    attachment: '',
  });

  // Admin Allocate Quota Modal
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    user: '',
    leaveType: '',
    year: String(new Date().getFullYear()),
    allocated: 12,
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/leaves', { params });
      if (res.data?.success) {
        setLeaves(res.data.leaves || []);
      }
    } catch (err) {
      toast.error('Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveData = async () => {
    try {
      const [typeRes, balRes] = await Promise.all([
        api.get('/leaves/types'),
        api.get('/leaves/balances/my'),
      ]);
      if (typeRes.data?.success) setLeaveTypes(typeRes.data.leaveTypes || []);
      if (balRes.data?.success) setBalances(balRes.data.balances || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/users');
      if (res.data?.success) setEmployees(res.data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus]);

  useEffect(() => {
    fetchLeaveData();
    fetchEmployees();
  }, []);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/leaves', formData);
      toast.success(res.data.message || 'Leave applied successfully.');
      setShowApplyModal(false);
      fetchLeaves();
      fetchLeaveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit leave.');
    }
  };

  const handleAllocateQuota = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/leaves/balances', allocateForm);
      toast.success(res.data.message || 'Leave balance allocated successfully.');
      setShowAllocateModal(false);
      fetchLeaveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allocate leave quota.');
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave?')) return;
    try {
      const res = await api.put(`/leaves/${id}/cancel`);
      toast.success(res.data.message);
      fetchLeaves();
      fetchLeaveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  const handleDeleteLeave = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave record?')) return;
    try {
      const res = await api.delete(`/leaves/${id}`);
      toast.success(res.data.message || 'Leave record deleted.');
      fetchLeaves();
      fetchLeaveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete leave record.');
    }
  };

  const handleReviewLeave = async (id, status) => {
    const reviewNotes = window.prompt(`Comments for ${status.toLowerCase()}:`, '');
    if (reviewNotes === null) return;
    try {
      const res = await api.put(`/leaves/${id}/review`, { status, reviewNotes });
      toast.success(res.data.message);
      fetchLeaves();
      fetchLeaveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Review failed.');
    }
  };

  // Find employees currently on approved leave
  const todayStr = new Date().toISOString().split('T')[0];
  const activeLeaves = leaves.filter((l) => {
    if (l.status !== 'Approved') return false;
    const start = new Date(l.startDate).toISOString().split('T')[0];
    const end = new Date(l.endDate).toISOString().split('T')[0];
    return todayStr >= start && todayStr <= end;
  });

  return (
    <MainLayout
      title={isAdminOrManager ? 'Leave Applications & Approvals' : 'My Leave Management'}
      subtitle="View quota balances, track applications, and review requests"
    >
      {/* Leave Balances Cards */}
      {balances.length > 0 ? (
        <div className="row g-3 mb-4">
          {balances.map((b) => (
            <div key={b._id} className="col-md-3 col-6">
              <div className="p-3 bg-white rounded border shadow-sm h-100">
                <div className="text-muted small fw-medium">{b.leaveType?.name}</div>
                <div className="d-flex align-items-baseline justify-content-between mt-2">
                  <span className="fs-4 fw-bold" style={{ color: 'var(--opt-forest)' }}>
                    {Math.max(0, b.allocated - b.used)}{' '}
                    <span className="fs-6 text-muted fw-normal">rem</span>
                  </span>
                  <span className="text-secondary small">Total: {b.allocated}d</span>
                </div>
                {b.leaveType?.carryForwardDays > 0 && (
                  <div className="small text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                    Carry-forward: up to {b.leaveType.carryForwardDays} days
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="opt-card mb-4 p-3 bg-light text-center text-muted small">
          No leave quota balances have been configured for your account yet. Contact an administrator to allocate annual leave allowances.
        </div>
      )}

      {/* Employees on Leave Today Alert if any */}
      {activeLeaves.length > 0 && (
        <div className="opt-card mb-4 border-start border-4 border-info">
          <div className="p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <FiUsers className="text-info fs-5" />
              <div>
                <strong className="text-dark">Colleagues on Approved Leave Today:</strong>{' '}
                <span className="text-muted small">
                  {activeLeaves.map((al) => `${al.user?.fullName} (${al.leaveType?.name})`).join(', ')}
                </span>
              </div>
            </div>
            <span className="badge bg-info text-dark">{activeLeaves.length} on leave</span>
          </div>
        </div>
      )}

      {/* Tabs and Toolbar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 160 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="d-flex gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setAllocateForm({
                  user: employees[0]?._id || '',
                  leaveType: leaveTypes[0]?._id || '',
                  year: String(new Date().getFullYear()),
                  allocated: 12,
                });
                setShowAllocateModal(true);
              }}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            >
              <FiSettings size={14} /> Allocate Leave Quota
            </button>
          )}

          <button
            onClick={() => {
              setFormData({
                leaveType: leaveTypes[0]?._id || '',
                startDate: '',
                endDate: '',
                isHalfDay: false,
                halfDayPeriod: 'None',
                reason: '',
                attachment: '',
              });
              setShowApplyModal(true);
            }}
            className="btn-opt-primary btn-sm"
          >
            <FiPlus /> Apply for Leave
          </button>
        </div>
      </div>

      {/* Leaves Table */}
      <div className="opt-card mb-0">
        <div className="table-responsive">
          <table className="opt-table">
            <thead>
              <tr>
                {isAdminOrManager && <th>Employee</th>}
                <th>Leave Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Attachment</th>
                <th>Status</th>
                <th>Reviewer Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdminOrManager ? 9 : 8} className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                    Loading leave requests...
                  </td>
                </tr>
              ) : leaves.length > 0 ? (
                leaves.map((l) => (
                  <tr key={l._id}>
                    {isAdminOrManager && (
                      <td>
                        <div className="fw-semibold text-dark">{l.user?.fullName}</div>
                        <div className="text-muted small">
                          {l.user?.employeeId} • {l.user?.department?.name || 'General'}
                        </div>
                      </td>
                    )}
                    <td>
                      <span className="fw-semibold">{l.leaveType?.name}</span>
                      {l.isHalfDay && <span className="badge bg-light text-dark border ms-1">Half Day</span>}
                    </td>
                    <td>
                      <div className="small">
                        {new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <strong>{l.numberOfDays}</strong>
                    </td>
                    <td className="small" style={{ maxWidth: 200 }}>
                      {l.reason}
                    </td>
                    <td>
                      {l.attachment ? (
                        <a
                          href={l.attachment}
                          target="_blank"
                          rel="noreferrer"
                          className="badge bg-light text-primary border text-decoration-none d-inline-flex align-items-center gap-1"
                        >
                          <FiPaperclip size={12} /> View Doc
                        </a>
                      ) : (
                        <span className="text-muted small">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-status ${l.status.toLowerCase()}`}>{l.status}</span>
                    </td>
                    <td className="small text-muted">{l.reviewNotes || '-'}</td>
                    <td>
                      {isAdminOrManager && l.status === 'Pending' ? (
                        <div className="d-flex gap-1 align-items-center">
                          <button
                            onClick={() => handleReviewLeave(l._id, 'Approved')}
                            className="btn btn-sm btn-success py-1 px-2"
                            title="Approve"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewLeave(l._id, 'Rejected')}
                            className="btn btn-sm btn-outline-danger py-1 px-2"
                            title="Reject"
                          >
                            Reject
                          </button>
                        </div>
                      ) : l.status === 'Pending' ? (
                        <button
                          onClick={() => handleCancelLeave(l._id)}
                          className="btn btn-sm btn-outline-danger py-1 px-2"
                          title="Cancel application"
                        >
                          Cancel
                        </button>
                      ) : (
                        <div className="d-flex align-items-center gap-1">
                          <span className="text-muted small">-</span>
                          {(isAdminOrManager || l.status === 'Cancelled' || l.status === 'Rejected') && (
                            <button
                              onClick={() => handleDeleteLeave(l._id)}
                              className="btn btn-sm text-muted text-hover-danger p-1 border-0"
                              title="Delete record"
                              style={{ background: 'none' }}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdminOrManager ? 9 : 8} className="text-center py-5 text-muted">
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Apply for Leave</h5>
                <button type="button" className="btn-close" onClick={() => setShowApplyModal(false)}></button>
              </div>
              <form onSubmit={handleApplyLeave}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Leave Category *</label>
                    <select
                      className="form-select"
                      required
                      value={formData.leaveType}
                      onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {leaveTypes.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Start Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">End Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="halfDayCheck"
                      checked={formData.isHalfDay}
                      onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
                    />
                    <label className="form-check-label small" htmlFor="halfDayCheck">
                      Apply as Half-Day Leave
                    </label>
                  </div>

                  {formData.isHalfDay && (
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Half Day Period</label>
                      <select
                        className="form-select"
                        value={formData.halfDayPeriod}
                        onChange={(e) => setFormData({ ...formData, halfDayPeriod: e.target.value })}
                      >
                        <option value="First Half">First Half (Morning)</option>
                        <option value="Second Half">Second Half (Afternoon)</option>
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Reason for Absence *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      required
                      placeholder="Please provide context or coverage plan..."
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Optional Attachment (URL or Doc Link)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. https://docs.company.com/medical-certificate.pdf"
                      value={formData.attachment}
                      onChange={(e) => setFormData({ ...formData, attachment: e.target.value })}
                    />
                    <div className="form-text small" style={{ fontSize: '0.75rem' }}>
                      Attach medical certificate, travel tickets, or supporting documents.
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowApplyModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit Application
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin Allocate Leave Quota Modal */}
      {showAllocateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Allocate Annual Leave Quota</h5>
                <button type="button" className="btn-close" onClick={() => setShowAllocateModal(false)}></button>
              </div>
              <form onSubmit={handleAllocateQuota}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Employee *</label>
                    <select
                      className="form-select"
                      required
                      value={allocateForm.user}
                      onChange={(e) => setAllocateForm({ ...allocateForm, user: e.target.value })}
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.fullName} ({emp.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Leave Category *</label>
                    <select
                      className="form-select"
                      required
                      value={allocateForm.leaveType}
                      onChange={(e) => setAllocateForm({ ...allocateForm, leaveType: e.target.value })}
                    >
                      <option value="">Select Leave Category</option>
                      {leaveTypes.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Year *</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        value={allocateForm.year}
                        onChange={(e) => setAllocateForm({ ...allocateForm, year: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Allocated Days *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="form-control"
                        required
                        value={allocateForm.allocated}
                        onChange={(e) => setAllocateForm({ ...allocateForm, allocated: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAllocateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Allocation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
