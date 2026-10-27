import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import workUpdateRoutes from './routes/workUpdateRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import managerRoutes from './routes/managerRoutes.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin emergency password reset endpoint for seeded demo users
app.post('/api/auth/reset-demo-passwords', async (req, res) => {
  try {
    const { User } = await import('./models/User.js');
    const accounts = [
      { email: 'admin@oneplanet.tech', pass: 'AdminPassword123!', role: 'Admin', name: 'Aarav Sharma (Admin)' },
      { email: 'manager@oneplanet.tech', pass: 'ManagerPassword123!', role: 'Manager', name: 'Priya Verma (Team Lead)' },
      { email: 'employee@oneplanet.tech', pass: 'EmployeePassword123!', role: 'Employee', name: 'Rohan Mehra (Developer)' },
      { email: 'intern@oneplanet.tech', pass: 'EmployeePassword123!', role: 'Employee', name: 'Ananya Roy (UI/UX Intern)' },
    ];
    const results = [];
    for (const acc of accounts) {
      let u = await User.findOne({ email: acc.email });
      if (u) {
        u.password = acc.pass;
        u.employmentStatus = 'Active';
        u.role = acc.role;
        await u.save();
        results.push({ email: acc.email, status: 'password_reset_success' });
      } else {
        results.push({ email: acc.email, status: 'user_not_found_run_seed' });
      }
    }
    res.json({ success: true, message: 'Seeded passwords reset.', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/work-updates', workUpdateRoutes);
app.use('/api/work', projectRoutes);
app.use('/api/communication', announcementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/system', settingsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', settingsRoutes);

// Centralized 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found on this server.`,
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

// Connect DB first, then listen
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[Server] One Planet Technologies Backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to initialize server:', error);
  }
};

startServer();
