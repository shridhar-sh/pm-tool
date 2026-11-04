// Runs the component's actual calculation callback without a browser or packages.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/components/ProjectTimeline.jsx'), 'utf8');
const start = source.indexOf('(workflowStages, extraMarkers');
const end = source.indexOf('}, [project?.projectStartDate', start) + 1;
const iso = d => d.toISOString().slice(0, 10);
const context = {
  project: {projectStartDate: '2026-11-06'},
  workingDays: {},
  holidays: [{date: '2026-11-09', isWorking: false}],
  format: iso,
  parseISO: value => new Date(value + 'T00:00:00Z'),
  addDays: (date, count) => new Date(date.getTime() + count * 86400000),
  isWeekend: date => [0, 6].includes(date.getUTCDay()),
  findStageForExtraDay: () => 0,
  console,
};
const calculate = vm.runInNewContext('(' + source.slice(start, end) + ')', context);
const stages = [{name: 'Shoot', duration: 2}, {name: 'Edits', duration: 1}];
assert.equal(calculate(stages)[0].endDate, '2026-11-10');
assert.equal(calculate(stages, {}, {}, {'2026-11-07': true})[0].endDate, '2026-11-07');
assert.equal(calculate(stages, {}, {1: -1})[1].startDate, '2026-11-10');
assert.equal(calculate(stages, {'2026-11-06': true})[0].endDate, '2026-11-11');
assert.equal(calculate(stages, {}, {}, {})[0].endDate, '2026-11-10');
assert.equal(stages[0].extraDays, undefined, 'Calculation must not mutate input stages');
context.holidays.push({date: '2026-11-07', isWorking: true});
assert.equal(calculate(stages)[0].endDate, '2026-11-07');
console.log('Timeline calendar: 7 assertions passed');
