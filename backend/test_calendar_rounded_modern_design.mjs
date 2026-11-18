import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:\\Users\\LENOVO\\Desktop\\one-planet-crm\\one-planet-crm';

describe('Company Calendar Circular Date Cells & Modern Design Suite', () => {
  const componentPath = path.join(projectRoot, 'frontend', 'src', 'components', 'DashboardCalendar.jsx');
  const content = fs.readFileSync(componentPath, 'utf8');

  it('1. Date cells are perfect circles with equal width & height (34x34) and border-radius 50%', () => {
    // Check preceding padding cells
    assert.ok(content.includes("key={`prev-${idx}`}"), 'Must have prev month padding cells');
    assert.ok(content.includes("borderRadius: '50%'"), 'Date cells must use 50% border radius for perfect circles');

    // Check active month date cells
    assert.ok(content.includes("key={`day-${dayNum}`}"), 'Must have active month cells');
    assert.ok(content.includes("width: 34"), 'Active cells must have equal width 34');
    assert.ok(content.includes("height: 34"), 'Active cells must have equal height 34');
    assert.ok(content.includes("minWidth: 34"), 'Active cells must enforce minWidth 34');
    assert.ok(content.includes("minHeight: 34"), 'Active cells must enforce minHeight 34');
    assert.ok(content.includes("overflow: 'hidden'"), 'Active cells must have overflow hidden to clip half-day gradient');

    // Check trailing padding cells
    assert.ok(content.includes("key={`next-${idx}`}"), 'Must have next month padding cells');
  });

  it('2. Date numbers are centered and grid maintains symmetrical 7 columns', () => {
    assert.ok(
      content.includes('className="text-center d-flex flex-column align-items-center justify-content-center"'),
      'Must center cell contents horizontally and vertically'
    );
    assert.ok(content.includes('lineHeight: 1'), 'Date numbers must have centered line height');
    assert.ok(content.includes("justifyItems: 'center'"), 'Grid must center-align columns symmetrically');
    assert.ok(content.includes('gridTemplateColumns: \'repeat(7, minmax(0, 1fr))\''), 'Maintains 7 equal columns');
  });

  it('3. Status styling and colors are completely preserved', () => {
    // Present Green
    assert.ok(content.includes("bg: '#DCFCE7'"), 'Preserves Present light green background');
    assert.ok(content.includes("color: '#15803D'"), 'Preserves Present dark green text');

    // Late Arrival Orange
    assert.ok(content.includes("bg: '#FFEDD5'"), 'Preserves Late light orange background');
    assert.ok(content.includes("color: '#C2410C'"), 'Preserves Late dark orange text');

    // Absent Red
    assert.ok(content.includes("bg: '#FEE2E2'"), 'Preserves Absent light red background');
    assert.ok(content.includes("color: '#DC2626'"), 'Preserves Absent dark red text');

    // Public Holiday Blue
    assert.ok(content.includes("bg: '#DBEAFE'"), 'Preserves Public Holiday blue background');
    assert.ok(content.includes("color: '#1D4ED8'"), 'Preserves Public Holiday blue text');

    // Half Day Split
    assert.ok(content.includes('#15803D'), 'Preserves Half Day darker green');
    assert.ok(content.includes('#B91C1C'), 'Preserves Half Day darker red');
    assert.ok(content.includes('linear-gradient(135deg, #15803D'), 'Preserves Half Day split gradient');

    // Weekly Off Grey
    assert.ok(content.includes("bg: '#F1F5F9'"), 'Preserves Weekend grey background');
    assert.ok(content.includes("color: '#64748B'"), 'Preserves Weekend muted text');

    // Selected Date Highlight
    assert.ok(content.includes("outline: isSelected ? '2px solid #2563EB'"), 'Preserves selected day blue outline');
  });

  it('4. Previous, Next and Today navigation buttons are rounded', () => {
    assert.ok(content.includes("style={{ width: 28, height: 28, borderRadius: '50%' }}"), 'Prev and Next buttons must have circular rounded shape');
    assert.ok(content.includes("borderRadius: '20px'"), 'Today button must have rounded pill shape');
    assert.ok(content.includes('rounded-pill'), 'Today button has rounded-pill class');
  });

  it('5. Outer calendar card has smoothly rounded corners (14px)', () => {
    assert.ok(content.includes("borderRadius: '14px'"), 'Outer card has 14px rounded corners');
    assert.ok(content.includes("borderTopLeftRadius: '14px'"), 'Card header aligns with 14px top corners');
    assert.ok(content.includes("overflow-hidden"), 'Card has overflow-hidden to clip header cleanly');
  });

  it('6. Holiday information row and badges have rounded styling', () => {
    // Holiday row item
    assert.ok(content.includes("borderRadius: '10px'"), 'Holiday row item has 10px rounded corners');

    // Holiday count badge is pill shaped
    assert.ok(content.includes("style={{ fontSize: '0.68rem', borderRadius: '9999px' }}"), 'Holiday count badge has pill radius');
    assert.ok(content.includes('badge rounded-pill'), 'Holiday count badge has rounded-pill class');
  });

  it('7. Legend indicators are visually consistent rounded squares (4px)', () => {
    const legendStartIndex = content.indexOf('{/* 3. CALENDAR LEGEND BAR */}');
    const legendEndIndex = content.indexOf('{/* 4. MONTH\'S SCHEDULED HOLIDAYS LIST */}');
    const legendBlock = content.substring(legendStartIndex, legendEndIndex);

    assert.ok(legendBlock.includes("borderRadius: '4px'"), 'Legend color indicators must have 4px rounded corners');
  });

  it('8. Preserves calendar navigation, attendance and selection functionality', () => {
    assert.ok(content.includes('handlePrevMonth'), 'Preserves handlePrevMonth');
    assert.ok(content.includes('handleNextMonth'), 'Preserves handleNextMonth');
    assert.ok(content.includes('handleJumpToToday'), 'Preserves handleJumpToToday');
    assert.ok(content.includes('setSelectedDate'), 'Preserves setSelectedDate');
    assert.ok(content.includes('fetchCalendarDataset'), 'Preserves fetchCalendarDataset');
  });
});

