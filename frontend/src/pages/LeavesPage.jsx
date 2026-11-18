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
  FiInfo,
  FiEye,
  FiSliders,
  FiAlertTriangle,
} from 'react-icons/fi';

export const LeavesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Accrual & Unified Leave Balance state
  const [accrualSummary, setAccrualSummary] = useState(null);
  const [selectedEmployeeForAccrual, setSelectedEmployeeForAccrual] = useState('');
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // Policy configuration modal (Admin)
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    monthlyAccrualRate: 1,
    annualEntitlement: 12,
    carryForwardEnabled: true,
    accrualDayOfMonth: 1,
  });

  // Filters
  const [filterStatus, setFilterStatus] = useState('');

  // Apply Leave Modal state (No leave-type dropdown)
  const [showApplyModal, setShowApplyModal] = useState(false);
  // Review Modal state (Admin / Manager)
  const [reviewModalData, setReviewModalData] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayPeriod: 'None',
    reason: '',
    attachment: '',
  });

  // Working Days & LOP Live Preview State
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState('');

  // Fetch live Working Days & LOP Breakdown whenever dates or half-day status change
  useEffect(() => {
    if (!formData.startDate || !formData.endDate) {
      setPreviewData(null);
      return;
    }
    const s = new Date(formData.startDate);
    const e = new Date(formData.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
      setPreviewData(null);
      return;
    }

    let isMounted = true;
    const fetchPreview = async () => {
      try {
        setPreviewLoading(true);
        const res = await api.get('/leaves/preview-lop', {
          params: {
            startDate: formData.startDate,
            endDate: formData.endDate,
            isHalfDay: formData.isHalfDay,
          },
        });
        if (isMounted && res.data?.success) {
          setPreviewData(res.data.breakdown);
        }
      } catch (err) {
        if (isMounted) setPreviewData(null);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [formData.startDate, formData.endDate, formData.isHalfDay]);

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
      const balRes = await api.get('/leaves/balances/my');
      if (balRes.data?.success && balRes.data.accrualSummary && !selectedEmployeeForAccrual) {
        setAccrualSummary(balRes.data.accrualSummary);
      }
    } catch (err) {
      console.error('Failed to load leave balance', err);
    }
  };

  const fetchAccrualForUser = async (targetUserId) => {
    try {
      const url = targetUserId ? `/leaves/accrual-summary?user=${targetUserId}` : '/leaves/accrual-summary';
      const res = await api.get(url);
      if (res.data?.success) {
        setAccrualSummary(res.data.summary);
      }
    } catch (err) {
      toast.error('Failed to load leave balance for selected employee.');
    }
  };

  const fetchPolicy = async () => {
    try {
      const res = await api.get('/leaves/policy');
      if (res.data?.success && res.data.policy) {
        setPolicyForm(res.data.policy);
      }
    } catch (err) {
      console.error('Failed to load leave policy', err);
    }
  };

  const fetchEmployees = async () => {
    if (!isAdminOrManager) return;
    try {
      const res = await api.get('/users');
      if (res.data?.success) setEmployees(res.data.users || []);
    } catch (err) {
      console.error('Failed to load employee directory', err);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus]);

  useEffect(() => {
    fetchLeaveData();
    fetchEmployees();
    fetchPolicy();
  }, []);

  const handleEmployeeAccrualChange = (e) => {
    const empId = e.target.value;
    setSelectedEmployeeForAccrual(empId);
    fetchAccrualForUser(empId);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setApplyError('');

    if (!formData.startDate || !formData.endDate) {
      const msg = 'Please specify both start date and end date.';
      setApplyError(msg);
      toast.error(msg);
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      const msg = 'Start date cannot be after end date.';
      setApplyError(msg);
      toast.error(msg);
      return;
    }

    if (!formData.reason || !formData.reason.trim()) {
      const msg = 'Please provide a reason for your absence.';
      setApplyError(msg);
      toast.error(msg);
      return;
    }

    if (previewData && previewData.workingDays <= 0) {
      const msg = 'The selected date range contains no working days (only weekends or company holidays).';
      setApplyError(msg);
      toast.error(msg);
      return;
    }

    try {
      setApplySubmitting(true);
      const res = await api.post('/leaves', formData);
      toast.success(res.data.message || 'Leave applied successfully.');
      setShowApplyModal(false);
      setPreviewData(null);
      setApplyError('');
      fetchLeaves();
      fetchLeaveData();
      if (selectedEmployeeForAccrual) {
        fetchAccrualForUser(selectedEmployeeForAccrual);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to submit leave application.';
      setApplyError(errMsg);
      toast.error(errMsg);
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/leaves/policy', policyForm);
      toast.success(res.data.message || 'Leave policy updated successfully.');
      setShowPolicyModal(false);
      fetchLeaveData();
      if (selectedEmployeeForAccrual) {
        fetchAccrualForUser(selectedEmployeeForAccrual);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update leave policy.');
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave?')) return;
    try {
      const res = await api.put(`/leaves/${id}/cancel`);
      toast.success(res.data.message || 'Leave request cancelled.');
      fetchLeaves();
      fetchLeaveData();
      if (selectedEmployeeForAccrual) {
        fetchAccrualForUser(selectedEmployeeForAccrual);
      }
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
      if (selectedEmployeeForAccrual) {
        fetchAccrualForUser(selectedEmployeeForAccrual);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete leave record.');
    }
  };

  const handleOpenReviewModal = (leaveItem, action) => {
    setReviewModalData({
      leave: leaveItem,
      action,
      notes: '',
    });
  };

  const handleReviewSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!reviewModalData) return;
    const { leave, action, notes } = reviewModalData;

    try {
      setReviewSubmitting(true);
      const res = await api.put(`/leaves/${leave._id}/review`, { status: action, reviewNotes: notes });
      toast.success(res.data.message || `Leave ${action.toLowerCase()} successfully.`);
      setReviewModalData(null);
      fetchLeaves();
      fetchLeaveData();
      if (selectedEmployeeForAccrual) {
        fetchAccrualForUser(selectedEmployeeForAccrual);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Review failed.');
    } finally {
      setReviewSubmitting(false);
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

  const selectedEmployeeObj = employees.find((e) => e._id === selectedEmployeeForAccrual);

  return (
    <MainLayout
      title={isAdminOrManager ? 'Leave Applications & Approvals' : 'My Leave Management'}
      subtitle="Single 12-day annual policy • Available leave balance"
    >
      {/* Annual Leave Summary - Single Card: Available Leave */}
      <div className="row g-4 mb-4 align-items-center justify-content-between">
        <div className="col-xl-4 col-lg-5 col-md-6 col-12">
          <div
            className="p-4 rounded-3 border shadow-sm"
            style={{
              backgroundColor: '#F0FDF4',
              borderColor: '#BBF7D0',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span
                className="fw-bold small text-uppercase"
                style={{ color: '#166534', fontSize: '0.82rem', letterSpacing: '0.5px' }}
              >
                Available Leave
              </span>
              <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: 28, height: 28, backgroundColor: '#DCFCE7', color: '#15803D' }}
              >
                <FiCalendar size={15} />
              </div>
            </div>
            <div className="d-flex align-items-baseline gap-2 mt-1">
              <span
                className="fw-bold"
                style={{ fontSize: '3rem', color: '#14532D', lineHeight: 1 }}
              >
                {accrualSummary?.availableBalance ?? 0}
              </span>
              <span
                className="fw-medium small"
                style={{ color: '#166534', fontSize: '0.9rem' }}
              >
                Days available to use
              </span>
            </div>
          </div>
        </div>

        {/* Admin/Manager Employee Selector & Policy Controls if applicable */}
        {isAdminOrManager && employees.length > 0 && (
          <div className="col-xl-8 col-lg-7 col-md-6 col-12 d-flex justify-content-md-end align-items-center gap-2">
            <span className="text-muted small fw-semibold">Employee:</span>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 220, fontSize: '0.8rem' }}
              value={selectedEmployeeForAccrual}
              onChange={handleEmployeeAccrualChange}
            >
              <option value="">My Leave Balance</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullName} ({emp.employeeId})
                </option>
              ))}
            </select>
            {isAdmin && (
              <button
                onClick={() => setShowPolicyModal(true)}
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                style={{ fontSize: '0.8rem' }}
                title="Configure Policy"
              >
                <FiSliders size={13} />
                <span className="d-none d-sm-inline">Policy</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Employees on Leave Today Alert if any */}
      {activeLeaves.length > 0 && (
        <div className="opt-card mb-4 border-start border-4 border-info">
          <div className="p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <FiUsers className="text-info fs-5" />
              <div>
                <strong className="text-dark">Colleagues on Approved Leave Today:</strong>{' '}
                <span className="text-muted small">
                  {activeLeaves.map((al) => al.user?.fullName).join(', ')}
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
          <button
            onClick={() => {
              setFormData({
                startDate: '',
                endDate: '',
                isHalfDay: false,
                halfDayPeriod: 'None',
                reason: '',
                attachment: '',
              });
              setApplyError('');
              setPreviewData(null);
              setShowApplyModal(true);
            }}
            className="btn-opt-primary btn-sm"
          >
            <FiPlus /> Apply for Leave
          </button>
        </div>
      </div>

      {/* Leaves Applications Table */}
      <div className="opt-card mb-0">
        <div className="table-responsive">
          <table className="opt-table">
            <thead>
              <tr>
                {isAdminOrManager && <th>Employee</th>}
                <th>Application Dates</th>
                <th>Working Days</th>
                <th>Paid Leave</th>
                <th>Loss of Pay (LOP)</th>
                <th>Reason</th>
                <th>Attachment</th>
                <th>Approval Status</th>
                <th>Reviewer Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdminOrManager ? 10 : 9} className="text-center py-5">
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

                    {/* Application Dates */}
                    <td>
                      <div className="small fw-semibold text-dark">
                        {new Date(l.startDate).toLocaleDateString()} - {new Date(l.endDate).toLocaleDateString()}
                      </div>
                      {l.isHalfDay && (
                        <span className="badge bg-light text-secondary border mt-1" style={{ fontSize: '0.68rem' }}>
                          Half Day ({l.halfDayPeriod})
                        </span>
                      )}
                    </td>

                    {/* Working Days */}
                    <td>
                      <strong className="text-dark">{l.numberOfDays}</strong>
                      <span className="text-muted small"> {l.numberOfDays === 1 ? 'working day' : 'working days'}</span>
                    </td>

                    {/* Paid Leave Days */}
                    <td>
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 fw-semibold px-2 py-1">
                        {l.paidLeaveDays !== undefined && l.paidLeaveDays !== null
                          ? l.paidLeaveDays
                          : (l.status === 'Approved' ? l.numberOfDays : '-')} {l.paidLeaveDays === 1 ? 'day' : 'days'}
                      </span>
                    </td>

                    {/* LOP Days */}
                    <td>
                      {(l.lopDays || 0) > 0 ? (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 fw-semibold px-2 py-1">
                          {l.lopDays} {l.lopDays === 1 ? 'day' : 'days'} LOP
                        </span>
                      ) : (
                        <span className="text-muted small">0 days</span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="small" style={{ maxWidth: 200 }}>
                      {l.reason}
                    </td>

                    {/* Attachment */}
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

                    {/* Approval Status */}
                    <td>
                      <span className={`badge-status ${l.status.toLowerCase()}`}>{l.status}</span>
                    </td>

                    {/* Reviewer Notes */}
                    <td className="small text-muted">{l.reviewNotes || '-'}</td>

                    {/* Actions */}
                    <td>
                      {isAdminOrManager && l.status === 'Pending' ? (
                        <div className="d-flex gap-1 align-items-center">
                          <button
                            onClick={() => handleOpenReviewModal(l, 'Approved')}
                            className="btn btn-sm btn-success py-1 px-2"
                            title="Review and approve application"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenReviewModal(l, 'Rejected')}
                            className="btn btn-sm btn-outline-danger py-1 px-2"
                            title="Review and reject application"
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
                  <td colSpan={isAdminOrManager ? 10 : 9} className="text-center py-5 text-muted">
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Month-by-Month Accrual Breakdown Modal */}
      {showBreakdownModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-light">
                <div>
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <FiCalendar className="text-primary" />
                    Month-by-Month Accrual & Carry-Forward Breakdown
                  </h5>
                  <div className="text-muted small">
                    Year: {accrualSummary?.year || new Date().getFullYear()} •
                    {selectedEmployeeObj ? ` Employee: ${selectedEmployeeObj.fullName}` : ` Employee: ${user?.fullName}`}
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowBreakdownModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle text-center mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Month</th>
                        <th>Carried In</th>
                        <th>Earned</th>
                        <th>Available Before Usage</th>
                        <th>Approved Taken</th>
                        <th>Closing / Carried Fwd</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accrualSummary?.months?.map((m) => (
                        <tr
                          key={m.month}
                          style={{
                            backgroundColor: m.isCurrent ? '#F0FDF4' : m.isPast ? '#FFFFFF' : '#FAFAFA',
                            fontWeight: m.isCurrent ? 600 : 'normal',
                          }}
                        >
                          <td className="text-start fw-bold">
                            {m.monthName}
                            {m.isCurrent && <span className="badge bg-success ms-2">Current</span>}
                          </td>
                          <td>+{m.carriedIn}</td>
                          <td className="text-primary">+{m.earned}</td>
                          <td className="fw-semibold">{m.availableBeforeUsage}</td>
                          <td className={m.taken > 0 ? 'text-danger fw-bold' : 'text-muted'}>
                            {m.taken > 0 ? `-${m.taken}` : '0'}
                          </td>
                          <td className="fw-bold" style={{ color: 'var(--opt-forest)' }}>
                            {m.closingBalance}
                          </td>
                          <td className="small text-muted">
                            {m.isCurrent ? (
                              <span className="badge-status active">Active Month</span>
                            ) : m.isPast ? (
                              'Completed'
                            ) : (
                              'Upcoming'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-light rounded border mt-3 small">
                  <div className="d-flex align-items-center gap-2 fw-semibold text-dark mb-1">
                    <FiInfo className="text-primary" /> Single Leave Policy Rules:
                  </div>
                  <ul className="mb-0 text-muted ps-3" style={{ fontSize: '0.78rem' }}>
                    <li>
                      <strong>Allowance:</strong> 12 days total annual allowance, earned at 1 leave day per month.
                    </li>
                    <li>
                      <strong>Carry-Forward:</strong> Unused leave days automatically carry forward to the next month.
                    </li>
                    <li>
                      <strong>Available Leave:</strong> Previous Unused Balance + Current Month's Earned Leave - Approved Leaves Taken.
                    </li>
                    <li>
                      <strong>Pending Requests:</strong> Strictly do <em>not</em> deduct from available balance until approved.
                    </li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBreakdownModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configure Leave Policy Modal (Admin only) */}
      {showPolicyModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <FiSliders className="text-primary" /> Configure Leave Policy
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowPolicyModal(false)}></button>
              </div>
              <form onSubmit={handleUpdatePolicy}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Monthly Accrual Rate (Days/Month) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      className="form-control"
                      required
                      value={policyForm.monthlyAccrualRate}
                      onChange={(e) => setPolicyForm({ ...policyForm, monthlyAccrualRate: Number(e.target.value) })}
                    />
                    <div className="form-text small" style={{ fontSize: '0.72rem' }}>
                      Standard: 1 day per month earned by each active employee.
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Annual Entitlement Cap (Days/Year) *</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="60"
                      className="form-control"
                      required
                      value={policyForm.annualEntitlement}
                      onChange={(e) => setPolicyForm({ ...policyForm, annualEntitlement: Number(e.target.value) })}
                    />
                    <div className="form-text small" style={{ fontSize: '0.72rem' }}>
                      Standard: 12 days per employee per year.
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Accrual Credit Day of Month</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      className="form-control"
                      required
                      value={policyForm.accrualDayOfMonth || 1}
                      onChange={(e) => setPolicyForm({ ...policyForm, accrualDayOfMonth: Number(e.target.value) })}
                    />
                    <div className="form-text small" style={{ fontSize: '0.72rem' }}>
                      Day on which monthly leave is credited (1st).
                    </div>
                  </div>

                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="policyCarryForwardCheck"
                      checked={policyForm.carryForwardEnabled}
                      onChange={(e) => setPolicyForm({ ...policyForm, carryForwardEnabled: e.target.checked })}
                    />
                    <label className="form-check-label fw-semibold small" htmlFor="policyCarryForwardCheck">
                      Automatic Monthly Carry-Forward
                    </label>
                    <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                      Unused leaves automatically carry forward into the following month.
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPolicyModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save Policy Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Apply Leave Modal (No leave-type dropdown) */}
      {showApplyModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <div>
                  <h5 className="modal-title fw-bold">Apply for Leave</h5>
                  <div className="text-muted small" style={{ fontSize: '0.78rem' }}>
                    Available Leave Balance:{' '}
                    <strong style={{ color: 'var(--opt-forest)' }}>
                      {accrualSummary?.availableBalance ?? 0} days
                    </strong>{' '}
                    (Deducted only after approval)
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowApplyModal(false)}></button>
              </div>
              <form onSubmit={handleApplyLeave}>
                <div className="modal-body p-4">
                  {applyError && (
                    <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.78rem' }}>
                      <FiAlertTriangle className="flex-shrink-0 text-danger" size={16} />
                      <div>{applyError}</div>
                    </div>
                  )}
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
                      Apply as Half-Day Leave (0.5 day)
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

                  {/* Live Working Days Calculation & LOP Preview */}
                  {previewLoading && (
                    <div className="p-3 mb-3 rounded-3 border bg-light text-center small text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      Calculating working days and leave eligibility...
                    </div>
                  )}

                  {!previewLoading && previewData && (
                    <div className="p-3 mb-3 rounded-3 border bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-1 pb-2 border-bottom flex-wrap gap-1">
                        <div>
                          <span className="small text-muted fw-semibold">Requested Working Days:</span>
                          {((previewData.weekendDays || 0) > 0 || (previewData.holidayDays || 0) > 0) && (
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              (Excludes {(previewData.weekendDays || 0) > 0 ? `${previewData.weekendDays} weekend day(s)` : ''}
                              {(previewData.weekendDays || 0) > 0 && (previewData.holidayDays || 0) > 0 ? ', ' : ''}
                              {(previewData.holidayDays || 0) > 0 ? `${previewData.holidayDays} holiday(s)` : ''})
                            </div>
                          )}
                        </div>
                        <span className="fw-bold text-dark fs-6">
                          {previewData.workingDays || 0} {previewData.workingDays === 1 ? 'working day' : 'working days'}
                        </span>
                      </div>

                      {previewData.workingDays === 0 ? (
                        <div className="alert alert-danger py-2 px-3 small mb-0 mt-2" style={{ fontSize: '0.78rem' }}>
                          <FiAlertTriangle className="me-1" /> Selected dates contain only weekends or company holidays. No working days requested.
                        </div>
                      ) : (
                        <>
                          <div className="row g-2 text-center mt-1">
                            <div className="col-6">
                              <div className="p-2 rounded bg-white border">
                                <div className="text-muted small" style={{ fontSize: '0.72rem' }}>Paid Leave</div>
                                <div className="fw-bold text-success fs-5">{previewData.paidLeaveDays ?? 0} d</div>
                              </div>
                            </div>
                            <div className="col-6">
                              <div
                                className="p-2 rounded border"
                                style={{
                                  backgroundColor: (previewData.lopDays || 0) > 0 ? '#FEF2F2' : '#FFFFFF',
                                  borderColor: (previewData.lopDays || 0) > 0 ? '#FECACA' : '#E2E8F0',
                                }}
                              >
                                <div className="small" style={{ fontSize: '0.72rem', color: (previewData.lopDays || 0) > 0 ? '#DC2626' : '#64748B' }}>
                                  Loss of Pay (LOP)
                                </div>
                                <div className={`fw-bold fs-5 ${(previewData.lopDays || 0) > 0 ? 'text-danger' : 'text-muted'}`}>
                                  {previewData.lopDays ?? 0} d
                                </div>
                              </div>
                            </div>
                          </div>

                          {(previewData.lopDays || 0) > 0 && (
                            <div className="alert alert-warning py-2 px-3 mt-2 mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.78rem' }}>
                              <FiAlertTriangle className="flex-shrink-0 text-warning" size={16} />
                              <div>
                                <strong>Loss of Pay Notice:</strong> Your request exceeds your projected available leave balance ({previewData.availableBalance ?? 0} days).{' '}
                                <strong>{previewData.lopDays} day(s)</strong> will be recorded as Loss of Pay (LOP) upon approval.
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Reason for Absence *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      required
                      placeholder="Please provide the reason for your leave request..."
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Optional Attachment (URL or Doc Link)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. https://docs.company.com/supporting-document.pdf"
                      value={formData.attachment}
                      onChange={(e) => setFormData({ ...formData, attachment: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowApplyModal(false);
                      setApplyError('');
                    }}
                    disabled={applySubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={applySubmitting || (previewData && previewData.workingDays === 0)}
                  >
                    {applySubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin / Manager Review Modal (with Paid vs LOP details) */}
      {reviewModalData && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark">
                  {reviewModalData.action === 'Approved' ? 'Approve Leave Application' : 'Reject Leave Application'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setReviewModalData(null)}
                ></button>
              </div>
              <form onSubmit={handleReviewSubmit}>
                <div className="modal-body p-4">
                  {/* Applicant Details */}
                  <div className="d-flex align-items-center gap-2 pb-3 mb-3 border-bottom">
                    <div
                      className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center"
                      style={{ width: 40, height: 40, backgroundColor: 'var(--opt-forest)', fontSize: '0.9rem' }}
                    >
                      {reviewModalData.leave.user?.fullName?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <div className="fw-bold text-dark">{reviewModalData.leave.user?.fullName}</div>
                      <div className="text-muted small">
                        {reviewModalData.leave.user?.employeeId} • {reviewModalData.leave.user?.department?.name || 'General Core'}
                      </div>
                    </div>
                  </div>

                  {/* Dates & Reason */}
                  <div className="mb-3 small">
                    <div className="d-flex justify-content-between py-1">
                      <span className="text-muted">Dates Requested:</span>
                      <span className="fw-semibold text-dark">
                        {new Date(reviewModalData.leave.startDate).toLocaleDateString()} -{' '}
                        {new Date(reviewModalData.leave.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between py-1">
                      <span className="text-muted">Reason:</span>
                      <span className="text-dark">{reviewModalData.leave.reason}</span>
                    </div>
                  </div>

                  {/* Leave Breakdown Card */}
                  <div className="p-3 mb-3 rounded-3 border bg-light">
                    <div className="row g-2 text-center">
                      <div className="col-4">
                        <div className="p-2 rounded bg-white border">
                          <div className="text-muted small" style={{ fontSize: '0.72rem' }}>Working Days</div>
                          <div className="fw-bold text-dark fs-5">{reviewModalData.leave.numberOfDays} d</div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-2 rounded bg-white border">
                          <div className="text-muted small" style={{ fontSize: '0.72rem' }}>Paid Leave</div>
                          <div className="fw-bold text-success fs-5">
                            {reviewModalData.leave.paidLeaveDays !== undefined
                              ? reviewModalData.leave.paidLeaveDays
                              : reviewModalData.leave.numberOfDays} d
                          </div>
                        </div>
                      </div>
                      <div className="col-4">
                        <div
                          className="p-2 rounded border"
                          style={{
                            backgroundColor: (reviewModalData.leave.lopDays || 0) > 0 ? '#FEF2F2' : '#FFFFFF',
                            borderColor: (reviewModalData.leave.lopDays || 0) > 0 ? '#FECACA' : '#E2E8F0',
                          }}
                        >
                          <div className="small" style={{ fontSize: '0.72rem', color: (reviewModalData.leave.lopDays || 0) > 0 ? '#DC2626' : '#64748B' }}>
                            Loss of Pay
                          </div>
                          <div className={`fw-bold fs-5 ${(reviewModalData.leave.lopDays || 0) > 0 ? 'text-danger' : 'text-muted'}`}>
                            {reviewModalData.leave.lopDays || 0} d
                          </div>
                        </div>
                      </div>
                    </div>

                    {(reviewModalData.leave.lopDays || 0) > 0 && reviewModalData.action === 'Approved' && (
                      <div className="alert alert-warning py-2 px-3 mt-2 mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.78rem' }}>
                        <FiAlertTriangle className="flex-shrink-0 text-warning" size={16} />
                        <div>
                          <strong>Loss of Pay Notice:</strong> This approval will deduct{' '}
                          <strong>{reviewModalData.leave.paidLeaveDays || 0} paid day(s)</strong> and record{' '}
                          <strong>{reviewModalData.leave.lopDays} day(s) as Loss of Pay (LOP)</strong>.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Review Notes Input */}
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Reviewer Notes (Optional)</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder={reviewModalData.action === 'Approved' ? 'Add approval remarks...' : 'State reason for rejection...'}
                      value={reviewModalData.notes}
                      onChange={(e) => setReviewModalData({ ...reviewModalData, notes: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setReviewModalData(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className={`btn btn-sm ${reviewModalData.action === 'Approved' ? 'btn-success' : 'btn-danger'}`}
                  >
                    {reviewSubmitting
                      ? 'Processing...'
                      : reviewModalData.action === 'Approved'
                      ? 'Confirm Approval'
                      : 'Confirm Rejection'}
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
