import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardCalendar } from '../components/DashboardCalendar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiPlus,
  FiCalendar,
  FiTrash2,
  FiEdit2,
  FiMapPin,
  FiClock,
  FiCheckCircle,
  FiUsers,
  FiSettings,
} from 'react-icons/fi';

export const CalendarPage = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [events, setEvents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Holiday Modal (Create & Edit)
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'Festival',
    description: '',
  });

  // Event Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    location: '',
    description: '',
  });

  // Weekly Off Modal
  const [showWeeklyOffModal, setShowWeeklyOffModal] = useState(false);
  const [weeklyOffs, setWeeklyOffs] = useState(['Saturday', 'Sunday']);

  const isAdmin = user?.role === 'Admin';
  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hRes, eRes, lRes, sRes] = await Promise.all([
        api.get('/calendar/holidays'),
        api.get('/calendar/events'),
        api.get('/calendar/leaves'),
        api.get('/settings'),
      ]);
      if (hRes.data?.success) setHolidays(hRes.data.holidays || []);
      if (eRes.data?.success) setEvents(eRes.data.events || []);
      if (lRes.data?.success) setLeaves(lRes.data.leaves || []);
      if (sRes.data?.success && sRes.data.settings) {
        setSettings(sRes.data.settings);
        if (sRes.data.settings.weeklyOffs) {
          setWeeklyOffs(sRes.data.settings.weeklyOffs);
        }
      }
    } catch (err) {
      toast.error('Failed to load company calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateHoliday = () => {
    setEditingHolidayId(null);
    setHolidayForm({ name: '', date: '', type: 'Festival', description: '' });
    setShowHolidayModal(true);
  };

  const handleOpenEditHoliday = (h) => {
    setEditingHolidayId(h._id);
    const dateFormatted = h.date ? new Date(h.date).toISOString().split('T')[0] : '';
    setHolidayForm({
      name: h.name || '',
      date: dateFormatted,
      type: h.type || 'Festival',
      description: h.description || '',
    });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    try {
      if (editingHolidayId) {
        await api.put(`/calendar/holidays/${editingHolidayId}`, holidayForm);
        toast.success('Holiday updated and staff notified.');
      } else {
        await api.post('/calendar/holidays', holidayForm);
        toast.success('Holiday added to calendar and staff notified.');
      }
      setShowHolidayModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save holiday.');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday? Staff will be notified of schedule changes.')) return;
    try {
      await api.delete(`/calendar/holidays/${id}`);
      toast.success('Holiday deleted.');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete holiday.');
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/calendar/events', eventForm);
      toast.success('Company event scheduled.');
      setShowEventModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to schedule event.');
    }
  };

  const handleSaveWeeklyOffs = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings', { weeklyOffs });
      toast.success('Company weekly offs updated successfully.');
      setShowWeeklyOffModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to update weekly offs.');
    }
  };

  const toggleDayOfWeek = (day) => {
    if (weeklyOffs.includes(day)) {
      setWeeklyOffs(weeklyOffs.filter((d) => d !== day));
    } else {
      setWeeklyOffs([...weeklyOffs, day]);
    }
  };

  return (
    <MainLayout
      title="Company Calendar & Official Holidays"
      subtitle="Annual holiday schedule, corporate events, and planned off-days"
    >
      {/* Top Action Toolbar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-light text-dark border px-3 py-2">
            Weekly Offs: <strong>{weeklyOffs.join(', ') || 'None'}</strong>
          </span>
          {isAdmin && (
            <button
              onClick={() => setShowWeeklyOffModal(true)}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            >
              <FiSettings size={13} /> Configure Weekly Offs
            </button>
          )}
        </div>

        <div className="d-flex gap-2">
          {isAdmin && (
            <button onClick={handleOpenCreateHoliday} className="btn btn-sm btn-outline-primary">
              <FiPlus /> Add Holiday
            </button>
          )}
          {isAdminOrManager && (
            <button
              onClick={() => {
                setEventForm({ title: '', startDate: '', endDate: '', location: '', description: '' });
                setShowEventModal(true);
              }}
              className="btn-opt-primary btn-sm"
            >
              <FiPlus /> Schedule Company Event
            </button>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* 1. Official Holidays Section */}
        <div className="col-lg-7">
          <div className="opt-card mb-4">
            <div className="opt-card-header bg-light">
              <h5 className="d-flex align-items-center gap-2 mb-0">
                <FiCalendar className="text-primary" /> Official Holidays ({new Date().getFullYear()})
              </h5>
              <span className="badge bg-white text-dark border">{holidays.length} Days</span>
            </div>
            <div className="table-responsive">
              <table className="opt-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Holiday Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    {isAdmin && <th className="text-end">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {holidays.length > 0 ? (
                    holidays.map((h) => (
                      <tr key={h._id}>
                        <td>
                          <strong>
                            {new Date(h.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </strong>
                        </td>
                        <td className="fw-semibold text-dark">{h.name}</td>
                        <td>
                          <span className="badge bg-light text-secondary border">{h.type}</span>
                        </td>
                        <td className="small text-muted">{h.description || '-'}</td>
                        {isAdmin && (
                          <td className="text-end">
                            <div className="d-inline-flex gap-1">
                              <button
                                onClick={() => handleOpenEditHoliday(h)}
                                className="btn btn-sm btn-outline-secondary p-1"
                                title="Edit Holiday"
                              >
                                <FiEdit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteHoliday(h._id)}
                                className="btn btn-sm btn-outline-danger p-1"
                                title="Delete Holiday"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="text-center py-4 text-muted">
                        No holidays listed for this calendar period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approved Leaves Shared Calendar Section */}
          <div className="opt-card mb-0">
            <div className="opt-card-header bg-light">
              <h5 className="d-flex align-items-center gap-2 mb-0">
                <FiUsers className="text-info" /> Team Members on Approved Leave
              </h5>
              <span className="badge bg-white text-dark border">{leaves.length} Scheduled</span>
            </div>
            <div className="table-responsive">
              <table className="opt-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Category</th>
                    <th>Duration</th>
                    <th>Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length > 0 ? (
                    leaves.map((l) => (
                      <tr key={l._id}>
                        <td>
                          <div className="fw-semibold text-dark">{l.user?.fullName}</div>
                          <div className="text-muted small">{l.user?.employeeId}</div>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">{l.leaveType?.name || 'Leave'}</span>
                          {l.isHalfDay && <span className="badge bg-warning bg-opacity-10 text-dark ms-1">Half Day</span>}
                        </td>
                        <td>
                          <strong>{l.numberOfDays}d</strong>
                        </td>
                        <td className="small">
                          {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted">
                        No approved team leaves scheduled for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. Calendar & Corporate Events Section */}
        <div className="col-lg-5 d-flex flex-column gap-4">
          <DashboardCalendar title="Interactive Holiday Calendar" showManageLink={false} />

          <div className="opt-card mb-0">
            <div className="opt-card-header bg-light">
              <h5 className="d-flex align-items-center gap-2 mb-0">
                <FiMapPin className="text-primary" /> Company Events & Townhalls
              </h5>
            </div>
            <div className="opt-card-body p-0">
              {events.length > 0 ? (
                <div className="list-group list-group-flush">
                  {events.map((e) => (
                    <div key={e._id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <strong className="text-dark">{e.title}</strong>
                        <span className="badge bg-primary bg-opacity-10 text-primary">
                          {new Date(e.startDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-secondary small mt-1 mb-1">{e.description}</p>
                      <small className="text-muted d-block">Location: {e.location || 'Headquarters'}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No scheduled events on record.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Holiday Modal */}
      {showHolidayModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingHolidayId ? 'Edit Official Holiday' : 'Add Official Holiday'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowHolidayModal(false)}></button>
              </div>
              <form onSubmit={handleSaveHoliday}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Holiday Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. Diwali, Independence Day"
                      value={holidayForm.name}
                      onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={holidayForm.date}
                        onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Type</label>
                      <select
                        className="form-select"
                        value={holidayForm.type}
                        onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                      >
                        <option value="National">National</option>
                        <option value="Festival">Festival</option>
                        <option value="Company">Company Special</option>
                        <option value="Optional">Optional</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional notes or observance details"
                      value={holidayForm.description}
                      onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowHolidayModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingHolidayId ? 'Update & Notify' : 'Save & Notify'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Configure Weekly Offs Modal */}
      {showWeeklyOffModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Configure Company Weekly Offs</h5>
                <button type="button" className="btn-close" onClick={() => setShowWeeklyOffModal(false)}></button>
              </div>
              <form onSubmit={handleSaveWeeklyOffs}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Select regular non-working days for One Planet Technologies. Employees will not be marked absent on these days.
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(day)}
                        className={`btn btn-sm ${
                          weeklyOffs.includes(day) ? 'btn-primary' : 'btn-outline-secondary'
                        }`}
                      >
                        {weeklyOffs.includes(day) && <FiCheckCircle className="me-1" />}
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowWeeklyOffModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Weekly Offs
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Schedule Company Event</h5>
                <button type="button" className="btn-close" onClick={() => setShowEventModal(false)}></button>
              </div>
              <form onSubmit={handleAddEvent}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Event Title *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={eventForm.startDate}
                        onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Location / Channel</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="HQ Main Hall / Google Meet"
                        value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEventModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Publish Event
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
