import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Team } from '../models/Team.js';
import { LeaveType } from '../models/LeaveType.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { Holiday } from '../models/Holiday.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Attendance } from '../models/Attendance.js';
import { DailyWorkUpdate } from '../models/DailyWorkUpdate.js';
import { Announcement } from '../models/Announcement.js';

dotenv.config();

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/one_planet_crm';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB database: one_planet_crm');

    // 1. Initialize System Settings
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({
        companyName: 'One Planet Technologies',
        companyTimezone: 'Asia/Kolkata',
        officeStartTime: '09:30',
        officeEndTime: '18:30',
        gracePeriodMinutes: 15,
        weeklyOffs: ['Saturday', 'Sunday'],
        dailyWorkUpdateDeadline: '20:00',
      });
      console.log('[Seed] System settings initialized.');
    }

    // 2. Initialize Standard Leave Types
    const leaveTypes = [
      { name: 'Casual Leave', code: 'CL', defaultDaysPerYear: 12, isPaid: true, description: 'Casual leave for personal affairs' },
      { name: 'Sick Leave', code: 'SL', defaultDaysPerYear: 10, isPaid: true, description: 'Leave due to illness or medical needs' },
      { name: 'Earned Leave', code: 'EL', defaultDaysPerYear: 15, isPaid: true, description: 'Annual privileged earned leaves' },
      { name: 'Compensatory Off', code: 'COMP', defaultDaysPerYear: 5, isPaid: true, description: 'Compensatory off for weekend or holiday shifts' },
    ];

    for (const lt of leaveTypes) {
      await LeaveType.findOneAndUpdate({ code: lt.code }, lt, { upsert: true });
    }
    console.log('[Seed] Leave categories verified/created.');

    // 3. Initialize Departments
    const engineeringDept = await Department.findOneAndUpdate(
      { code: 'ENG' },
      { name: 'Engineering & Technology', code: 'ENG', description: 'Core software engineering & dev team' },
      { upsert: true, new: true }
    );

    const designDept = await Department.findOneAndUpdate(
      { code: 'DES' },
      { name: 'UI/UX Design', code: 'DES', description: 'Product & brand design team' },
      { upsert: true, new: true }
    );

    const hrDept = await Department.findOneAndUpdate(
      { code: 'HR' },
      { name: 'Human Resources', code: 'HR', description: 'People operations and talent acquisition' },
      { upsert: true, new: true }
    );

    // 4. Create or Reset Initial Admin, Manager, and Employee Accounts
    // Admin
    let admin = await User.findOne({ email: 'admin@oneplanet.tech' });
    if (!admin) {
      admin = await User.create({
        employeeId: 'OPT-1001',
        fullName: 'Aarav Sharma (Admin)',
        email: 'admin@oneplanet.tech',
        password: 'AdminPassword123!',
        role: 'Admin',
        department: engineeringDept._id,
        designation: 'Director of Technology',
        employmentType: 'Full-Time',
        employmentStatus: 'Active',
        phone: '+91 98765 43210',
        dateOfBirth: new Date('1990-05-14'),
        joiningDate: new Date('2021-01-10'),
        address: 'One Planet Tech Park, Cyber City, Gurugram',
      });
      console.log('[Seed] Admin account created: admin@oneplanet.tech / AdminPassword123!');
    } else {
      admin.password = 'AdminPassword123!';
      admin.employmentStatus = 'Active';
      admin.role = 'Admin';
      await admin.save();
      console.log('[Seed] Admin account password reset to: AdminPassword123!');
    }

    // Manager
    let manager = await User.findOne({ email: 'manager@oneplanet.tech' });
    if (!manager) {
      manager = await User.create({
        employeeId: 'OPT-1002',
        fullName: 'Priya Verma (Team Lead)',
        email: 'manager@oneplanet.tech',
        password: 'ManagerPassword123!',
        role: 'Manager',
        department: engineeringDept._id,
        designation: 'Engineering Lead',
        reportingManager: admin._id,
        employmentType: 'Full-Time',
        employmentStatus: 'Active',
        phone: '+91 98765 43211',
        dateOfBirth: new Date('1994-08-22'),
        joiningDate: new Date('2022-03-15'),
        address: 'Sector 45, Gurugram',
      });
      console.log('[Seed] Manager account created: manager@oneplanet.tech / ManagerPassword123!');
    } else {
      manager.password = 'ManagerPassword123!';
      manager.employmentStatus = 'Active';
      await manager.save();
      console.log('[Seed] Manager account password reset to: ManagerPassword123!');
    }

    // Employee 1
    let employee = await User.findOne({ email: 'employee@oneplanet.tech' });
    if (!employee) {
      employee = await User.create({
        employeeId: 'OPT-1003',
        fullName: 'Rohan Mehra (Developer)',
        email: 'employee@oneplanet.tech',
        password: 'EmployeePassword123!',
        role: 'Employee',
        department: engineeringDept._id,
        designation: 'Full-Stack Developer',
        reportingManager: manager._id,
        employmentType: 'Full-Time',
        employmentStatus: 'Active',
        phone: '+91 98765 43212',
        dateOfBirth: new Date('1998-11-04'),
        joiningDate: new Date('2023-06-01'),
        address: 'DLF Phase 3, Gurugram',
      });
      console.log('[Seed] Employee account created: employee@oneplanet.tech / EmployeePassword123!');
    } else {
      employee.password = 'EmployeePassword123!';
      employee.employmentStatus = 'Active';
      await employee.save();
      console.log('[Seed] Employee account password reset to: EmployeePassword123!');
    }

    // Employee 2 (Intern)
    let intern = await User.findOne({ email: 'intern@oneplanet.tech' });
    if (!intern) {
      intern = await User.create({
        employeeId: 'OPT-1004',
        fullName: 'Ananya Roy (UI/UX Intern)',
        email: 'intern@oneplanet.tech',
        password: 'EmployeePassword123!',
        role: 'Employee',
        department: designDept._id,
        designation: 'UI/UX Design Intern',
        reportingManager: manager._id,
        employmentType: 'Intern',
        employmentStatus: 'Active',
        phone: '+91 98765 43213',
        dateOfBirth: new Date('2001-02-18'),
        joiningDate: new Date('2024-01-15'),
        address: 'Sushant Lok, Gurugram',
      });
      console.log('[Seed] Intern account created: intern@oneplanet.tech / EmployeePassword123!');
    } else {
      intern.password = 'EmployeePassword123!';
      intern.employmentStatus = 'Active';
      await intern.save();
      console.log('[Seed] Intern account password reset to: EmployeePassword123!');
    }

    // 5. Initialize Teams
    let devTeam = await Team.findOne({ name: 'Alpha Core Developers' });
    if (!devTeam) {
      devTeam = await Team.create({
        name: 'Alpha Core Developers',
        department: engineeringDept._id,
        leader: manager._id,
        members: [employee._id, intern._id],
        description: 'Core web and cloud application team for internal solutions',
      });
      console.log('[Seed] Development team created.');
    }

    // 6. Initialize Leave Balances for all users
    const allUsers = [admin, manager, employee, intern];
    const currentYear = new Date().getFullYear();
    const allLeaveTypes = await LeaveType.find({ status: 'Active' });

    for (const u of allUsers) {
      for (const lt of allLeaveTypes) {
        await LeaveBalance.findOneAndUpdate(
          { user: u._id, leaveType: lt._id, year: currentYear },
          { allocated: lt.defaultDaysPerYear, used: 0 },
          { upsert: true }
        );
      }
    }
    console.log('[Seed] Leave balances initialized for team.');

    // 7. Seed Sample Holidays
    const holidays = [
      { name: "New Year's Day", date: new Date(`${currentYear}-01-01`), type: 'National', description: 'First day of the calendar year' },
      { name: 'Republic Day', date: new Date(`${currentYear}-01-26`), type: 'National', description: 'Celebration of the Constitution' },
      { name: 'Holi', date: new Date(`${currentYear}-03-14`), type: 'Festival', description: 'Festival of colors and spring' },
      { name: 'Independence Day', date: new Date(`${currentYear}-08-15`), type: 'National', description: 'National Independence Day' },
      { name: 'Diwali', date: new Date(`${currentYear}-10-20`), type: 'Festival', description: 'Festival of Lights' },
      { name: 'Christmas', date: new Date(`${currentYear}-12-25`), type: 'Festival', description: 'Christmas Day' },
    ];
    for (const h of holidays) {
      await Holiday.findOneAndUpdate({ name: h.name, date: h.date }, h, { upsert: true });
    }
    console.log('[Seed] Official holidays seeded.');

    // 8. Seed Projects & Tasks
    let project = await Project.findOne({ name: 'Enterprise Employee CRM 2.0' });
    if (!project) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      project = await Project.create({
        name: 'Enterprise Employee CRM 2.0',
        clientName: 'One Planet Technologies Internal',
        description: 'Next-generation internal employee management, attendance & leaves portal',
        deadline,
        priority: 'High',
        department: engineeringDept._id,
        assignedTeam: devTeam._id,
        members: [employee._id, intern._id, manager._id],
        createdBy: admin._id,
      });

      // Tasks
      const taskDeadline = new Date();
      taskDeadline.setDate(taskDeadline.getDate() + 5);
      await Task.create({
        title: 'Build Responsive Sidebar & Role Layouts',
        description: 'Create modern collapsible dark navy sidebar with top nav for all roles.',
        project: project._id,
        assignedTo: employee._id,
        deadline: taskDeadline,
        priority: 'High',
        status: 'In Progress',
        progressNotes: 'Layout scaffolding completed, finalizing badges and responsive toggler.',
        createdBy: manager._id,
      });

      await Task.create({
        title: 'Design UI Badges and Calendar Visuals',
        description: 'Style company events, attendance badges, and holiday calendar cards.',
        project: project._id,
        assignedTo: intern._id,
        deadline: taskDeadline,
        priority: 'Medium',
        status: 'Not Started',
        createdBy: manager._id,
      });
      console.log('[Seed] Sample Project and Tasks created.');
    }

    // 9. Seed Today's Attendance for manager and employee
    const todayStr = new Date().toISOString().split('T')[0];
    const checkInTime = new Date();
    checkInTime.setHours(9, 25, 0); // 9:25 AM (on-time)

    await Attendance.findOneAndUpdate(
      { user: employee._id, date: todayStr },
      {
        user: employee._id,
        date: todayStr,
        checkIn: checkInTime,
        status: 'Present',
        isLate: false,
        lateMinutes: 0,
      },
      { upsert: true }
    );

    // 10. Seed Announcement
    await Announcement.findOneAndUpdate(
      { title: 'Welcome to One Planet Technologies CRM' },
      {
        title: 'Welcome to One Planet Technologies CRM',
        description: 'We are thrilled to launch the new centralized CRM for employee records, attendance, tasks, and company announcements. Explore the features!',
        priority: 'Urgent',
        targetAudience: 'All',
        createdBy: admin._id,
      },
      { upsert: true }
    );
    console.log('[Seed] Announcement created.');

    console.log('\n======================================================');
    console.log('✅ DATABASE INITIALIZATION & SEEDING COMPLETED!');
    console.log('Database Name: one_planet_crm (MongoDB Compass ready)');
    console.log('Available Accounts:');
    console.log('1. Admin:    admin@oneplanet.tech    | Pass: AdminPassword123!');
    console.log('2. Manager:  manager@oneplanet.tech  | Pass: ManagerPassword123!');
    console.log('3. Employee: employee@oneplanet.tech | Pass: EmployeePassword123!');
    console.log('4. Intern:   intern@oneplanet.tech   | Pass: EmployeePassword123!');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  }
};

seedData();
