import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiSave, FiSettings, FiCalendar, FiInfo } from 'react-icons/fi';

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
    leavePolicy: {
      monthlyAccrualRate: 1,
      annualEntitlement: 12,
      carryForwardEnabled: true,
      accrualDayOfMonth: 1,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/system/settings');
        if (res.data?.success && res.data.settings) {
          setSettings({
            ...res.data.settings,
            leavePolicy: {
              monthlyAccrualRate: 1,
              annualEntitlement: 12,
              carryForwardEnabled: true,
              accrualDayOfMonth: 1,
              ...(res.data.settings.leavePolicy || {}),
            },
          });
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
      subtitle="Configure office timings, grace periods, attendance thresholds, and leave accrual rules"
    >
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <div className="opt-card mb-0">
            <div className="opt-card-header bg-light">
              <h5 className="mb-0 text-dark d-flex align-items-center gap-2">
                <FiSettings className="text-primary" /> Global Policy Configuration
              </h5>
            </div>
            <form onSubmit={handleSave}>
              <div className="opt-card-body">
                {/* Office & Timing Settings */}
                <h6 className="fw-bold mb-3 text-dark">Office Hours & Attendance Thresholds</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.companyName || ''}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Company Timezone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.companyTimezone || ''}
                      onChange={(e) => setSettings({ ...settings, companyTimezone: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Office Opening Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.officeStartTime || ''}
                      onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Office Closing Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.officeEndTime || ''}
                      onChange={(e) => setSettings({ ...settings, officeEndTime: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Late Grace Period (Mins)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.gracePeriodMinutes || 0}
                      onChange={(e) => setSettings({ ...settings, gracePeriodMinutes: Number(e.target.value) })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Daily Work Update Deadline</label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.dailyWorkUpdateDeadline || ''}
                      onChange={(e) => setSettings({ ...settings, dailyWorkUpdateDeadline: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Full Day Hours Threshold</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={settings.fullDayHoursThreshold || 0}
                      onChange={(e) => setSettings({ ...settings, fullDayHoursThreshold: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Monthly Leave Accrual & Carry-Forward Policy Section */}
                <div className="border-top pt-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <h6 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                        <FiCalendar className="text-primary" /> Monthly Leave Accrual & Carry-Forward Policy
                      </h6>
                      <p className="text-muted small mb-0">
                        Configure monthly leave accrual rates, annual entitlement caps, and automatic carry-forward logic.
                      </p>
                    </div>
                  </div>

                  {/* Policy Explanatory Callout */}
                  <div className="p-3 bg-light rounded border mb-3">
                    <div className="d-flex align-items-start gap-2">
                      <FiInfo className="text-primary mt-1 flex-shrink-0" />
                      <div className="small text-muted">
                        <strong className="text-dark">One Planet Leave Policy:</strong> Each employee earns <strong>1 leave day per month</strong> (up to 12 days annually). Unused leave days automatically carry forward to the next month. Net available balance = Carried Forward + Current Month Earned - Approved Leaves Taken. Pending requests do not deduct from balance until approved.
                      </div>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Monthly Accrual Rate (Days/Mo)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        className="form-control"
                        value={settings.leavePolicy?.monthlyAccrualRate ?? 1}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            leavePolicy: {
                              ...settings.leavePolicy,
                              monthlyAccrualRate: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <div className="form-text small" style={{ fontSize: '0.72rem' }}>
                        Leave days credited each calendar month.
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Annual Entitlement Cap (Days/Yr)</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="60"
                        className="form-control"
                        value={settings.leavePolicy?.annualEntitlement ?? 12}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            leavePolicy: {
                              ...settings.leavePolicy,
                              annualEntitlement: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <div className="form-text small" style={{ fontSize: '0.72rem' }}>
                        Maximum leave days earned per year.
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Accrual Credit Day of Month</label>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        className="form-control"
                        value={settings.leavePolicy?.accrualDayOfMonth ?? 1}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            leavePolicy: {
                              ...settings.leavePolicy,
                              accrualDayOfMonth: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <div className="form-text small" style={{ fontSize: '0.72rem' }}>
                        Day on which monthly leave is credited (1st).
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="carryForwardSwitch"
                          checked={settings.leavePolicy?.carryForwardEnabled ?? true}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              leavePolicy: {
                                ...settings.leavePolicy,
                                carryForwardEnabled: e.target.checked,
                              },
                            })
                          }
                        />
                        <label className="form-check-label fw-semibold small" htmlFor="carryForwardSwitch">
                          Automatic Monthly Carry-Forward Enabled
                        </label>
                        <div className="text-muted small" style={{ fontSize: '0.74rem' }}>
                          When enabled, unused leave carries forward automatically into subsequent months.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="opt-card-header bg-light d-flex justify-content-end">
                <button type="submit" className="btn-opt-primary">
                  <FiSave /> Save All Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
