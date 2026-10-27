import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiSave, FiSettings } from 'react-icons/fi';

export const SettingsPage = () => {
  const [settings, setSettings] = useState({
    companyName: 'One Planet Technologies',
    companyTimezone: 'Asia/Kolkata',
    officeStartTime: '09:30',
    officeEndTime: '18:30',
    gracePeriodMinutes: 15,
    dailyWorkUpdateDeadline: '20:00',
    halfDayHoursThreshold: 4.5,
    fullDayHoursThreshold: 8,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/system/settings');
        if (res.data?.success && res.data.settings) {
          setSettings(res.data.settings);
        }
      } catch (err) {
        toast.error('Failed to load system settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/system/settings', settings);
      toast.success(res.data.message || 'Settings saved successfully.');
    } catch (err) {
      toast.error('Failed to update system settings.');
    }
  };

  return (
    <MainLayout
      title="Company System Settings"
      subtitle="Configure office timings, grace periods, timezones, and attendance thresholds"
    >
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="opt-card mb-0">
            <div className="opt-card-header bg-light">
              <h5 className="mb-0 text-dark d-flex align-items-center gap-2">
                <FiSettings className="text-primary" /> Global Policy Configuration
              </h5>
            </div>
            <form onSubmit={handleSave}>
              <div className="opt-card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.companyName}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Company Timezone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.companyTimezone}
                      onChange={(e) => setSettings({ ...settings, companyTimezone: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Office Opening Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.officeStartTime}
                      onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Office Closing Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.officeEndTime}
                      onChange={(e) => setSettings({ ...settings, officeEndTime: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Late Grace Period (Mins)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.gracePeriodMinutes}
                      onChange={(e) => setSettings({ ...settings, gracePeriodMinutes: Number(e.target.value) })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Daily Work Update Deadline</label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.dailyWorkUpdateDeadline}
                      onChange={(e) => setSettings({ ...settings, dailyWorkUpdateDeadline: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Full Day Hours Threshold</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={settings.fullDayHoursThreshold}
                      onChange={(e) => setSettings({ ...settings, fullDayHoursThreshold: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="opt-card-header bg-light d-flex justify-content-end">
                <button type="submit" className="btn-opt-primary">
                  <FiSave /> Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
