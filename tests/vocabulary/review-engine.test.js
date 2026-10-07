'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('../helpers/load.js');
const LF = loadAll();
const RE = LF.ReviewEngine;
const DAY = 86400000, MIN = 60000, T0 = 1_700_000_000_000;
const card = (o) => Object.assign({ known: false, reviewCount: 0, interval: 0, ease: 2.5, nextReview: T0 }, o);

test('Again: due in 10 minutes, ease drops (floor 1.3), interval resets', () => {
  const s = RE.schedule(card({ interval: 12, ease: 2.5, reviewCount: 4 }), 'again', T0);
  assert.deepEqual({ iv: s.interval, ease: s.ease, due: s.nextReview, rc: s.reviewCount }, { iv: 0, ease: 2.3, due: T0 + 10 * MIN, rc: 5 });
  assert.equal(RE.schedule(card({ ease: 1.3 }), 0, T0).ease, 1.3);
});
test('Good: new card -> 1 day; mature card -> interval × ease', () => {
  assert.equal(RE.schedule(card(), 'good', T0).interval, 1);
  const s = RE.schedule(card({ interval: 10, ease: 2.5, reviewCount: 3 }), 'good', T0);
  assert.equal(s.interval, 25); assert.equal(s.nextReview, T0 + 25 * DAY); assert.equal(s.ease, 2.5);
});
test('Hard shrinks growth and ease; Easy grows both', () => {
  const h = RE.schedule(card({ interval: 10 }), 'hard', T0), g = RE.schedule(card({ interval: 10 }), 'good', T0), e = RE.schedule(card({ interval: 10 }), 'easy', T0);
  assert.ok(h.interval < g.interval && g.interval < e.interval);
  assert.ok(h.ease < 2.5 && e.ease > 2.5);
  assert.equal(RE.schedule(card(), 'easy', T0).interval, 4);
  assert.equal(RE.schedule(card(), 'hard', T0).interval, 1);
});
test('Intervals always move forward (no zero-growth traps) and the input is never mutated', () => {
  const c = card({ interval: 1, ease: 1.3 });
  const before = JSON.stringify(c);
  for (const g of ['hard', 'good', 'easy']) assert.ok(RE.schedule(c, g, T0).interval > 1, g);
  assert.equal(JSON.stringify(c), before);
  assert.throws(() => RE.schedule(c, 'meh', T0), /Invalid review grade/);
  assert.throws(() => RE.schedule(c, 7, T0), /Invalid review grade/);
});
test('previewIntervals(): labels for the four buttons', () => {
  assert.deepEqual(RE.previewIntervals(card(), T0).map((x) => [x.grade, x.label]), [['again', '10 phút'], ['hard', '1 ngày'], ['good', '1 ngày'], ['easy', '4 ngày']]);
  assert.equal(RE.formatInterval(20 * DAY), '3 tuần'); assert.equal(RE.formatInterval(90 * DAY), '3 tháng'); assert.equal(RE.formatInterval(5 * 3600000), '5 giờ');
});
test('buildQueue(): due only, overdue first, known excluded, new cards capped', () => {
  const items = [card({ id: 'a', nextReview: T0 - 2 * DAY, reviewCount: 2 }), card({ id: 'b', nextReview: T0 + DAY, reviewCount: 2 }), card({ id: 'c', known: true, nextReview: T0 - DAY, reviewCount: 2 }),
    card({ id: 'd', nextReview: T0 - 5 * DAY, reviewCount: 3 }), card({ id: 'n1', nextReview: T0 - 100 }), card({ id: 'n2', nextReview: T0 - 90 }), card({ id: 'n3', nextReview: T0 - 80 })];
  assert.deepEqual(RE.buildQueue(items, { now: T0, newLimit: 2 }).map((i) => i.id), ['d', 'a', 'n1', 'n2']);
  assert.deepEqual(RE.buildQueue(items, { now: T0, limit: 2 }).map((i) => i.id), ['d', 'a']);
  assert.equal(RE.isDue(card({ nextReview: T0 + 1 }), T0), false);
});
