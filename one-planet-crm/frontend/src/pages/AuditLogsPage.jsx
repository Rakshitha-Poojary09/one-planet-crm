import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiShield } from 'react-icons/fi';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/system/audit-logs');
        if (res.data?.success) {
          setLogs(res.data.logs);
        }
      } catch (err) {
        toast.error('Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <MainLayout
      title="System Audit Trail & Security Logs"
      subtitle="Complete chronological history of administrative, employee and workflow actions"
    >
      <div className="opt-card mb-0">
        <div className="opt-card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-dark d-flex align-items-center gap-2">
            <FiShield className="text-primary" /> Immutable Audit Trail
          </h5>
          <span className="badge bg-white text-dark border">{logs.length} Entries</span>
        </div>
        <div className="table-responsive">
          <table className="opt-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Acting User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Summary of Change</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td className="small text-muted">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">
                        {log.actingUser?.fullName || 'System / Auto'}
                      </div>
                      <div className="text-muted small">
                        {log.actingUser?.email || '-'}
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-light text-primary border font-monospace">
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-secondary border">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="small text-dark">{log.changeSummary}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-muted">
                    No audit logs recorded yet.
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
