import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiMail,
  FiLock,
  FiArrowRight,
  FiShield,
  FiCheckSquare,
  FiEye,
  FiEyeOff,
  FiUserCheck,
} from 'react-icons/fi';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning('Please enter both corporate email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success) {
        toast.success(`Welcome back, ${res.data.user.fullName}!`);
        login(res.data.token, res.data.user);

        // Role-based directional routing
        if (res.data.user.role === 'Admin') {
          navigate('/admin/dashboard');
        } else if (res.data.user.role === 'Manager') {
          navigate('/manager/dashboard');
        } else {
          navigate('/employee/dashboard');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = (demoRole) => {
    if (demoRole === 'Admin') {
      setEmail('admin@oneplanet.tech');
      setPassword('AdminPassword123!');
      toast.info('Admin demo credentials populated.');
    } else if (demoRole === 'Manager') {
      setEmail('manager@oneplanet.tech');
      setPassword('ManagerPassword123!');
      toast.info('Manager demo credentials populated.');
    } else if (demoRole === 'Employee') {
      setEmail('employee@oneplanet.tech');
      setPassword('EmployeePassword123!');
      toast.info('Employee demo credentials populated.');
    }
  };

  return (
    <div className="login-split-page">
      {/* 1. Left Branding & Value Proposition Panel */}
      <div className="login-brand-panel">
        {/* Subtle CSS glowing background shapes (No images) */}
        <div className="login-brand-orb-1" aria-hidden="true" />
        <div className="login-brand-orb-2" aria-hidden="true" />
        <div className="login-brand-grid" aria-hidden="true" />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Company Brand Logo & Name */}
          <div className="d-flex align-items-center gap-3 mb-5">
            <div className="login-brand-logo">
              OP
            </div>
            <div>
              <h3 className="m-0 fw-bold tracking-tight text-white" style={{ letterSpacing: '0.5px' }}>
                ONE PLANET
              </h3>
              <div
                className="small fw-semibold text-uppercase"
                style={{ letterSpacing: '1.5px', color: 'var(--opt-mint)', fontSize: '0.78rem' }}
              >
                Technologies CRM
              </div>
            </div>
          </div>

          {/* Heading & Short Description */}
          <div className="mb-5" style={{ maxWidth: 480 }}>
            <h1
              className="fw-bold mb-3 text-white"
              style={{ fontSize: '2.25rem', lineHeight: 1.2, letterSpacing: '-0.5px' }}
            >
              Enterprise Workforce Management Portal
            </h1>
            <p
              className="leading-relaxed mb-0"
              style={{ fontSize: '1.05rem', color: '#DDF3D9', opacity: 0.9, lineHeight: 1.6 }}
            >
              A unified internal platform designed for real-time attendance tracking, automated leave workflows,
              transparent project coordination, and auditable corporate administration.
            </p>
          </div>

          {/* Two Distinct Feature Cards */}
          <div className="d-flex flex-column gap-3" style={{ maxWidth: 440 }}>
            <div className="login-feature-card">
              <div className="login-feature-icon">
                <FiShield size={22} />
              </div>
              <div>
                <h6 className="m-0 fw-semibold text-white" style={{ fontSize: '0.98rem' }}>
                  Role-Based Security
                </h6>
                <p className="m-0 small" style={{ color: '#DDF3D9', opacity: 0.82, lineHeight: 1.4 }}>
                  Granular authorization tiers for Admins, Managers, and Employees with complete audit logging.
                </p>
              </div>
            </div>

            <div className="login-feature-card">
              <div className="login-feature-icon">
                <FiCheckSquare size={22} />
              </div>
              <div>
                <h6 className="m-0 fw-semibold text-white" style={{ fontSize: '0.98rem' }}>
                  Active Task & Work Logs
                </h6>
                <p className="m-0 small" style={{ color: '#DDF3D9', opacity: 0.82, lineHeight: 1.4 }}>
                  Verified daily check-ins, early departure detection, leave balance quotas, and work updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div
          className="mt-5 small text-white-50"
          style={{ position: 'relative', zIndex: 2, fontSize: '0.8rem' }}
        >
          © {new Date().getFullYear()} One Planet Technologies. All rights reserved. • Enterprise Portal v2.0
        </div>
      </div>

      {/* 2. Right Login Section */}
      <div className="login-form-panel">
        <div className="login-form-box">
          {/* Header Pill & Heading */}
          <div className="mb-4">
            <span className="login-header-pill">
              <FiUserCheck size={13} />
              Corporate Access
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#0B3029', letterSpacing: '-0.5px' }}>
              Welcome Back
            </h2>
            <p className="text-muted small mb-0" style={{ fontSize: '0.92rem' }}>
              Enter your corporate email address and password to sign in.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold small text-muted mb-1">Corporate Email</label>
              <div className="login-input-group">
                <span className="input-group-text">
                  <FiMail size={17} />
                </span>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@oneplanet.tech"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold small text-muted mb-1">Password</label>
              <div className="login-input-group has-toggle">
                <span className="input-group-text">
                  <FiLock size={17} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn mb-4"
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              ) : (
                <>
                  <span>Sign In to CRM</span>
                  <FiArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Sign-In Box */}
          <div className="login-demo-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold small" style={{ color: 'var(--opt-forest)', fontSize: '0.8rem' }}>
                Quick Demo Sign-in:
              </span>
              <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
                1-Click Autofill
              </span>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoFill('Admin')}
                className="login-demo-pill"
                title="Fill Admin Credentials"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('Manager')}
                className="login-demo-pill"
                title="Fill Manager Credentials"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('Employee')}
                className="login-demo-pill"
                title="Fill Employee Credentials"
              >
                Employee
              </button>
            </div>
          </div>

          {/* Security Badge */}
          <div className="text-center mt-4">
            <span className="text-muted small" style={{ fontSize: '0.74rem' }}>
              🔒 256-bit encrypted corporate session • Zero test data policy enforced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
