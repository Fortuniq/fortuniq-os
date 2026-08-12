# Academy Schools

FortunIQ Academy is now structured Skillsoft-style: **Schools** (faculties)
each containing **Courses**, each containing video-ready **Lessons** and a
**multiple-choice assessment**. This document covers what's built, the
one real limitation worth understanding, and how to keep adding content.

## The five schools

| School | Courses (per your brief) | Status |
|---|---|---|
| Corporate Excellence | Welcome to FortunIQ, Company Story, Values, Code of Conduct, Workplace Behaviour | ✅ Fully built — 5/5 courses |
| Compliance & Governance | POPIA, Anti-Bribery & Corruption, Ethics, Confidentiality, Cybersecurity | ✅ Fully built — 5/5 courses |
| Petroleum Operations | Industry basics, Diesel/Petrol/LPG/Jet Fuel, Supply chain, Bills of Lading, Fuel quality, Safety | Structure ready, content not yet written |
| Business Excellence | Customer service, Sales, Tender management, CRM, Communication, Time management | Structure ready, content not yet written |
| Leadership | Coaching, Decision-making, Problem solving, Emotional intelligence, Management | Structure ready, content not yet written |

## Managing content in-app (no more Supabase needed for this)

Academy → **Manage Content** (visible only to Super Admin) now provides:

- **Schools**: add a new school, edit an existing one's name/icon/description
- **Courses**: add a new course (choose its school, set its pass mark), edit or delete an existing one
- **Lessons and Assessment Questions**: click the arrow next to any course to expand it, then add, edit, or delete its lessons and quiz questions directly — including setting which option is correct

This is real create/update/delete, not a preview — it writes directly to
the same tables the live Academy reads from. The one thing intentionally
*not* editable here is which employees have completed what — that's
tracked automatically as people actually take courses, not something an
admin sets manually.

## The one real limitation: no actual video

I can't produce video files — no recording, no narration, no generation.
Every lesson is built to be **video-ready**: there's a `video_url` field
on every lesson, and the course player already has a proper video area
that will play a real video automatically the moment one's added — no
redesign needed. Until then, that space shows a clean placeholder and the
lesson displays as genuinely well-written text below it, not a stand-in.

**To add a real video to a lesson later:**
1. Record or source the video, and host it somewhere reachable by URL —
   SharePoint (which you already have connected), Microsoft Stream, an
   unlisted YouTube/Vimeo link, or anywhere else that gives you a direct
   playable URL.
2. In Supabase → Table Editor → `lessons`, find the row for that lesson,
   and paste the URL into `video_url`.
3. Reload the lesson in the app — the video now plays automatically.

## How assessments work

- Each course has multiple-choice questions with one correct answer.
- **The correct answers are never sent to the browser** until after
  someone submits — scoring happens entirely server-side
  (`src/app/(app)/academy/academy-actions.ts`), using the real stored
  answers, not anything the browser claims. This is deliberate: a
  client-side-only quiz can be trivially "won" by reading the page's
  source code.
- Each course has its own pass mark (`courses.pass_mark_pct`, defaulting
  to 70%) — set individually if some courses should require a higher bar.
- **Passing a course automatically creates a real certification** on that
  person's Employee Hub profile (`employee_certifications`), connecting
  Academy directly to the personnel file — exactly as described in your
  original brief ("Performance should connect to FortunIQ Academy").

## Testing

`src/lib/academy-core.test.ts` — 7 automated tests covering the scoring
logic: perfect scores, zero scores, partial scores, respecting each
course's specific pass mark, unanswered questions counted as incorrect
(not as errors), and the zero-questions edge case. Part of `npm test`
(145 tests total across the whole app).

## Adding content to the remaining schools

**The easiest way now is directly in the app**: Academy → Manage Content
→ Add Course (choosing Petroleum Operations, Business Excellence, or
Leadership), then expand the new course to add its lessons and questions.

**If you'd rather I write the content** (recommended for these three,
since they benefit from real subject-matter research and consistent
tone) — just ask, the same way you did for the first two schools.
