/* ReviewEngine: a small spaced-repetition scheduler (SM-2 flavoured), pure functions, no storage, no server.
 * Grades: again (0) / hard (1) / good (2) / easy (3).  Intervals are in days (fractions allowed). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const GRADES = Object.freeze({ again: 0, hard: 1, good: 2, easy: 3 });
  const GRADE_NAMES = ['again', 'hard', 'good', 'easy'];
  const START_EASE = 2.5, MIN_EASE = 1.3;
  const AGAIN_DELAY = 10 * MIN;

  const r2 = (n) => Math.round(n * 100) / 100;

  function gradeIndex(g) {
    const n = typeof g === 'string' ? GRADES[g] : g;
    if (!(n >= 0 && n <= 3)) throw new Error('Invalid review grade: ' + g);
    return n;
  }

  /** Next scheduling state for `item` after answering with `grade` at time `now` (ms). Does not mutate `item`. */
  function schedule(item, grade, now) {
    const g = gradeIndex(grade);
    const t = now == null ? Date.now() : now;
    let ease = item.ease || START_EASE;
    const prev = item.interval || 0;
    let interval, delay;
    if (g === 0) { ease = Math.max(MIN_EASE, ease - 0.2); interval = 0; delay = AGAIN_DELAY; }
    else if (g === 1) { ease = Math.max(MIN_EASE, ease - 0.15); interval = prev < 1 ? 1 : Math.max(prev + 1, Math.round(prev * 1.2)); delay = interval * DAY; }
    else if (g === 2) { interval = prev < 1 ? 1 : Math.max(prev + 1, Math.round(prev * ease)); delay = interval * DAY; }
    else { ease = ease + 0.15; interval = prev < 1 ? 4 : Math.max(prev + 2, Math.round(prev * ease * 1.3)); delay = interval * DAY; }
    return { interval, ease: r2(ease), nextReview: Math.round(t + delay), reviewCount: (item.reviewCount || 0) + 1, lastReviewed: t };
  }

  function formatInterval(ms) {
    if (ms < HOUR) return Math.max(1, Math.round(ms / MIN)) + ' phút';
    if (ms < DAY) return Math.round(ms / HOUR) + ' giờ';
    const d = ms / DAY;
    if (d < 14) return Math.round(d) + ' ngày';
    if (d < 60) return Math.round(d / 7) + ' tuần';
    return Math.round(d / 30) + ' tháng';
  }
  /** Labels for the four answer buttons: "Again <10 phút>, Hard <1 ngày> ...". */
  function previewIntervals(item, now) {
    const t = now == null ? Date.now() : now;
    return GRADE_NAMES.map((name, g) => { const s = schedule(item, g, t); return { grade: name, label: formatInterval(s.nextReview - t), nextReview: s.nextReview }; });
  }

  const isDue = (item, now) => !item.known && (item.nextReview == null || item.nextReview <= (now == null ? Date.now() : now));
  const isNew = (item) => !(item.reviewCount > 0);

  /** Due cards, most overdue first; brand-new cards capped by `newLimit` so a big import does not flood a session. */
  function buildQueue(items, opts) {
    const o = opts || {};
    const now = o.now == null ? Date.now() : o.now;
    const limit = o.limit == null ? 50 : o.limit;
    const newLimit = o.newLimit == null ? 20 : o.newLimit;
    const due = items.filter((i) => isDue(i, now)).sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
    const out = [];
    let news = 0;
    for (const it of due) {
      if (out.length >= limit) break;
      if (isNew(it)) { if (news >= newLimit) continue; news++; }
      out.push(it);
    }
    return out;
  }

  LF.ReviewEngine = { GRADES, GRADE_NAMES, START_EASE, schedule, previewIntervals, formatInterval, isDue, isNew, buildQueue };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.ReviewEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
