/**
 * Static seasonal "mindful moments" — short reflective prompts that rotate
 * through the year. Twelve cards, one per month; the current month's prompt
 * surfaces on /wellbeing and on the home wellbeing band. Northern-hemisphere
 * months map to the obvious season; southern-hemisphere users hit the
 * opposite-but-equally-valid prompt because they're 6 months offset, which
 * is fine — every prompt is gentle and seasonless enough to land.
 *
 * Translation note: these are surfaced through i18n keys
 *   wellbeing.moment.{n}.title / wellbeing.moment.{n}.body
 * so all 58 locales pick them up naturally.
 */
export const MINDFUL_MOMENTS = [
  { id: 1, title_key: "wellbeing.moment.1.title", body_key: "wellbeing.moment.1.body" },
  { id: 2, title_key: "wellbeing.moment.2.title", body_key: "wellbeing.moment.2.body" },
  { id: 3, title_key: "wellbeing.moment.3.title", body_key: "wellbeing.moment.3.body" },
  { id: 4, title_key: "wellbeing.moment.4.title", body_key: "wellbeing.moment.4.body" },
  { id: 5, title_key: "wellbeing.moment.5.title", body_key: "wellbeing.moment.5.body" },
  { id: 6, title_key: "wellbeing.moment.6.title", body_key: "wellbeing.moment.6.body" },
  { id: 7, title_key: "wellbeing.moment.7.title", body_key: "wellbeing.moment.7.body" },
  { id: 8, title_key: "wellbeing.moment.8.title", body_key: "wellbeing.moment.8.body" },
  { id: 9, title_key: "wellbeing.moment.9.title", body_key: "wellbeing.moment.9.body" },
  { id: 10, title_key: "wellbeing.moment.10.title", body_key: "wellbeing.moment.10.body" },
  { id: 11, title_key: "wellbeing.moment.11.title", body_key: "wellbeing.moment.11.body" },
  { id: 12, title_key: "wellbeing.moment.12.title", body_key: "wellbeing.moment.12.body" },
];

export function momentForMonth(month /* 1-12 */) {
  const idx = ((Number(month) || 1) - 1 + 12) % 12;
  return MINDFUL_MOMENTS[idx];
}

// Three guiding principles for the home wellbeing band.
export const WELLBEING_PRINCIPLES = [
  { id: "notice", title_key: "wellbeing.principle.notice.title", body_key: "wellbeing.principle.notice.body" },
  { id: "slow",   title_key: "wellbeing.principle.slow.title",   body_key: "wellbeing.principle.slow.body" },
  { id: "nourish",title_key: "wellbeing.principle.nourish.title",body_key: "wellbeing.principle.nourish.body" },
];
