import React, { useState, useEffect } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiDownload,
  FiFilter,
  FiFileText,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';

export const ReportsPage = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  const [reportType, setReportType] = useState('attendance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  // Dropdown options
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Results
  const [loading, setLoading] = useState(false);
  const [dataRows, setDataRows] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (isAdminOrManager) {
      api
        .get('/departments')
        .then((res) => {
          if (res.data?.success) setDepartments(res.data.departments || []);
        })
        .catch(() => {});

      api
        .get('/users')
        .then((res) => {
          if (res.data?.success) setEmployees(res.data.users || []);
        })
        .catch(() => {});
    }
  }, [isAdminOrManager]);

  const handleFetchReport = async () => {
    try {
      setLoading(true);
      const params = { type: reportType };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (month && year) {
        params.month = month;
        params.year = year;
      } else if (startDate) {
        params.startDate = startDate;
      }

      if (statusFilter) params.status = statusFilter;
      if (selectedDept) params.department = selectedDept;
      if (selectedUser) params.employee = selectedUser;

      const res = await api.get('/reports/export-data', { params });
      if (res.data?.success) {
        setDataRows(res.data.rows || []);
        setSummary(res.data.summary || null);
        toast.success(`Generated ${res.data.rows?.length || 0} records.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setMonth('');
    setYear(String(new Date().getFullYear()));
    setStatusFilter('');
    setSelectedDept('');
    setSelectedUser('');
    setDataRows([]);
    setSummary(null);
  };

  const handleExportCSV = () => {
    if (dataRows.length === 0) {
      toast.warning('No records available to export.');
      return;
    }
    const headers = Object.keys(dataRows[0]).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers,
        ...dataRows.map((r) =>
          Object.values(r)
            .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `one_planet_${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV/Excel report downloaded successfully.');
  };

  return (
    <MainLayout
      title="Company Reports & Data Export"
      subtitle="Export corporate attendance, leaves, and daily work updates to CSV/Excel with MongoDB accuracy"
    >
      {/* 1. Filters Card */}
      <div className="opt-card mb-4">
        <div className="opt-card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-dark d-flex align-items-center gap-2">
            <FiFilter className="text-primary" /> Filter & Configure Report
          </h5>
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
          >
            <FiRefreshCw size={12} /> Reset
          </button>
        </div>
        <div className="opt-card-body p-4">
          <div className="row g-3">
            <div className="col-lg-3 col-md-6">
              <label className="form-label small fw-semibold">Report Dataset *</label>
              <select
                className="form-select"
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value);
                  setDataRows([]);
                  setSummary(null);
                }}
              >
                <option value="attendance">Daily & Monthly Attendance</option>
                <option value="leaves">Leave Applications & Balances</option>
                <option value="work-updates">Employee Daily Work Updates</option>
              </select>
            </div>

            {isAdminOrManager && (
              <div className="col-lg-3 col-md-6">
                <label className="form-label small fw-semibold">Department</label>
                <select
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isAdminOrManager && (
              <div className="col-lg-3 col-md-6">
                <label className="form-label small fw-semibold">Employee</label>
                <select
                  className="form-select"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">All Employees</option>
                  {employees
                    .filter((emp) => !selectedDept || emp.department?._id === selectedDept || emp.department === selectedDept)
                    .map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.fullName} ({emp.employeeId})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="col-lg-3 col-md-6">
              <label className="form-label small fw-semibold">Status</label>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {reportType === 'attendance' ? (
                  <>
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Early Departure">Early Departure</option>
                    <option value="Missed Check-out">Missed Check-out</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Absent">Absent</option>
                  </>
                ) : (
                  <>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Cancelled">Cancelled</option>
                  </>
                )}
              </select>
            </div>

            {/* Date Range Options */}
            <div className="col-lg-3 col-md-6">
              <label className="form-label small fw-semibold">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setMonth('');
                }}
              />
            </div>

            <div className="col-lg-3 col-md-6">
              <label className="form-label small fw-semibold">End Date</label>
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setMonth('');
                }}
              />
            </div>

            {/* Month & Year quick selector */}
            <div className="col-lg-3 col-md-6">
              <label className="form-label small fw-semibold">Or By Month</label>
              <select
                className="form-select"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setStartDate('');
                  setEndDate('');
                }}
              >
                <option value="">Select Month</option>
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

            <div className="col-lg-3 col-md-6 d-flex align-items-end gap-2">
              <button
                onClick={handleFetchReport}
                disabled={loading}
                className="btn btn-primary flex-fill"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={dataRows.length === 0}
                className="btn btn-success d-flex align-items-center gap-1"
                title="Download CSV"
              >
                <FiDownload size={16} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Attendance Summary Statistics Cards */}
      {summary && reportType === 'attendance' && (
        <div className="row g-3 mb-4">
          <div className="col-md-2 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Total Logs</div>
              <div className="fs-4 fw-bold text-dark mt-1">{summary.totalRecords}</div>
            </div>
          </div>
          <div className="col-md-2 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Present</div>
              <div className="fs-4 fw-bold text-success mt-1">{summary.totalPresent}</div>
            </div>
          </div>
          <div className="col-md-2 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Late Arrivals</div>
              <div className="fs-4 fw-bold text-warning mt-1">{summary.totalLate}</div>
            </div>
          </div>
          <div className="col-md-2 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Early Departures</div>
              <div className="fs-4 fw-bold mt-1" style={{ color: '#B45309' }}>
                {summary.totalEarlyDeparture}
              </div>
            </div>
          </div>
          <div className="col-md-2 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Missed Checkouts</div>
              <div className="fs-4 fw-bold mt-1" style={{ color: '#BE123C' }}>
                {summary.totalMissedCheckout}
              </div>
            </div>
          </div>
          <div className="col-md-2 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Total Hours</div>
              <div className="fs-4 fw-bold text-primary mt-1">{summary.totalHours} hrs</div>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Leave Summary Statistics Cards (with Loss of Pay) */}
      {summary && reportType === 'leaves' && (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Total Records</div>
              <div className="fs-4 fw-bold text-dark mt-1">{summary.totalRecords}</div>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Requested Days</div>
              <div className="fs-4 fw-bold text-primary mt-1">{summary.totalRequestedDays}</div>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center">
              <div className="text-muted small">Paid Leave Days</div>
              <div className="fs-4 fw-bold text-success mt-1">{summary.totalPaidLeaveDays}</div>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="p-3 bg-white rounded border shadow-sm text-center" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
              <div className="text-danger small fw-semibold">Loss of Pay (LOP) Days</div>
              <div className="fs-4 fw-bold text-danger mt-1">{summary.totalLOPDays}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Generated Report Preview Table */}
      <div className="opt-card mb-0">
        <div className="opt-card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-dark">
            Report Preview ({dataRows.length} Records)
          </h5>
          {dataRows.length > 0 && (
            <span className="small text-muted">Displaying latest records</span>
          )}
        </div>
        <div className="table-responsive">
          <table className="opt-table">
            <thead>
              {dataRows.length > 0 && (
                <tr>
                  {Object.keys(dataRows[0]).map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {dataRows.length > 0 ? (
                dataRows.slice(0, 100).map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((val, cIdx) => (
                      <td key={cIdx}>{String(val)}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="text-center py-5 text-muted">
                    No data to display. Select filters and click "Generate Report".
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
