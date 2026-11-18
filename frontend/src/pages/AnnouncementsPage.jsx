import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiBell, FiTrash2, FiCheck, FiExternalLink } from 'react-icons/fi';

export const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Normal',
    targetAudience: 'All',
  });

  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [aRes, nRes] = await Promise.all([
        api.get('/communication/announcements'),
        api.get('/communication/notifications'),
      ]);
      if (aRes.data?.success) setAnnouncements(aRes.data.announcements);
      if (nRes.data?.success) {
        setNotifications(nRes.data.notifications);
        setUnreadCount(nRes.data.unreadCount);
      }
    } catch (err) {
      toast.error('Failed to load announcements & notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/communication/announcements', form);
      toast.success('Announcement broadcasted.');
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to publish announcement.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/communication/announcements/${id}`);
      toast.success('Announcement deleted.');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/communication/notifications/mark-read', {});
      toast.success('All notifications marked as read.');
      fetchData();
    } catch (err) {
      toast.error('Failed to mark read.');
    }
  };

  return (
    <MainLayout
      title="Corporate Announcements & Alerts"
      subtitle="Broadcast notifications, critical company updates & team notices"
    >
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="m-0 fw-bold text-dark">Active Announcements</h5>
        <div className="d-flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn btn-sm btn-outline-secondary">
              <FiCheck /> Mark Notifications Read ({unreadCount})
            </button>
          )}
          {isAdminOrManager && (
            <button
              onClick={() => {
                setForm({ title: '', description: '', priority: 'Normal', targetAudience: 'All' });
                setShowModal(true);
              }}
              className="btn-opt-primary btn-sm"
            >
              <FiPlus /> Broadcast Announcement
            </button>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* Announcements List */}
        <div className="col-lg-8">
          <div className="d-flex flex-column gap-3">
            {announcements.length > 0 ? (
              announcements.map((a) => (
                <div key={a._id} className="opt-card mb-0">
                  <div className="opt-card-header bg-light d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h5 className="mb-0 text-dark fw-bold">{a.title}</h5>
                      {a.priority === 'Urgent' && <span className="badge bg-danger">Urgent Priority</span>}
                    </div>
                    {isAdminOrManager && (
                      <button
                        onClick={() => handleDelete(a._id)}
                        className="btn btn-sm btn-outline-danger p-1"
                        title="Delete Announcement"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="opt-card-body">
                    <p className="text-secondary leading-relaxed mb-3">{a.description}</p>
                    <div className="d-flex justify-content-between text-muted small border-top pt-2">
                      <span>Posted by: <strong className="text-dark">{a.createdBy?.fullName || 'Management'}</strong></span>
                      <span>Published: {new Date(a.publishDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5 text-center bg-white rounded border text-muted">
                No active announcements published.
              </div>
            )}
          </div>
        </div>

        {/* In-App Notifications Feed */}
        <div className="col-lg-4">
          <div className="opt-card mb-0">
            <div className="opt-card-header bg-light">
              <h5 className="d-flex align-items-center gap-2">
                <FiBell className="text-primary" /> Recent Alerts
              </h5>
            </div>
            <div className="opt-card-body p-0">
              {notifications.length > 0 ? (
                <div className="list-group list-group-flush">
                  {notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => {
                        if (n.link) {
                          navigate(n.link);
                        }
                      }}
                      style={{ cursor: n.link ? 'pointer' : 'default' }}
                      className={`list-group-item p-3 ${!n.isRead ? 'bg-light border-start border-primary border-3' : ''}`}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="fw-semibold text-dark small">{n.title}</div>
                        {n.link && <FiExternalLink size={12} className="text-primary" />}
                      </div>
                      <div className="text-muted small mt-1">{n.message}</div>
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted small">No notifications received yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Announcement Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Broadcast Announcement</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleCreateAnnouncement}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Title *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select"
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Target Audience</label>
                      <select
                        className="form-select"
                        value={form.targetAudience}
                        onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                      >
                        <option value="All">All Employees</option>
                        <option value="Department">Selected Department</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description / Notice Body *</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      required
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Publish Now
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
