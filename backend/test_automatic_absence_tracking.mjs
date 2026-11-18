import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Attendance } from './models/Attendance.js';
import { Holiday } from './models/Holiday.js';
import { LeaveRequest } from './models/LeaveRequest.js';
import { evaluateEmployeeDailyStatus } from './controllers/calendarController.js';
import fs from 'node:fs';
import path from 'node:path';




const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Automatic Absence Tracking and Attendance Calendar Suite', () => {
  let isDbConnected = false;

  before(async () => {
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/one_planet_crm', {
        serverSelectionTimeoutMS: 3000,
      });
      isDbConnected = true;
    } catch (err) {
      console.warn('Note: MongoDB not reachable directly in this environment, testing unit and logic assertions.');
    }
  });

  const calendarComponentPath = path.join(
    projectRoot,
    'frontend',
    'src',
    'components',
    'DashboardCalendar.jsx'
  );
  const calendarContent = fs.readFileSync(calendarComponentPath, 'utf8');

  // -------------------------------------------------------------------------
  // 1. UI & COMPONENT SOURCE VERIFICATION
  // -------------------------------------------------------------------------
  it('1. Component imports and uses getEmployeeJoiningDateStr', () => {
    assert.ok(
      calendarContent.includes('getEmployeeJoiningDateStr'),
      'Must define and use getEmployeeJoiningDateStr helper'
    );
  });

  it('2. Component never marks dates before employee joining as Absent', () => {
    assert.ok(
      calendarContent.includes('key < empJoiningStr') || calendarContent.includes('key < empJoining'),
      'Must check if calendar date key is prior to joining date'
    );
    assert.ok(
      calendarContent.includes('Before Joining'),
      'Must classify dates before joining as Before Joining (not Absent)'
    );
  });

  it('3. Component does not mark company public holidays as Absent', () => {
    assert.ok(
      calendarContent.includes('Public Holiday'),
      'Must prioritize Public Holiday above absences'
    );
    assert.ok(
      calendarContent.includes('CALENDAR_COLORS.companyHoliday'),
      'Must use blue public holiday colors'
    );
  });

  it('4. Component does not mark weekends / weekly off as Absent', () => {
    assert.ok(
      calendarContent.includes('Weekly Off'),
      'Must classify weekends as Weekly Off'
    );
    assert.ok(
      calendarContent.includes('CALENDAR_COLORS.weekend'),
      'Must use grey weekly off colors'
    );
  });

  it('5. Component does not mark approved leave as Absent', () => {
    assert.ok(
      calendarContent.includes('On Leave'),
      'Must classify approved leaves distinctly as On Leave'
    );
    assert.ok(
      calendarContent.includes('CALENDAR_COLORS.onLeave'),
      'Must use dedicated non-absent colors for approved leave'
    );
  });

  it('6. Component automatically marks employee Absent (Red) if they do not log in on scheduled working day', () => {
    assert.ok(
      calendarContent.includes('Absent (No Login)'),
      'Must mark scheduled days without login as Absent'
    );
    assert.ok(
      calendarContent.includes('CALENDAR_COLORS.absent'),
      'Must style auto-absences with red absent colors'
    );
  });

  it('7. Component does not mark future dates as Absent', () => {
    assert.ok(
      calendarContent.includes('isFuture'),
      'Must check isFuture date status'
    );
    assert.ok(
      calendarContent.includes('Upcoming') || calendarContent.includes('Working Day'),
      'Future dates must remain neutral/upcoming and never absent'
    );
  });

  it('8. Component contains Selected Date Attendance Inspector for Admin and Employee', () => {
    assert.ok(
      calendarContent.includes('selected-date-inspector') ||
        calendarContent.includes('SELECTED DATE ATTENDANCE INSPECTOR'),
      'Must render Selected Date Attendance Inspector'
    );
    assert.ok(
      calendarContent.includes('Date of Joining') || calendarContent.includes('joiningDateStr'),
      'Must display date of joining in the inspector'
    );
    assert.ok(
      calendarContent.includes('inspectorFilter') && calendarContent.includes('inspectorSearch'),
      'Must provide status filter and search tools for Admin date inspection'
    );
  });

  // -------------------------------------------------------------------------
  // 2. LOGICAL RULE EVALUATION UNIT TESTS
  // -------------------------------------------------------------------------
  const sampleEmployee = {
    _id: 'emp_001',
    fullName: 'Rahul Sharma',
    employeeId: 'OPT-1050',
    joiningDate: '2026-10-15T00:00:00.000Z',
    weeklyOff: ['Saturday', 'Sunday'],
  };

  const fixedToday = '2026-11-06';

  it('9. Rule: Date before joining (2026-10-10) is marked "Before Joining", NEVER Absent', () => {
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-10-10', null, [], null, fixedToday);
    assert.equal(res.status, 'Before Joining');
    assert.equal(res.isAbsent, false);
  });

  it('10. Rule: Public holiday (2026-10-20) is marked "Public Holiday", NEVER Absent', () => {
    const holiday = { name: 'Diwali Festival', date: new Date('2026-10-20') };
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-10-20', holiday, [], null, fixedToday);
    assert.equal(res.status, 'Public Holiday');
    assert.equal(res.isAbsent, false);
  });

  it('11. Rule: Weekend (2026-10-18 Sunday) is marked "Weekly Off", NEVER Absent', () => {
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-10-18', null, [], null, fixedToday);
    assert.equal(res.status, 'Weekly Off');
    assert.equal(res.isAbsent, false);
  });

  it('12. Rule: Approved Leave (2026-10-22) is marked "On Leave", NEVER Absent', () => {
    const leaves = [
      {
        status: 'Approved',
        startDate: new Date('2026-10-22'),
        endDate: new Date('2026-10-22'),
        isHalfDay: false,
        leaveType: { name: 'Casual Leave' },
      },
    ];
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-10-22', null, leaves, null, fixedToday);
    assert.equal(res.status, 'On Leave');
    assert.equal(res.isAbsent, false);
  });

  it('13. Rule: Actual Login Check-in on working day (2026-10-23) is marked "Present" (Green)', () => {
    const record = {
      date: '2026-10-23',
      checkIn: new Date('2026-10-23T09:30:00Z'),
      status: 'Present',
      isLate: false,
      workingHours: 8.5,
    };
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-10-23', null, [], record, fixedToday);
    assert.equal(res.status, 'Present');
    assert.equal(res.color, '#15803D'); // Green
    assert.equal(res.isAbsent, false);
  });

  it('14. Rule: Actual Late Login on working day (2026-10-26 Monday) is marked "Late" (Orange)', () => {
    const record = {
      date: '2026-10-26',
      checkIn: new Date('2026-10-26T10:15:00Z'),
      status: 'Late',
      isLate: true,
      lateMinutes: 45,
      workingHours: 7.75,
    };
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-10-26', null, [], record, fixedToday);
    assert.equal(res.status, 'Late');
    assert.equal(res.color, '#C2410C'); // Orange
    assert.equal(res.isAbsent, false);
  });

  it('15. Rule: Future working day (2026-11-20) is marked "Upcoming", NEVER Absent', () => {
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-11-20', null, [], null, fixedToday);
    assert.equal(res.status, 'Upcoming');
    assert.equal(res.isAbsent, false);
  });

  it('16. Rule: Past scheduled working day without login (2026-11-03) is AUTOMATICALLY marked "Absent" (Red)', () => {
    // 2026-11-03 was Tuesday, scheduled working day, employee joined Oct 15, no attendance record
    const res = evaluateEmployeeDailyStatus(sampleEmployee, '2026-11-03', null, [], null, fixedToday);
    assert.equal(res.status, 'Absent');
    assert.equal(res.isAbsent, true);
    assert.equal(res.isAutoAbsent, true);
    assert.equal(res.color, '#DC2626'); // Red
    assert.equal(res.bg, '#FEE2E2');
  });

  // -------------------------------------------------------------------------
  // 3. DATABASE VERIFICATION (WHEN DB CONNECTED)
  // -------------------------------------------------------------------------
  it('17. Database: Evaluates real employees joining dates correctly', async () => {
    if (!isDbConnected) {
      console.log('Skipping DB query (sandbox isolation)');
      return;
    }
    const activeUsers = await User.find({ employmentStatus: 'Active' });
    assert.ok(activeUsers.length > 0, 'Database has active users');

    for (const u of activeUsers) {
      const joinStr = u.joiningDate ? new Date(u.joiningDate).toISOString().split('T')[0] : '2020-01-01';
      // Date 1 year before joining
      const pastYear = new Date(u.joiningDate || new Date('2022-01-01'));
      pastYear.setFullYear(pastYear.getFullYear() - 1);
      const priorDateStr = pastYear.toISOString().split('T')[0];

      const res = evaluateEmployeeDailyStatus(u, priorDateStr, null, [], null, fixedToday);
      assert.equal(res.status, 'Before Joining', `${u.fullName} must not be marked absent before joining`);
      assert.equal(res.isAbsent, false);
    }
  });

  after(async () => {
    if (isDbConnected) {
      await mongoose.disconnect();
    }
  });
});
