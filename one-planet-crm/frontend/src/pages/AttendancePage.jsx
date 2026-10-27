import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiClock,
  FiCalendar,
  FiCheckCircle,
  FiPlus,
  FiAlertCircle,
  FiLogIn,
  FiLogOut,
  FiSearch,
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiUser,
  FiEdit3,
} from 'react-icons/fi';

export const AttendancePage = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
  const isAdmin = user?.role === 'Admin';

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'corrections'

  // Data states
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalDays: 0,
    totalRecords: 0,
    totalPresent: 0,
    totalLate: 0,
    totalHalfDay: 0,
    totalHours: 0,
    avgHours: 0,
  });
  const [todayRecord, setTodayRecord] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter states
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    requestedCheckIn: '',
    requestedCheckOut: '',
    reason: '',
  });

  const [showAdminMarkModal, setShowAdminMarkModal] = useState(false);
  const [adminMarkForm, setAdminMarkForm] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    checkIn: '',
    checkOut: '',
    status: 'Present',
    notes: '',
  });

  // Fetch today's attendance for check-in / check-out widget
  const fetchTodayAttendance = async () => {
    try {
      const res = await api.get('/attendance/today');
      if (res.data?.success) {
        setTodayRecord(res.data.attendance || null);
      }
    } catch (err) {
      console.error('Error fetching today attendance:', err);
    }
  };

  // Fetch attendance records based on current role & filters
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const url = isAdminOrManager ? '/attendance/all' : '/attendance/my-history';
      const params = {};

      if (filterDate) {
        params.date = filterDate;
      } else {
        if (filterMonth) params.month = filterMonth;
        if (filterYear) params.year = filterYear;
      }

      if (filterStatus) params.status = filterStatus;
      if (isAdminOrManager) {
        if (filterDept) params.department = filterDept;
        if (filterUser) params.user = filterUser;
        if (searchQuery) params.search = searchQuery;
      }

      const res = await api.get(url, { params });
      if (res.data?.success) {
        setRecords(res.data.records || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      toast.error('Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch correction requests
  const fetchCorrections = async () => {
    try {
      const res = await api.get('/attendance/corrections');
      if (res.data?.success) {
        setCorrections(res.data.corrections || []);
      }
    } catch (err) {
      console.error('Error fetching corrections:', err);
    }
  };

  // Fetch departments & employees for Admin dropdown filters
  const fetchAuxiliaryData = async () => {
    if (!isAdminOrManager) return;
    try {
      const [deptRes, empRes] = await Promise.all([
        api.get('/departments'),
        api.get('/users'),
      ]);
      if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
      if (empRes.data?.success) setEmployeesList(empRes.data.users || []);
    } catch (err) {
      console.error('Error fetching auxiliary data:', err);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [filterDate, filterMonth, filterYear, filterStatus, filterDept, filterUser, searchQuery]);

  useEffect(() => {
    fetchCorrections();
  }, [activeTab]);

  // Handle Check-In
  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-in');
      toast.success(res.data.message || 'Checked in successfully!');
      await Promise.all([fetchTodayAttendance(), fetchAttendance()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-out');
      toast.success(res.data.message || 'Checked out successfully!');
      await Promise.all([fetchTodayAttendance(), fetchAttendance()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Submit Correction
  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/attendance/corrections', correctionForm);
      toast.success(res.data.message || 'Correction submitted for review.');
      setShowCorrectionModal(false);
      setCorrectionForm({
        date: new Date().toISOString().split('T')[0],
        requestedCheckIn: '',
        requestedCheckOut: '',
        reason: '',
      });
      fetchCorrections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit correction.');
    }
  };

  // Handle Review Correction
  const handleReviewCorrection = async (id, status) => {
    const reviewNotes = window.prompt(`Enter review notes for ${status.toLowerCase()}:`, '');
    if (reviewNotes === null) return;

    try {
      const res = await api.put(`/attendance/corrections/${id}`, { status, reviewNotes });
      toast.success(res.data.message);
      fetchCorrections();
      fetchAttendance();
    } catch (err) {
      toast.error('Failed to update correction status.');
    }
  };

  // Handle Admin Manual Mark Attendance
  const handleAdminMarkSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/attendance/admin-mark', adminMarkForm);
      toast.success(res.data.message || 'Attendance recorded successfully.');
      setShowAdminMarkModal(false);
      setAdminMarkForm({
        userId: '',
        date: new Date().toISOString().split('T')[0],
        checkIn: '',
        checkOut: '',
        status: 'Present',
        notes: '',
      });
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance record.');
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilterDate('');
    setFilterMonth(String(new Date().getMonth() + 1));
    setFilterYear(String(new Date().getFullYear()));
    setFilterStatus('');
    setFilterDept('');
    setFilterUser('');
    setSearchQuery('');
  };

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      toast.info('No attendance records to export.');
      return;
    }

    const headers = ['Employee Name', 'Employee ID', 'Department', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Status', 'Notes'];
    const rows = records.map((r) => [
      `"${r.user?.fullName || user?.fullName || 'N/A'}"`,
      `"${r.user?.employeeId || user?.employeeId || 'N/A'}"`,
      `"${r.user?.department?.name || 'N/A'}"`,
      `"${r.date}"`,
      `"${r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}"`,
      `"${r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}"`,
      `"${r.workingHours || 0} hrs"`,
      `"${r.status}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `one_planet_attendance_${filterYear}_${filterMonth || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendance records exported successfully.');
  };

  const isCheckedIn = !!todayRecord?.checkIn;
  const isCheckedOut = !!todayRecord?.checkOut;

  return (
    <MainLayout
      title={isAdminOrManager ? 'Company Attendance Management' : 'My Attendance Portal'}
      subtitle="Track daily punch timestamps, calculate verified working hours, and manage audit corrections"
    >
      {/* 1. Interactive Check-In & Check-Out Session Card */}
      <div className="opt-card mb-4">
        <div className="opt-card-body p-4">
          <div className="row align-items-center g-3">
            <div className="col-lg-5 col-md-6">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 52,
                    height: 52,
                    background: 'var(--opt-mint)',
                    color: 'var(--opt-forest)',
                    border: '1px solid #C4E9BF',
                  }}
                >
                  <FiClock size={26} />
                </div>
                <div>
                  <div className="small fw-bold text-uppercase" style={{ color: 'var(--opt-text-secondary)', letterSpacing: '0.5px' }}>
                    Today's Session • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <h4 className="fw-bold mb-0 mt-1" style={{ color: 'var(--opt-forest)' }}>
                    {isCheckedOut
                      ? 'Completed for Today'
                      : isCheckedIn
                      ? 'Active Punch-In Session'
                      : 'Not Checked In Yet'}
                  </h4>
                </div>
              </div>
            </div>

            {/* Timestamps & Hours Display */}
            <div className="col-lg-4 col-md-6">
              <div className="d-flex align-items-center justify-content-between p-2 px-3 rounded-3" style={{ background: 'var(--opt-bg)', border: '1px solid var(--opt-border)' }}>
                <div className="text-center flex-fill border-end pe-2">
                  <span className="small text-muted d-block" style={{ fontSize: '0.72rem' }}>PUNCH IN</span>
                  <strong className="fs-6 text-dark">
                    {todayRecord?.checkIn
                      ? new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </strong>
                </div>
                <div className="text-center flex-fill border-end px-2">
                  <span className="small text-muted d-block" style={{ fontSize: '0.72rem' }}>PUNCH OUT</span>
                  <strong className="fs-6 text-dark">
                    {todayRecord?.checkOut
                      ? new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </strong>
                </div>
                <div className="text-center flex-fill ps-2">
                  <span className="small text-muted d-block" style={{ fontSize: '0.72rem' }}>HOURS</span>
                  <strong className="fs-6" style={{ color: 'var(--opt-forest)' }}>
                    {todayRecord?.workingHours ? `${todayRecord.workingHours} hrs` : isCheckedIn ? 'In Progress' : '0 hrs'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Buttons */}
            <div className="col-lg-3 col-12 d-flex gap-2 justify-content-lg-end">
              <button
                onClick={handleCheckIn}
                disabled={isCheckedIn || actionLoading}
                className="btn btn-primary flex-fill d-inline-flex align-items-center justify-content-center gap-2 py-2"
                style={{ minWidth: 120 }}
                title={isCheckedIn ? 'You have already checked in for today' : 'Click to record check-in'}
              >
                {actionLoading && !isCheckedIn ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <>
                    <FiLogIn size={17} />
                    <span>Check In</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!isCheckedIn || isCheckedOut || actionLoading}
                className="btn btn-danger flex-fill d-inline-flex align-items-center justify-content-center gap-2 py-2"
                style={{ minWidth: 120 }}
                title={
                  !isCheckedIn
                    ? 'Check in first to enable checkout'
                    : isCheckedOut
                    ? 'Session already checked out'
                    : 'Click to record check-out'
                }
              >
                {actionLoading && isCheckedIn && !isCheckedOut ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <>
                    <FiLogOut size={17} />
                    <span>Check Out</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {todayRecord?.isLate && (
            <div className="alert alert-warning py-2 px-3 small mt-3 mb-0 d-flex align-items-center gap-2">
              <FiAlertCircle className="flex-shrink-0 text-warning" size={16} />
              <span>Late arrival recorded for today (+{todayRecord.lateMinutes} minutes beyond grace period).</span>
            </div>
          )}
          {todayRecord?.isEarlyDeparture && (
            <div className="alert alert-info py-2 px-3 small mt-2 mb-0 d-flex align-items-center gap-2">
              <FiAlertCircle className="flex-shrink-0 text-info" size={16} />
              <span>Early departure recorded for today (-{todayRecord.earlyDepartureMinutes} minutes before shift end).</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-xl-3 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Total Logs Recorded</div>
              <div className="stat-val">{summary.totalRecords || summary.totalDays || records.length}</div>
              <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                Filtered range
              </div>
            </div>
            <div
              className="stat-icon"
              style={{ background: 'var(--opt-mint)', color: 'var(--opt-forest)' }}
            >
              <FiCalendar />
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Days Present</div>
              <div className="stat-val" style={{ color: 'var(--opt-success)' }}>
                {summary.totalPresent ?? 0}
              </div>
              <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                On-time & verified presence
              </div>
            </div>
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <FiCheckCircle />
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Late Arrivals</div>
              <div className="stat-val" style={{ color: 'var(--opt-warning)' }}>
                {summary.totalLate ?? 0}
              </div>
              <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                Past company grace period
              </div>
            </div>
            <div className="stat-icon bg-warning bg-opacity-10 text-warning">
              <FiClock />
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="stat-card">
            <div>
              <div className="stat-label">Total Working Hours</div>
              <div className="stat-val" style={{ color: 'var(--opt-forest)' }}>
                {summary.totalHours ?? 0} <span className="fs-6 fw-normal text-muted">hrs</span>
              </div>
              <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                Avg: {summary.avgHours ?? 0} hrs / logged day
              </div>
            </div>
            <div
              className="stat-icon"
              style={{ background: 'rgba(22, 107, 80, 0.1)', color: 'var(--opt-green-secondary)' }}
            >
              <FiClock />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs and Top Actions */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div className="btn-group">
          <button
            className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('logs')}
          >
            Attendance Logs ({records.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'corrections' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('corrections')}
          >
            Correction Requests ({corrections.length})
          </button>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {activeTab === 'logs' && (
            <button
              onClick={handleExportCSV}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              title="Export filtered records to CSV"
            >
              <FiDownload size={14} /> Export CSV
            </button>
          )}

          {isAdmin && activeTab === 'logs' && (
            <button
              onClick={() => setShowAdminMarkModal(true)}
              className="btn btn-sm btn-primary d-flex align-items-center gap-1"
            >
              <FiEdit3 size={14} /> Record Manual Attendance
            </button>
          )}

          {!isAdminOrManager && (
            <button
              onClick={() => setShowCorrectionModal(true)}
              className="btn btn-sm btn-primary d-flex align-items-center gap-1"
            >
              <FiPlus size={14} /> Request Correction
            </button>
          )}
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      {activeTab === 'logs' && (
        <div className="opt-card mb-4">
          <div className="p-3">
            <div className="row g-2 align-items-center">
              {isAdminOrManager && (
                <div className="col-lg-3 col-md-6">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text border-end-0">
                      <FiSearch />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Search employee name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {isAdminOrManager && (
                <div className="col-lg-2 col-md-6">
                  <select
                    className="form-select form-select-sm"
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-lg-2 col-md-4 col-6">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  title="Specific Date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>

              <div className="col-lg-2 col-md-4 col-6">
                <select
                  className="form-select form-select-sm"
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterDate('');
                    setFilterMonth(e.target.value);
                  }}
                  disabled={!!filterDate}
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              <div className="col-lg-1 col-md-4 col-6">
                <select
                  className="form-select form-select-sm"
                  value={filterYear}
                  onChange={(e) => {
                    setFilterDate('');
                    setFilterYear(e.target.value);
                  }}
                  disabled={!!filterDate}
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>

              <div className="col-lg-2 col-md-6 col-6">
                <select
                  className="form-select form-select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Early Departure">Early Departure</option>
                  <option value="Missed Check-out">Missed Check-out</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="col-auto ms-auto">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                  title="Reset all filters"
                >
                  <FiRefreshCw size={13} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Logs Table Tab Content */}
      {activeTab === 'logs' ? (
        <div className="opt-card mb-0">
          <div className="table-responsive">
            <table className="opt-table">
              <thead>
                <tr>
                  {isAdminOrManager && <th>Employee Details</th>}
                  <th>Date & Day</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Calculated Working Hours</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdminOrManager ? 7 : 6} className="text-center py-5">
                      <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                      Loading attendance records...
                    </td>
                  </tr>
                ) : records.length > 0 ? (
                  records.map((r) => {
                    const rowDate = new Date(r.date);
                    const dayName = isNaN(rowDate)
                      ? ''
                      : rowDate.toLocaleDateString('en-US', { weekday: 'short' });

                    return (
                      <tr key={r._id}>
                        {isAdminOrManager && (
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                                style={{
                                  width: 32,
                                  height: 32,
                                  background: 'var(--opt-mint)',
                                  color: 'var(--opt-forest)',
                                  fontSize: '0.85rem',
                                }}
                              >
                                {r.user?.fullName ? r.user.fullName.charAt(0) : 'U'}
                              </div>
                              <div>
                                <div className="fw-semibold text-dark">{r.user?.fullName || 'Colleague'}</div>
                                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                  {r.user?.employeeId} • {r.user?.department?.name || 'General'}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        <td>
                          <span className="fw-semibold text-dark">{r.date}</span>
                          {dayName && <span className="text-muted small ms-2">({dayName})</span>}
                        </td>
                        <td>
                          {r.checkIn ? (
                            <span className="fw-medium text-dark">
                              {new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-muted">--:--</span>
                          )}
                        </td>
                        <td>
                          {r.checkOut ? (
                            <span className="fw-medium text-dark">
                              {new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-muted">--:--</span>
                          )}
                        </td>
                        <td>
                          {r.workingHours ? (
                            <strong style={{ color: 'var(--opt-forest)' }}>
                              {r.workingHours} hrs
                            </strong>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge-status ${(r.status || 'present').toLowerCase().replace(/\s+/g, '-')}`}>
                            {r.status}
                          </span>
                          {r.isLate && (
                            <span className="badge bg-warning text-dark ms-1 small">+{r.lateMinutes}m</span>
                          )}
                          {r.isEarlyDeparture && (
                            <span className="badge bg-info text-dark ms-1 small">-{r.earlyDepartureMinutes}m</span>
                          )}
                        </td>
                        <td className="small text-muted">{r.notes || '-'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isAdminOrManager ? 7 : 6} className="text-center py-5 text-muted">
                      No attendance records found matching the specified filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 6. Correction Requests Tab Content */
        <div className="opt-card mb-0">
          <div className="table-responsive">
            <table className="opt-table">
              <thead>
                <tr>
                  {isAdminOrManager && <th>Employee</th>}
                  <th>Target Date</th>
                  <th>Requested In & Out Timestamps</th>
                  <th>Audit Reason</th>
                  <th>Current Status</th>
                  <th>Manager / Reviewer Notes</th>
                  {isAdminOrManager && <th>Review Action</th>}
                </tr>
              </thead>
              <tbody>
                {corrections.length > 0 ? (
                  corrections.map((c) => (
                    <tr key={c._id}>
                      {isAdminOrManager && (
                        <td>
                          <div className="fw-semibold text-dark">{c.user?.fullName}</div>
                          <div className="text-muted small">{c.user?.employeeId}</div>
                        </td>
                      )}
                      <td className="fw-semibold text-dark">{c.date}</td>
                      <td>
                        <div className="small">
                          <strong>In:</strong>{' '}
                          {new Date(c.requestedCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="small text-muted">
                          <strong>Out:</strong>{' '}
                          {new Date(c.requestedCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="small" style={{ maxWidth: 280 }}>
                        {c.reason}
                      </td>
                      <td>
                        <span className={`badge-status ${(c.status || 'pending').toLowerCase()}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {c.reviewNotes || (c.status === 'Pending' ? 'Awaiting manager review' : '-')}
                      </td>
                      {isAdminOrManager && (
                        <td>
                          {c.status === 'Pending' ? (
                            <div className="d-flex gap-1">
                              <button
                                onClick={() => handleReviewCorrection(c._id, 'Approved')}
                                className="btn btn-sm btn-success py-1 px-2"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewCorrection(c._id, 'Rejected')}
                                className="btn btn-sm btn-outline-danger py-1 px-2"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="small text-muted">
                              Reviewed by {c.reviewedBy?.fullName || 'Lead'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdminOrManager ? 7 : 6} className="text-center py-5 text-muted">
                      No correction requests currently on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Employee Attendance Correction Request */}
      {showCorrectionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(11, 48, 41, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Request Attendance Correction</h5>
                <button type="button" className="btn-close" onClick={() => setShowCorrectionModal(false)}></button>
              </div>
              <form onSubmit={handleSubmitCorrection}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Date of Session *</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={correctionForm.date}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Correct Check In *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        required
                        value={correctionForm.requestedCheckIn}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Correct Check Out *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        required
                        value={correctionForm.requestedCheckOut}
                        onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Audit Reason for Correction *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g. Device connectivity issue during departure, client on-site assignment, forgotten checkout punch..."
                      required
                      value={correctionForm.reason}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCorrectionModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Admin Manual Attendance Recording / Override */}
      {showAdminMarkModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(11, 48, 41, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Record / Adjust Employee Attendance</h5>
                <button type="button" className="btn-close" onClick={() => setShowAdminMarkModal(false)}></button>
              </div>
              <form onSubmit={handleAdminMarkSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Employee *</label>
                    <select
                      className="form-select"
                      required
                      value={adminMarkForm.userId}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, userId: e.target.value })}
                    >
                      <option value="">-- Choose Employee --</option>
                      {employeesList.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.fullName} ({emp.employeeId}) • {emp.designation}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={adminMarkForm.date}
                        onChange={(e) => setAdminMarkForm({ ...adminMarkForm, date: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Status *</label>
                      <select
                        className="form-select"
                        value={adminMarkForm.status}
                        onChange={(e) => setAdminMarkForm({ ...adminMarkForm, status: e.target.value })}
                      >
                        <option value="Present">Present</option>
                        <option value="Late">Late</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Absent">Absent</option>
                        <option value="On Leave">On Leave</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Check In Timestamp</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={adminMarkForm.checkIn}
                        onChange={(e) => setAdminMarkForm({ ...adminMarkForm, checkIn: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Check Out Timestamp</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={adminMarkForm.checkOut}
                        onChange={(e) => setAdminMarkForm({ ...adminMarkForm, checkOut: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Administrative Note</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Approved special project shift, verified manual punch"
                      value={adminMarkForm.notes}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdminMarkModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Record
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
