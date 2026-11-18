import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { Employees } from './pages/Employees';
import { ManagersPage } from './pages/ManagersPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavesPage } from './pages/LeavesPage';
import { WorkUpdatesPage } from './pages/WorkUpdatesPage';
import { ProjectsTasksPage } from './pages/ProjectsTasksPage';
import { CalendarPage } from './pages/CalendarPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { PolicyViewAcknowledgePage } from './pages/PolicyViewAcknowledgePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

// Protected Route Guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center vh-100 text-center p-4">
        <h2 className="fw-bold text-danger">Access Denied (403)</h2>
        <p className="text-muted">You do not possess permissions to view this resource.</p>
        <button
          onClick={() => window.history.back()}
          className="btn btn-outline-primary"
        >
          Return to Previous Page
        </button>
      </div>
    );
  }

  return children;
};

// Role-based Root Redirector
const DashboardRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'Manager') return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Root Redirect */}
          <Route path="/" element={<DashboardRedirect />} />

          {/* Dashboards */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/dashboard"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          {/* Employee Directory */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Employees />
              </ProtectedRoute>
            }
          />

          {/* Manager Management */}
          <Route
            path="/managers"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <ManagersPage />
              </ProtectedRoute>
            }
          />

          {/* Attendance */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/all"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/my"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          {/* Leaves */}
          <Route
            path="/leaves"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <LeavesPage />
              </ProtectedRoute>
            }
          />

          {/* Work Updates */}
          <Route
            path="/work-updates"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <WorkUpdatesPage />
              </ProtectedRoute>
            }
          />

          {/* Projects & Tasks */}
          <Route
            path="/projects"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <ProjectsTasksPage />
              </ProtectedRoute>
            }
          />

          {/* Calendar & Holidays */}
          <Route
            path="/calendar"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <CalendarPage />
              </ProtectedRoute>
            }
          />

          {/* Company Policies */}
          <Route
            path="/policies"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <PoliciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/policies/:id"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <PolicyViewAcknowledgePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/policies/:id/acknowledge"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <PolicyViewAcknowledgePage />
              </ProtectedRoute>
            }
          />

          {/* Announcements */}
          <Route
            path="/announcements"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Employee']}>
                <AnnouncementsPage />
              </ProtectedRoute>
            }
          />

          {/* Reports & Exports */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Settings & Audit */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
};

export default App;
