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
  FiSettings,
  FiSliders,
  FiUserCheck,
  FiInfo,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiCoffee,
  FiBriefcase,
} from 'react-icons/fi';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const AttendancePage = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';
  const isAdmin = user?.role === 'Admin';

  // Navigation / Tabs: 'logs' | 'corrections' | 'settings'
  const [activeTab, setActiveTab] = useState('logs');

  // Data states
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalDays: 0,
    totalRecords: 0,
    totalPresent: 0,
    totalLate: 0,
    totalHalfDay: 0,
    totalEarlyDeparture: 0,
    totalMissedCheckout: 0,
    totalHours: 0,
    avgHours: 0,
  });
  const [overview, setOverview] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managersList, setManagersList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Filter states
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterManager, setFilterManager] = useState('');
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
    reason: '',
  });

  const [reviewCorrectionItem, setReviewCorrectionItem] = useState(null);
  const [reviewNotesInput, setReviewNotesInput] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  const [viewRecordDetail, setViewRecordDetail] = useState(null);

  // Attendance Policy Settings
  const [settingsForm, setSettingsForm] = useState({
    officeStartTime: '09:30',
    officeEndTime: '18:30',
    gracePeriodMinutes: 15,
    weeklyOffs: ['Saturday', 'Sunday'],
    dailyWorkUpdateDeadline: '20:00',
    halfDayHoursThreshold: 4.5,
    fullDayHoursThreshold: 8,
    earlyDepartureThresholdMinutes: 30,
    maxCorrectionDaysAllowed: 7,
    allowCorrectionWeekends: true,
  });

  // Fetch today's session
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

  // Fetch overview operational counts
  const fetchOverview = async () => {
    if (!isAdminOrManager) return;
    try {
      setOverviewLoading(true);
      const res = await api.get('/attendance/overview', {
        params: { date: filterDate || new Date().toISOString().split('T')[0] },
      });
      if (res.data?.success) {
        setOverview(res.data.overview || null);
      }
    } catch (err) {
      console.error('Error fetching attendance overview:', err);
    } finally {
      setOverviewLoading(false);
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
        if (filterManager) params.manager = filterManager;
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

  // Fetch auxiliary data: departments, managers, employees
  const fetchAuxiliaryData = async () => {
    if (!isAdminOrManager) return;
    try {
      const [deptRes, empRes, mgrRes] = await Promise.all([
        api.get('/departments'),
        api.get('/users'),
        api.get('/managers'),
      ]);
      if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
      if (empRes.data?.success) setEmployeesList(empRes.data.users || []);
      if (mgrRes.data?.success) setManagersList(mgrRes.data.managers || []);
    } catch (err) {
      console.error('Error fetching auxiliary data:', err);
    }
  };

  // Fetch attendance policy settings
  const fetchSettings = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/attendance/settings');
      if (res.data?.success && res.data.settings) {
        setSettingsForm(res.data.settings);
      }
    } catch (err) {
      console.error('Error fetching attendance settings:', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'Employee') {
      fetchTodayAttendance();
    }
    fetchAuxiliaryData();
    fetchSettings();

    const handleSync = () => {
      if (user?.role === 'Employee') {
        fetchTodayAttendance();
      }
      fetchAttendance();
      fetchOverview();
    };
    window.addEventListener('attendance-updated', handleSync);
    return () => window.removeEventListener('attendance-updated', handleSync);
  }, [user]);

  useEffect(() => {
    fetchAttendance();
    fetchOverview();
  }, [filterDate, filterMonth, filterYear, filterStatus, filterDept, filterManager, filterUser, searchQuery]);

  useEffect(() => {
    if (activeTab === 'corrections') {
      fetchCorrections();
    }
  }, [activeTab]);

  // Handle Check-In
  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-in');
      toast.success(res.data.message || 'Checked in successfully!');
      await Promise.all([fetchTodayAttendance(), fetchAttendance(), fetchOverview()]);
      window.dispatchEvent(new CustomEvent('attendance-updated', { detail: res.data?.attendance }));
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
      await Promise.all([fetchTodayAttendance(), fetchAttendance(), fetchOverview()]);
      window.dispatchEvent(new CustomEvent('attendance-updated', { detail: res.data?.attendance }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Submit Employee Correction
  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctionForm.reason.trim()) {
      toast.warning('A detailed reason is mandatory for correction requests.');
      return;
    }
    try {
      const res = await api.post('/attendance/corrections', correctionForm);
      toast.success(res.data.message || 'Correction submitted for management approval.');
      setShowCorrectionModal(false);
      setCorrectionForm({
        date: new Date().toISOString().split('T')[0],
        requestedCheckIn: '',
        requestedCheckOut: '',
        reason: '',
      });
      fetchCorrections();
      fetchAttendance();
      fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit correction request.');
    }
  };

  // Open Review Correction Modal
  const handleOpenReviewModal = (item) => {
    setReviewCorrectionItem(item);
    setReviewNotesInput('');
  };

  // Execute Review (Approve or Reject)
  const handleExecuteReview = async (status) => {
    if (!reviewCorrectionItem) return;
    if (status === 'Rejected' && !reviewNotesInput.trim()) {
      toast.warning('Please enter a note explaining the rejection reason.');
      return;
    }
    try {
      setReviewActionLoading(true);
      const res = await api.put(`/attendance/corrections/${reviewCorrectionItem._id}`, {
        status,
        reviewNotes: reviewNotesInput.trim(),
      });
      toast.success(res.data.message || `Correction request ${status.toLowerCase()} successfully.`);
      setReviewCorrectionItem(null);
      fetchCorrections();
      fetchAttendance();
      fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to review correction.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Open Admin Edit Attendance Modal prefilled from row
  const handleOpenEditAttendance = (record) => {
    const toLocalDatetime = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setAdminMarkForm({
      userId: record.user?._id || '',
      date: record.date,
      checkIn: toLocalDatetime(record.checkIn),
      checkOut: toLocalDatetime(record.checkOut),
      status: record.status || 'Present',
      reason: record.adjustedReason || record.notes || '',
    });
    setShowAdminMarkModal(true);
  };

  // Handle Admin Manual Mark Attendance Submit
  const handleAdminMarkSubmit = async (e) => {
    e.preventDefault();
    if (!adminMarkForm.reason.trim()) {
      toast.warning('A mandatory audit reason is required for manual adjustments.');
      return;
    }
    if (adminMarkForm.checkIn && adminMarkForm.checkOut) {
      if (new Date(adminMarkForm.checkOut) <= new Date(adminMarkForm.checkIn)) {
        toast.warning('Check-out timestamp must be strictly later than check-in.');
        return;
      }
    }
    try {
      const res = await api.post('/attendance/admin-mark', adminMarkForm);
      toast.success(res.data.message || 'Attendance record saved and audited successfully.');
      setShowAdminMarkModal(false);
      setAdminMarkForm({
        userId: '',
        date: new Date().toISOString().split('T')[0],
        checkIn: '',
        checkOut: '',
        status: 'Present',
        reason: '',
      });
      fetchAttendance();
      fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance record.');
    }
  };

  // Save Attendance Policy Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await api.put('/attendance/settings', settingsForm);
      toast.success(res.data.message || 'Attendance policy settings updated successfully.');
      fetchOverview();
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update attendance settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilterDate('');
    setFilterMonth(String(new Date().getMonth() + 1));
    setFilterYear(String(new Date().getFullYear()));
    setFilterStatus('');
    setFilterDept('');
    setFilterManager('');
    setFilterUser('');
    setSearchQuery('');
  };

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      toast.info('No attendance records to export.');
      return;
    }

    const headers = [
      'Employee Name',
      'Employee ID',
      'Department',
      'Assigned Manager',
      'Date',
      'Check In',
      'Check Out',
      'Working Hours',
      'Status',
      'Late Arrival',
      'Early Departure',
      'Correction Status',
      'Notes & Audit Reason',
    ];

    const rows = records.map((r) => [
      `"${r.user?.fullName || user?.fullName || 'N/A'}"`,
      `"${r.user?.employeeId || user?.employeeId || 'N/A'}"`,
      `"${r.user?.department?.name || 'N/A'}"`,
      `"${r.user?.reportingManager?.fullName || 'Direct / Management'}"`,
      `"${r.date}"`,
      `"${r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}"`,
      `"${r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}"`,
      `"${r.workingHours || 0} hrs"`,
      `"${r.status}"`,
      `"${r.isLate ? `Yes (+${r.lateMinutes}m)` : 'No'}"`,
      `"${r.isEarlyDeparture ? `Yes (-${r.earlyDepartureMinutes}m)` : 'No'}"`,
      `"${r.hasPendingCorrection ? 'Pending Review' : (r.correction?.status || 'None')}"`,
      `"${(r.adjustedReason || r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `one_planet_attendance_${filterDate || `${filterYear}_${filterMonth}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendance records exported successfully.');
  };

  const isCheckedIn = !!todayRecord?.checkIn;
  const isCheckedOut = !!todayRecord?.checkOut;

  return (
    <MainLayout
      title={isAdmin ? 'Company Attendance Management' : isAdminOrManager ? 'Team Attendance Supervision' : 'My Attendance Portal'}
      subtitle={isAdminOrManager ? 'Operational monitoring, verified punch timestamps, scheduled shift tracking, and correction audits' : 'Track daily punch timestamps, view working hours, and request verified attendance corrections'}
    >
      {/* 1. Header Control: Admin / Management Cockpit vs Employee Self-Service Punch Card */}
      {isAdminOrManager ? (
        <div className="opt-card mb-4">
          <div className="opt-card-body p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    background: 'var(--opt-forest-light)',
                    color: 'var(--opt-forest)',
                    border: '1px solid var(--opt-forest-border)',
                  }}
                >
                  <FiClock size={26} />
                </div>
                <div>
                  <div className="small fw-bold text-uppercase" style={{ color: 'var(--opt-text-secondary)', letterSpacing: '0.5px' }}>
                    {isAdmin ? 'Enterprise Workforce Governance' : 'Team Attendance Supervision'} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <h4 className="fw-bold mb-0 mt-1" style={{ color: 'var(--opt-forest)' }}>
                    {isAdmin ? 'Attendance Management & Audit Cockpit' : 'Team Attendance Monitoring Portal'}
                  </h4>
                </div>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 fw-medium d-inline-flex align-items-center gap-1">
                  <FiCheckCircle size={14} /> Live Governance Active
                </span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setAdminMarkForm({
                        userId: '',
                        date: filterDate || new Date().toISOString().split('T')[0],
                        checkIn: '',
                        checkOut: '',
                        status: 'Present',
                        reason: '',
                      });
                      setShowAdminMarkModal(true);
                    }}
                    className="btn btn-primary d-inline-flex align-items-center gap-1 px-3 py-2"
                  >
                    <FiEdit3 size={15} /> Record / Adjust Attendance
                  </button>
                )}
                <button
                  onClick={handleExportCSV}
                  className="btn btn-outline-secondary d-inline-flex align-items-center gap-1 px-3 py-2"
                >
                  <FiDownload size={15} /> Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Employee Self-Service Punch Session Card */
        <div className="opt-card mb-4">
          <div className="opt-card-body p-4">
            <div className="row align-items-center g-3">
              <div className="col-lg-5 col-md-6">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: 48,
                      height: 48,
                      background: 'var(--opt-forest-light)',
                      color: 'var(--opt-forest)',
                      border: '1px solid var(--opt-forest-border)',
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
                        ? 'Session Completed for Today'
                        : isCheckedIn
                        ? 'Active Punch-In Session (In Progress)'
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
                      {isCheckedOut && todayRecord?.workingHours
                        ? `${todayRecord.workingHours} hrs`
                        : isCheckedIn
                        ? 'In Progress'
                        : '0 hrs'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Check-In / Check-Out Buttons */}
              <div className="col-lg-3 col-12 d-flex gap-2 justify-content-lg-end mt-2 mt-lg-0">
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckedIn || actionLoading}
                  className="btn btn-primary flex-fill d-inline-flex align-items-center justify-content-center gap-2 py-2"
                  style={{ minWidth: 0 }}
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
                  style={{ minWidth: 0 }}
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

            {/* Consistent Alerts: Late arrival only if checked in and late */}
            {isCheckedIn && todayRecord?.isLate && (
              <div className="alert alert-warning py-2 px-3 small mt-3 mb-0 d-flex align-items-center gap-2">
                <FiAlertCircle className="flex-shrink-0 text-warning" size={16} />
                <span>Late arrival recorded for today (+{todayRecord.lateMinutes} minutes beyond grace period).</span>
              </div>
            )}
            {/* Early departure only if checked out and early departure exists */}
            {isCheckedOut && todayRecord?.isEarlyDeparture && (
              <div className="alert alert-info py-2 px-3 small mt-2 mb-0 d-flex align-items-center gap-2">
                <FiAlertCircle className="flex-shrink-0 text-info" size={16} />
                <span>Early departure recorded for today (-{todayRecord.earlyDepartureMinutes} minutes before shift end).</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Key Metrics & Operational Overview Cards */}
      {isAdminOrManager && overview ? (
        <div className="row g-3 mb-4">
          {/* Scheduled to Work */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Scheduled to Work</div>
                <div className="stat-val" style={{ color: 'var(--opt-forest)' }}>
                  {overview.scheduledToWork ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Total active staff on shift today
                </div>
              </div>
              <div className="stat-icon" style={{ background: 'var(--opt-mint)', color: 'var(--opt-forest)' }}>
                <FiBriefcase />
              </div>
            </div>
          </div>

          {/* Present */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Present & Verified</div>
                <div className="stat-val text-success">
                  {overview.present ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Checked in ({overview.scheduledToWork > 0 ? Math.round((overview.present / overview.scheduledToWork) * 100) : 0}% turn-out)
                </div>
              </div>
              <div className="stat-icon bg-success bg-opacity-10 text-success">
                <FiCheckCircle />
              </div>
            </div>
          </div>

          {/* Absent */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Absent (Unrecorded)</div>
                <div className="stat-val text-danger">
                  {overview.absent ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Scheduled without punch or leave
                </div>
              </div>
              <div className="stat-icon bg-danger bg-opacity-10 text-danger">
                <FiAlertCircle />
              </div>
            </div>
          </div>

          {/* Late Arrivals */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Late Arrivals</div>
                <div className="stat-val text-warning">
                  {overview.lateArrivals ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Checked in past grace window
                </div>
              </div>
              <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                <FiClock />
              </div>
            </div>
          </div>

          {/* On Approved Leave */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">On Approved Leave</div>
                <div className="stat-val text-info">
                  {overview.onApprovedLeave ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Authorized time off & leaves
                </div>
              </div>
              <div className="stat-icon bg-info bg-opacity-10 text-info">
                <FiCalendar />
              </div>
            </div>
          </div>

          {/* Weekly Off & Holidays */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Weekly Off & Holidays</div>
                <div className="stat-val text-secondary">
                  {overview.weeklyOffAndHoliday ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  {overview.isHoliday ? `Public Holiday: ${overview.holidayName}` : 'Rostered weekly off'}
                </div>
              </div>
              <div className="stat-icon bg-secondary bg-opacity-10 text-secondary">
                <FiCoffee />
              </div>
            </div>
          </div>

          {/* Missed Checkouts & Early Departures */}
          <div className="col-xl-3 col-md-6">
            <div className="stat-card h-100">
              <div>
                <div className="stat-label">Missed & Early Dep.</div>
                <div className="stat-val" style={{ color: '#D97706' }}>
                  {overview.missedCheckouts ?? 0} <span className="fs-6 fw-normal text-muted">/ {overview.earlyDepartures ?? 0}</span>
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Missed punches vs early leaves
                </div>
              </div>
              <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                <FiAlertTriangle />
              </div>
            </div>
          </div>

          {/* Pending Corrections */}
          <div className="col-xl-3 col-md-6">
            <div
              className="stat-card h-100"
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('corrections')}
              title="Click to view pending correction requests"
            >
              <div>
                <div className="stat-label">Pending Corrections</div>
                <div className="stat-val" style={{ color: overview.pendingCorrections > 0 ? '#DC2626' : 'var(--opt-forest)' }}>
                  {overview.pendingCorrections ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  {overview.pendingCorrections > 0 ? 'Action required by reviewer →' : 'All requests processed'}
                </div>
              </div>
              <div
                className="stat-icon"
                style={{
                  background: overview.pendingCorrections > 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--opt-mint)',
                  color: overview.pendingCorrections > 0 ? '#DC2626' : 'var(--opt-forest)',
                }}
              >
                <FiSliders />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Employee Personal Summary Cards */
        <div className="row g-3 mb-4">
          <div className="col-xl-3 col-md-6">
            <div className="stat-card">
              <div>
                <div className="stat-label">Total Days Logged</div>
                <div className="stat-val">{summary.totalRecords || summary.totalDays || records.length}</div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  In selected month / period
                </div>
              </div>
              <div className="stat-icon" style={{ background: 'var(--opt-mint)', color: 'var(--opt-forest)' }}>
                <FiCalendar />
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-md-6">
            <div className="stat-card">
              <div>
                <div className="stat-label">Days Present</div>
                <div className="stat-val text-success">
                  {summary.totalPresent ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Verified attendance
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
                <div className="stat-val text-warning">
                  {summary.totalLate ?? 0}
                </div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  Checked in past grace period
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
              <div className="stat-icon" style={{ background: 'rgba(22, 107, 80, 0.1)', color: 'var(--opt-green-secondary)' }}>
                <FiClock />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs & Header Actions */}
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
          {isAdmin && (
            <button
              className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('settings')}
            >
              <FiSettings className="me-1" size={13} />
              Attendance Settings
            </button>
          )}
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
              onClick={() => {
                setAdminMarkForm({
                  userId: '',
                  date: filterDate || new Date().toISOString().split('T')[0],
                  checkIn: '',
                  checkOut: '',
                  status: 'Present',
                  reason: '',
                });
                setShowAdminMarkModal(true);
              }}
              className="btn btn-sm btn-primary d-flex align-items-center gap-1"
            >
              <FiEdit3 size={14} /> Record / Adjust Attendance
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

      {/* 4. Filter Toolbar (for Attendance Logs) */}
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
                      placeholder="Search name, ID or email..."
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

              {isAdminOrManager && (
                <div className="col-lg-2 col-md-6">
                  <select
                    className="form-select form-select-sm"
                    value={filterManager}
                    onChange={(e) => setFilterManager(e.target.value)}
                  >
                    <option value="">All Managers / Leads</option>
                    {managersList.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.fullName} ({m.employeeId})
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

              <div className="col-lg-1 col-md-4 col-6">
                <select
                  className="form-select form-select-sm"
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterDate('');
                    setFilterMonth(e.target.value);
                  }}
                  disabled={!!filterDate}
                >
                  <option value="1">Jan</option>
                  <option value="2">Feb</option>
                  <option value="3">Mar</option>
                  <option value="4">Apr</option>
                  <option value="5">May</option>
                  <option value="6">Jun</option>
                  <option value="7">Jul</option>
                  <option value="8">Aug</option>
                  <option value="9">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dec</option>
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

              <div className="col-lg-1 col-md-6 col-6">
                <select
                  className="form-select form-select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Early Departure">Early Departure</option>
                  <option value="Missed Check-out">Missed Check-out</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Holiday">Holiday</option>
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

      {/* 5. Attendance Logs Table Tab */}
      {activeTab === 'logs' && (
        <div className="opt-card mb-0">
          <div className="table-responsive">
            <table className="opt-table">
              <thead>
                <tr>
                  {isAdminOrManager && <th>Employee Details</th>}
                  {isAdminOrManager && <th>Assigned Manager</th>}
                  <th>Date & Day</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Calculated Hours</th>
                  <th>Attendance Status</th>
                  <th>Correction Status</th>
                  <th>Actions & Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdminOrManager ? 9 : 7} className="text-center py-5">
                      <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                      Loading verified attendance records...
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
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
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
                                  <span className="font-monospace fw-bold">{r.user?.employeeId}</span> • {r.user?.department?.name || 'General'}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}

                        {isAdminOrManager && (
                          <td>
                            <div className="small">
                              {r.user?.reportingManager?.fullName ? (
                                <span className="fw-medium text-dark d-flex align-items-center gap-1">
                                  <FiUserCheck size={13} className="text-success" />
                                  {r.user.reportingManager.fullName}
                                </span>
                              ) : (
                                <span className="text-muted fst-italic">Direct / Management</span>
                              )}
                            </div>
                          </td>
                        )}

                        <td>
                          <span className="fw-semibold text-dark">{r.date}</span>
                          {dayName && <span className="text-muted small ms-2">({dayName})</span>}
                        </td>

                        <td>
                          {r.checkIn ? (
                            <div>
                              <span className="fw-medium text-dark">
                                {new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {r.isLate && (
                                <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.68rem' }}>
                                  +{r.lateMinutes}m
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">--:--</span>
                          )}
                        </td>

                        <td>
                          {r.checkOut ? (
                            <div>
                              <span className="fw-medium text-dark">
                                {new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {r.isEarlyDeparture && (
                                <span className="badge bg-info text-dark ms-1" style={{ fontSize: '0.68rem' }}>
                                  -{r.earlyDepartureMinutes}m
                                </span>
                              )}
                            </div>
                          ) : r.checkIn ? (
                            <span className="badge bg-primary bg-opacity-10 text-primary fw-normal">In Progress</span>
                          ) : (
                            <span className="text-muted">--:--</span>
                          )}
                        </td>

                        <td>
                          {r.checkIn && !r.checkOut ? (
                            <span className="badge bg-primary bg-opacity-10 text-primary fw-medium px-2 py-1">
                              In Progress
                            </span>
                          ) : r.workingHours ? (
                            <strong style={{ color: 'var(--opt-forest)' }}>
                              {r.workingHours} hrs
                            </strong>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>

                        <td>
                          <span className={`badge-status ${(r.status || 'present').toLowerCase().replace(/\s+/g, '-')}`}>
                            {r.checkIn && !r.checkOut && (r.status === 'Present' || r.status === 'Late') ? `${r.status} (In Progress)` : r.status}
                          </span>
                        </td>

                        <td>
                          {r.hasPendingCorrection ? (
                            <button
                              onClick={() => handleOpenReviewModal(r.correction)}
                              className="btn btn-xs btn-outline-warning py-0 px-2 fw-semibold d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '0.72rem' }}
                              title="Click to review pending correction request"
                            >
                              <FiAlertCircle size={11} /> Correction Pending
                            </button>
                          ) : r.correction?.status === 'Approved' ? (
                            <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: '0.72rem' }}>
                              <FiCheck size={11} className="me-1" /> Corrected
                            </span>
                          ) : r.correction?.status === 'Rejected' ? (
                            <span className="badge bg-danger bg-opacity-10 text-danger" style={{ fontSize: '0.72rem' }}>
                              <FiX size={11} className="me-1" /> Rejected
                            </span>
                          ) : (
                            <span className="text-muted small">--</span>
                          )}
                        </td>

                        <td>
                          <div className="d-flex align-items-center gap-1">
                            {isAdmin && (
                              <button
                                onClick={() => handleOpenEditAttendance(r)}
                                className="btn btn-sm btn-outline-primary py-0 px-2"
                                style={{ fontSize: '0.75rem' }}
                                title="Adjust attendance with mandatory audit reason"
                              >
                                Edit
                              </button>
                            )}

                            {(r.notes || r.adjustedReason) && (
                              <button
                                onClick={() => setViewRecordDetail(r)}
                                className="btn btn-sm btn-light py-0 px-2 text-muted"
                                style={{ fontSize: '0.75rem' }}
                                title="View audit reason and details"
                              >
                                <FiInfo size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isAdminOrManager ? 9 : 7} className="text-center py-5 text-muted">
                      No attendance records found matching the specified filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Correction Requests Tab */}
      {activeTab === 'corrections' && (
        <div className="opt-card mb-0">
          <div className="table-responsive">
            <table className="opt-table">
              <thead>
                <tr>
                  {isAdminOrManager && <th>Employee Details</th>}
                  <th>Target Date</th>
                  <th>Requested Check-In & Check-Out</th>
                  <th>Audit Reason for Correction</th>
                  <th>Status</th>
                  <th>Reviewer Notes & Action</th>
                </tr>
              </thead>
              <tbody>
                {corrections.length > 0 ? (
                  corrections.map((c) => (
                    <tr key={c._id}>
                      {isAdminOrManager && (
                        <td>
                          <div className="fw-semibold text-dark">{c.user?.fullName}</div>
                          <div className="text-muted small">{c.user?.employeeId} • {c.user?.designation}</div>
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
                      <td>
                        {c.status === 'Pending' && isAdminOrManager ? (
                          <button
                            onClick={() => handleOpenReviewModal(c)}
                            className="btn btn-sm btn-primary py-1 px-3"
                          >
                            Review Request
                          </button>
                        ) : (
                          <div className="small text-muted">
                            {c.reviewNotes && <div>{c.reviewNotes}</div>}
                            {c.reviewedBy && <div>Reviewed by: {c.reviewedBy.fullName}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdminOrManager ? 6 : 5} className="text-center py-5 text-muted">
                      No correction requests currently on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Attendance Settings Tab (Admin only) */}
      {isAdmin && activeTab === 'settings' && (
        <div className="opt-card">
          <div className="opt-card-body p-4">
            <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
              <div>
                <h5 className="fw-bold mb-1" style={{ color: 'var(--opt-forest)' }}>
                  Attendance & Shift Policy Settings
                </h5>
                <p className="text-muted small mb-0">
                  Configure corporate office shift timings, grace windows, early departure limits, weekly offs, and correction permissions.
                </p>
              </div>
              <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                Administrator Policy Guard
              </span>
            </div>

            <form onSubmit={handleSaveSettings}>
              <div className="row g-4">
                {/* Office Shift Timings */}
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Default Shift Start Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    required
                    value={settingsForm.officeStartTime}
                    onChange={(e) => setSettingsForm({ ...settingsForm, officeStartTime: e.target.value })}
                  />
                  <span className="text-muted small">Standard punch-in expectation (e.g. 09:30)</span>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Default Shift End Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    required
                    value={settingsForm.officeEndTime}
                    onChange={(e) => setSettingsForm({ ...settingsForm, officeEndTime: e.target.value })}
                  />
                  <span className="text-muted small">Standard departure expectation (e.g. 18:30)</span>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Late Arrival Grace Period (Minutes) *</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    className="form-control"
                    required
                    value={settingsForm.gracePeriodMinutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, gracePeriodMinutes: Number(e.target.value) })}
                  />
                  <span className="text-muted small">Minutes past start time before marked Late</span>
                </div>

                {/* Working Hours Thresholds */}
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Full-Day Working Hours Threshold *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="16"
                    className="form-control"
                    required
                    value={settingsForm.fullDayHoursThreshold}
                    onChange={(e) => setSettingsForm({ ...settingsForm, fullDayHoursThreshold: Number(e.target.value) })}
                  />
                  <span className="text-muted small">Minimum hours for verified full-day presence</span>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Half-Day Working Hours Threshold *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="8"
                    className="form-control"
                    required
                    value={settingsForm.halfDayHoursThreshold}
                    onChange={(e) => setSettingsForm({ ...settingsForm, halfDayHoursThreshold: Number(e.target.value) })}
                  />
                  <span className="text-muted small">Below this threshold, status is marked Half Day</span>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Early Departure Threshold (Minutes) *</label>
                  <input
                    type="number"
                    min="0"
                    max="240"
                    className="form-control"
                    required
                    value={settingsForm.earlyDepartureThresholdMinutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, earlyDepartureThresholdMinutes: Number(e.target.value) })}
                  />
                  <span className="text-muted small">Departure minutes before shift end triggering alert</span>
                </div>

                {/* Correction Permissions */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Max Past Days Allowed for Correction *</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="form-control"
                    required
                    value={settingsForm.maxCorrectionDaysAllowed}
                    onChange={(e) => setSettingsForm({ ...settingsForm, maxCorrectionDaysAllowed: Number(e.target.value) })}
                  />
                  <span className="text-muted small">Employees cannot request corrections for sessions older than this window</span>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Daily Work Update Submission Cutoff</label>
                  <input
                    type="time"
                    className="form-control"
                    value={settingsForm.dailyWorkUpdateDeadline}
                    onChange={(e) => setSettingsForm({ ...settingsForm, dailyWorkUpdateDeadline: e.target.value })}
                  />
                  <span className="text-muted small">Evening deadline for work log submission</span>
                </div>

                {/* Weekly Off Days Selection */}
                <div className="col-12">
                  <label className="form-label fw-semibold small d-block">Configured Company Weekly Offs</label>
                  <div className="d-flex flex-wrap gap-3 p-3 rounded-3" style={{ background: 'var(--opt-bg)', border: '1px solid var(--opt-border)' }}>
                    {WEEKDAYS.map((day) => {
                      const isChecked = (settingsForm.weeklyOffs || []).includes(day);
                      return (
                        <div key={day} className="form-check form-check-inline">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`off_${day}`}
                            checked={isChecked}
                            onChange={(e) => {
                              const current = settingsForm.weeklyOffs || [];
                              if (e.target.checked) {
                                setSettingsForm({ ...settingsForm, weeklyOffs: [...current, day] });
                              } else {
                                setSettingsForm({ ...settingsForm, weeklyOffs: current.filter((d) => d !== day) });
                              }
                            }}
                          />
                          <label className="form-check-label fw-medium small" htmlFor={`off_${day}`}>
                            {day}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn btn-primary d-inline-flex align-items-center gap-2 px-4 py-2"
                >
                  {savingSettings ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <>
                      <FiCheck size={16} />
                      <span>Save Policy Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
                    <label className="form-label small fw-semibold">Mandatory Audit Reason for Correction *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g. Technical glitch during punch out, client on-site deployment, verified punch failure..."
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
                      <label className="form-label small fw-semibold">Attendance Status *</label>
                      <select
                        className="form-select"
                        value={adminMarkForm.status}
                        onChange={(e) => setAdminMarkForm({ ...adminMarkForm, status: e.target.value })}
                      >
                        <option value="Present">Present</option>
                        <option value="Late">Late</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Early Departure">Early Departure</option>
                        <option value="Absent">Absent</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Weekly Off">Weekly Off</option>
                        <option value="Holiday">Holiday</option>
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
                    <label className="form-label small fw-semibold">Mandatory Audit Reason / Explanation *</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      required
                      placeholder="e.g. Approved manual checkin by management, biometric scanner failure, verified project work..."
                      value={adminMarkForm.reason}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, reason: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdminMarkModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Record & Audit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Review Attendance Correction Modal (Admin / Manager) */}
      {reviewCorrectionItem && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(11, 48, 41, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Review Attendance Correction Request</h5>
                <button type="button" className="btn-close" onClick={() => setReviewCorrectionItem(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="p-3 rounded-3 mb-3" style={{ background: 'var(--opt-bg)', border: '1px solid var(--opt-border)' }}>
                  <div className="small text-muted mb-1">EMPLOYEE</div>
                  <div className="fw-bold fs-6 text-dark">{reviewCorrectionItem.user?.fullName} ({reviewCorrectionItem.user?.employeeId})</div>
                  <div className="small text-muted">{reviewCorrectionItem.user?.designation} • {reviewCorrectionItem.user?.department?.name || 'Department'}</div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <span className="small text-muted d-block">SESSION DATE</span>
                    <strong className="text-dark">{reviewCorrectionItem.date}</strong>
                  </div>
                  <div className="col-6">
                    <span className="small text-muted d-block">CURRENT STATUS</span>
                    <span className={`badge-status ${(reviewCorrectionItem.status || 'pending').toLowerCase()}`}>
                      {reviewCorrectionItem.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-3 mb-3 border bg-light">
                  <div className="small text-muted mb-1 fw-semibold">REQUESTED TIMESTAMPS:</div>
                  <div className="d-flex justify-content-between small">
                    <span><strong>Check In:</strong> {new Date(reviewCorrectionItem.requestedCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span><strong>Check Out:</strong> {new Date(reviewCorrectionItem.requestedCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">EMPLOYEE'S AUDIT REASON</label>
                  <div className="p-2 border rounded bg-white small text-dark fst-italic">
                    "{reviewCorrectionItem.reason}"
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-semibold">Reviewer Audit Notes / Justification</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Enter approval note or rejection reason..."
                    value={reviewNotesInput}
                    onChange={(e) => setReviewNotesInput(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setReviewCorrectionItem(null)}
                >
                  Close
                </button>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    disabled={reviewActionLoading}
                    onClick={() => handleExecuteReview('Rejected')}
                    className="btn btn-outline-danger"
                  >
                    Reject Correction
                  </button>
                  <button
                    type="button"
                    disabled={reviewActionLoading}
                    onClick={() => handleExecuteReview('Approved')}
                    className="btn btn-success"
                  >
                    Approve Correction
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: View Record Details & Audit Info */}
      {viewRecordDetail && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(11, 48, 41, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Attendance Record Audit Details</h5>
                <button type="button" className="btn-close" onClick={() => setViewRecordDetail(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <span className="small text-muted d-block">EMPLOYEE</span>
                  <strong className="fs-6 text-dark">{viewRecordDetail.user?.fullName} ({viewRecordDetail.user?.employeeId})</strong>
                  <div className="small text-muted">Assigned Manager: {viewRecordDetail.user?.reportingManager?.fullName || 'Direct'}</div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <span className="small text-muted d-block">DATE</span>
                    <strong>{viewRecordDetail.date}</strong>
                  </div>
                  <div className="col-6">
                    <span className="small text-muted d-block">STATUS</span>
                    <span className={`badge-status ${(viewRecordDetail.status || 'present').toLowerCase().replace(/\s+/g, '-')}`}>
                      {viewRecordDetail.status}
                    </span>
                  </div>
                  <div className="col-6">
                    <span className="small text-muted d-block">CHECK IN</span>
                    <span>{viewRecordDetail.checkIn ? new Date(viewRecordDetail.checkIn).toLocaleTimeString() : '--:--'}</span>
                  </div>
                  <div className="col-6">
                    <span className="small text-muted d-block">CHECK OUT</span>
                    <span>{viewRecordDetail.checkOut ? new Date(viewRecordDetail.checkOut).toLocaleTimeString() : '--:--'}</span>
                  </div>
                  <div className="col-6">
                    <span className="small text-muted d-block">TOTAL WORKING HOURS</span>
                    <strong style={{ color: 'var(--opt-forest)' }}>{viewRecordDetail.workingHours || 0} hrs</strong>
                  </div>
                  <div className="col-6">
                    <span className="small text-muted d-block">LATE ARRIVAL</span>
                    <span>{viewRecordDetail.isLate ? `Yes (+${viewRecordDetail.lateMinutes}m)` : 'No'}</span>
                  </div>
                </div>

                {viewRecordDetail.adjustedBy && (
                  <div className="alert alert-info py-2 px-3 small mb-3">
                    <strong>Manual Override:</strong> Adjusted by {viewRecordDetail.adjustedBy.fullName} ({viewRecordDetail.adjustedBy.employeeId})
                  </div>
                )}

                <div className="p-3 border rounded bg-light">
                  <span className="small fw-semibold text-muted d-block mb-1">AUDIT REASON & NOTES:</span>
                  <div className="small text-dark">
                    {viewRecordDetail.adjustedReason || viewRecordDetail.notes || 'No special notes recorded.'}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={() => setViewRecordDetail(null)}>
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
