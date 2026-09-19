import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: 'export { getWeekStats } from "./src/utils/stats"; export { getMonthMoodRecords } from "./src/utils/mood"; export { createWeekPlan, getRelativeWeekStart } from "./src/utils/storage"; export { startOfWeek, parseDateKey, toDateKey } from "./src/utils/date";', resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { getWeekStats, getMonthMoodRecords, createWeekPlan, getRelativeWeekStart, startOfWeek, parseDateKey, toDateKey } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const week = createWeekPlan('2026-09-14');
assert.equal(getWeekStats(week).averageRate, 0);
assert.equal(getWeekStats(week).highestIndex, -1);
week.days[1].tasks = [{ completed: true }];
assert.equal(getWeekStats(week).averageRate, 100, 'Empty days must not lower completion');
week.days[2].tasks = Array.from({ length: 9 }, () => ({ completed: false }));
assert.equal(getWeekStats(week).averageRate, 10, 'Weight by tasks, not by daily percentages');
week.days[1].tasks[0].completed = false;
assert.equal(getWeekStats(week).highestIndex, 1, 'Highest day must have tasks');
const records = {
  '2025-09-01': { mood: 3 }, '2026-08-31': { mood: 5 },
  '2026-09-01': { mood: 3 }, '2026-09-30': { mood: 4 }, '2026-10-01': { mood: 2 },
};
assert.deepEqual(getMonthMoodRecords(records, '2026-09-15').map(r => r.mood), [3, 4]);
assert.equal(getMonthMoodRecords(records, '2026-02-01').length, 0);
assert.deepEqual(getMonthMoodRecords({ '2024-02-29': { mood: 5 }, '2024-03-01': { mood: 3 } }, '2024-02-01'), [{ mood: 5 }]);
assert.equal(toDateKey(startOfWeek(parseDateKey('2027-01-01'))), '2026-12-28');
assert.equal(getRelativeWeekStart('2026-12-28', 1), '2027-01-04');
assert.equal(getRelativeWeekStart('2027-01-04', -1), '2026-12-28');
console.log('PASS: completion weighting, empty weeks, planned-day ties, month/year boundaries, leap day, week navigation');
