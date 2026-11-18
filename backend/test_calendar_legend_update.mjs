import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Company Calendar Legend Update Suite', () => {
  const componentPath = path.join(projectRoot, 'frontend', 'src', 'components', 'DashboardCalendar.jsx');
  const content = fs.readFileSync(componentPath, 'utf8');

  // Extract the legend bar JSX block
  const legendStartIndex = content.indexOf('{/* 3. CALENDAR LEGEND BAR */}');
  const legendEndIndex = content.indexOf('{/* 4. MONTH\'S SCHEDULED HOLIDAYS LIST */}');
  const legendBlock = content.substring(legendStartIndex, legendEndIndex);

  it('1. Removes "Half Day" from the calendar legend', () => {
    assert.ok(!legendBlock.includes('Half Day'), 'Legend bar must NOT contain "Half Day" item');
  });

  it('2. Removes "Weekly Off" from the calendar legend', () => {
    assert.ok(!legendBlock.includes('Weekly Off'), 'Legend bar must NOT contain "Weekly Off" item');
  });

  it('3. Removes "Selected" from the calendar legend', () => {
    assert.ok(!legendBlock.includes('Selected</span>'), 'Legend bar must NOT contain "Selected" label');
    assert.ok(!legendBlock.includes('Selected Date'), 'Legend bar must NOT contain Selected Date comment/item');
  });

  it('4. Replaces "Company Holiday" with "Public Holiday" in the calendar legend', () => {
    assert.ok(legendBlock.includes('Public Holiday'), 'Legend bar must contain "Public Holiday"');
    assert.ok(!legendBlock.includes('Company Holiday'), 'Legend bar must NOT contain "Company Holiday"');
    assert.ok(legendBlock.includes('CALENDAR_COLORS.companyHoliday.bg'), 'Public Holiday must use blue background indicator');
    assert.ok(legendBlock.includes('CALENDAR_COLORS.companyHoliday.color'), 'Public Holiday must use blue text color');
  });

  it('5. Contains exactly the remaining expected legend items: Present, Late Arrival, Absent, Public Holiday', () => {
    assert.ok(legendBlock.includes('Present'), 'Legend must include Present');
    assert.ok(legendBlock.includes('Late Arrival'), 'Legend must include Late Arrival');
    assert.ok(legendBlock.includes('Absent'), 'Legend must include Absent');
    assert.ok(legendBlock.includes('Public Holiday'), 'Legend must include Public Holiday');

    // Verify spacing classes
    assert.ok(legendBlock.includes('d-flex flex-wrap align-items-center justify-content-center'), 'Must have responsive flex wrapper');
  });

  it('6. Preserves Half Day cell styling with dark green (#15803D) and dark red (#B91C1C) split', () => {
    // Check CALENDAR_COLORS.halfDay
    assert.ok(content.includes('#15803D'), 'Must preserve darker green #15803D for Present half');
    assert.ok(content.includes('#B91C1C'), 'Must preserve darker red #B91C1C for Absent half');
    assert.ok(content.includes('linear-gradient(135deg, #15803D'), 'Must preserve diagonal gradient split');

    // Check classifySingleDay / isHalfDay logic
    assert.ok(content.includes("record?.status === 'Half Day'"), 'Must preserve Half Day attendance status check');
    assert.ok(content.includes('leave.isHalfDay'), 'Must preserve Half Day approved leave check');
    assert.ok(content.includes("type: 'halfDay'"), 'Must return type halfDay for calendar rendering');
  });

  it('7. Preserves Weekend Saturday/Sunday weekly-off styling and business rule', () => {
    assert.ok(content.includes('dayOfWeek === 0 || dayOfWeek === 6'), 'Must detect weekends (Sun=0, Sat=6)');
    assert.ok(content.includes('CALENDAR_COLORS.weekend.bg'), 'Must use weekend background color');
    assert.ok(content.includes('CALENDAR_COLORS.weekend.color'), 'Must use weekend text color');
    assert.ok(content.includes("badgeText: 'Weekly Off'"), 'Must set Weekly Off badge for weekend cells');
  });

  it('8. Preserves selected date highlighting and click handler', () => {
    assert.ok(content.includes('d === selectedDate.getDate()'), 'Must compute isSelected');
    assert.ok(content.includes("outline: isSelected ? '2px solid #2563EB'"), 'Must highlight selected day with blue outline');
    assert.ok(content.includes('setSelectedDate(new Date(currentYear, currentMonth, dayNum))'), 'Must update selected date on click');
  });

  it('9. Preserves month navigation (prev, next, today)', () => {
    assert.ok(content.includes('handlePrevMonth'), 'Must have handlePrevMonth navigation');
    assert.ok(content.includes('handleNextMonth'), 'Must have handleNextMonth navigation');
    assert.ok(content.includes('handleJumpToToday'), 'Must have handleJumpToToday jump button');
    assert.ok(content.includes('MONTH_NAMES[currentMonth]'), 'Must render current month name');
  });

  it('10. Preserves public holiday list below the calendar grid', () => {
    assert.ok(content.includes("Holidays in {MONTH_NAMES[currentMonth]}"), 'Must display monthly holidays list section');
    assert.ok(content.includes('monthHolidays.map'), 'Must map over holidays for the active month');
  });
});
