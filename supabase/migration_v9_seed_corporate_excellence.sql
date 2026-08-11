-- =========================================================================
-- FortunIQ OS — Seed: School of Corporate Excellence content
-- Run this AFTER migration_v9_academy_schools.sql, once.
-- =========================================================================

-- ---------- COURSES ----------
insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Our Values', 'Corporate Excellence', id, 'The four values that guide every decision at FortunIQ Fuels, and what living them actually looks like.', 1, 3, '15 min', 70
from schools where name = 'School of Corporate Excellence';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Code of Conduct', 'Corporate Excellence', id, 'The standards every employee and intern is expected to meet — from general conduct to technology use.', 2, 3, '18 min', 70
from schools where name = 'School of Corporate Excellence';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Workplace Behaviour', 'Corporate Excellence', id, 'Respect, professionalism, and how concerns get raised and handled at FortunIQ.', 3, 3, '15 min', 70
from schools where name = 'School of Corporate Excellence';

-- =========================================================================
-- COURSE: OUR VALUES
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Our Four Values', $$FortunIQ Fuels is guided by four values. They are not a poster on the wall — they are how we expect every person who works here, from the newest intern to the founder, to actually behave.

**Integrity** — We keep our promises, without exception. In fuel supply and logistics, our word is often the only guarantee a customer has that the volume, quality, and timing they were promised will actually arrive. Integrity means we do what we said we'd do, even when it's inconvenient, and we tell the truth even when a more comfortable story would be easier.

**Excellence** — Quality in every drop, every delivery. We don't treat "good enough" as good enough. Whether it's a fuel quality check, a client proposal, or an internal report, excellence means taking the extra few minutes to get it right rather than just getting it done.

**Reliability** — On time, every time, no interruptions. Our customers run mines, fleets, farms, and factories that cannot afford to stop because their fuel didn't arrive. Reliability is the value most directly tied to why customers choose FortunIQ over a cheaper competitor — certainty has a price, and we earn it by consistently showing up.

**Sustainability** — Building for a cleaner energy future. As a fuel company, we take seriously that our industry has an environmental responsibility. Sustainability means thinking beyond the next delivery to the long-term footprint of how we operate, and supporting South Africa's transition toward cleaner energy over time.$$, 6, 1
from courses where title = 'Our Values';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Values in Action', $$Values only matter if they change what you actually do. Here's what each value looks like in a normal working day at FortunIQ:

**Integrity in action:**
- Telling a customer honestly that a delivery will be an hour late, rather than staying silent and hoping they don't notice.
- Reporting a mistake you made yourself, rather than letting someone else discover it later.
- Never signing off on a fuel quality check you haven't actually performed.

**Excellence in action:**
- Double-checking a quotation's numbers before it goes to a client, even under deadline pressure.
- Asking a colleague to review your work when the stakes are high, rather than assuming your first draft is your best draft.
- Treating a small, routine task (like filing a document correctly) with the same care as a high-visibility one.

**Reliability in action:**
- Flagging a potential delivery delay as early as possible, so the customer and the team have time to adjust — not waiting until the last moment.
- Keeping equipment properly maintained so it doesn't fail at the worst possible time.
- Following through on commitments made in meetings, without needing to be reminded.

**Sustainability in action:**
- Reporting any spill, leak, or environmental risk immediately, no matter how small it seems.
- Looking for ways to reduce waste in day-to-day operations.
- Supporting the company's compliance with environmental regulations, not treating it as someone else's job.$$, 6, 2
from courses where title = 'Our Values';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Why Values Matter at FortunIQ', $$FortunIQ Fuels was built to close a real gap in the market: reliable, transparent petroleum supply, backed by refinery-direct sourcing and verifiable documentation. As a black-owned, Level 1 B-BBEE energy company built from Pretoria North, our values are not incidental to that mission — they are the mission.

**Trust is our actual product.** Fuel itself is a commodity — any supplier can source diesel. What customers are really buying from FortunIQ is certainty: that the volume promised is the volume delivered, that the quality is verified, and that we'll be there next month and next year, not just for one lucky order. Every one of our four values exists to protect that trust.

**Values protect the company's reputation, which protects everyone's job.** In a relationship-driven, reputation-sensitive industry like fuel logistics, a single serious integrity failure — a falsified quality certificate, a broken delivery promise on a large contract — can do damage that takes years to repair. Living our values isn't just "the right thing to do" in the abstract; it's what keeps FortunIQ winning the next tender and the one after that.

**You are the company's values, in practice.** Customers, suppliers, and regulators don't experience "FortunIQ Fuels" as an abstract entity — they experience the specific person who answered their call, drove their delivery, or signed their invoice. Every interaction is a small test of whether our stated values are real or just words. That responsibility is genuinely part of every role here, not just leadership's.$$, 6, 3
from courses where title = 'Our Values';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Which value is most directly about telling the truth, even when it''s inconvenient?',
  '["Excellence", "Integrity", "Reliability", "Sustainability"]'::jsonb, 1,
  'Integrity is about keeping promises and being honest, including when honesty is uncomfortable.', 1
from courses where title = 'Our Values';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'A customer runs a fleet that cannot afford fuel deliveries to be late. Which value does this most directly connect to?',
  '["Sustainability", "Excellence", "Reliability", "Integrity"]'::jsonb, 2,
  'Reliability — being on time, every time — is the value most tied to why time-sensitive customers choose FortunIQ.', 2
from courses where title = 'Our Values';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is described as FortunIQ''s "actual product," beyond the fuel itself?',
  '["Speed", "Price", "Trust and certainty", "Marketing"]'::jsonb, 2,
  'The lesson explains that customers are really buying certainty — that promises will be kept — not just a commodity.', 3
from courses where title = 'Our Values';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Which of these is an example of Excellence in action?',
  '["Staying silent about a late delivery", "Double-checking a quotation before it goes to a client", "Ignoring a small spill", "Skipping a maintenance check to save time"]'::jsonb, 1,
  'Taking the extra care to check work before it goes out, even under time pressure, is a direct example of Excellence.', 4
from courses where title = 'Our Values';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Why does the lesson say values matter beyond "being the right thing to do"?',
  '["They are required by law", "They protect the company''s reputation and, in turn, everyone''s job", "They are only relevant to management", "They have no real business impact"]'::jsonb, 1,
  'A serious values failure can damage trust for years, which threatens the business — and everyone''s job with it.', 5
from courses where title = 'Our Values';

-- =========================================================================
-- COURSE: CODE OF CONDUCT
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'General Standards of Conduct', $$This Code of Conduct applies to every employee and intern at FortunIQ Fuels, and forms part of the terms of everyone's employment or internship.

Every employee and intern is expected to:

- **Act honestly, with integrity**, and in the best interests of the Company at all times.
- **Treat colleagues, clients, suppliers and members of the public with courtesy and respect**, and never engage in harassment, discrimination, bullying or victimisation of any kind.
- **Comply with all applicable laws, regulations, and Company policies** — not just the ones that are convenient.
- **Perform your duties with reasonable care, skill and diligence.** "I didn't know" is rarely a satisfying answer when reasonable care would have caught the issue.
- **Protect Company property, information and reputation.** This includes physical equipment, but also confidential information and how you represent FortunIQ when speaking to outsiders.
- **Report conduct you reasonably believe breaches this Code**, using the Grievance Procedure or the Company's confidential reporting channel where appropriate.

This Code doesn't list every possible form of misconduct — it can't. Conduct not expressly mentioned can still lead to disciplinary action if it's inconsistent with these general standards.$$, 6, 1
from courses where title = 'Code of Conduct';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Technology, Information & AI', $$FortunIQ OS, email, and every other system you use at work come with real responsibilities attached.

**IT Acceptable Use, in brief:**
- Company systems are for business purposes. Limited, reasonable personal use is fine — running a side business through them is not.
- Only use Company-approved software; don't install unauthorised programs.
- Never try to bypass security controls, access data without authorisation, or send Confidential Information to personal email addresses.
- Report any suspected security incident (phishing, virus, unauthorised access) within 24 hours.

**AI Acceptable Use, in brief:**
- Company-approved AI tools (like FortunIQ Intelligence) can help with drafting, research, and analysis — but you're always responsible for checking the output before using it.
- **Never paste Confidential Information into a public AI tool** that hasn't been approved by the Company. Many public AI tools retain what you type and can use it to train their models — that's a real, permanent disclosure risk, not a hypothetical one.
- Don't rely on AI output for legal, financial, or safety-critical decisions without a human checking it properly.

**Passwords & Access:**
- Use unique, strong passwords (12+ characters) — never reused from personal accounts, never shared with anyone, including IT.
- Enable multi-factor authentication (MFA) wherever it's offered, and never disable it.

**Social Media:**
- If you mention FortunIQ on personal social media, make clear your views are your own.
- Never post images of Company premises, operations, or confidential materials, or make disparaging comments about the Company, clients, or colleagues.$$, 7, 2
from courses where title = 'Code of Conduct';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Professional Standards', $$A few practical standards that keep the workplace running smoothly for everyone.

**Dress Code:** Business casual is expected in office environments — neat, clean, appropriate for a client-facing company. Operational and site-based roles must wear the PPE and Company-branded workwear issued to them at all times while on site. Formal business attire is expected for client meetings, tenders, and presentations.

**Office Rules:** Working hours follow your appointment letter. Book meeting rooms in advance and leave them tidy. Keep shared spaces clean. Alcohol and illegal substances are prohibited on Company premises (except at sanctioned events, served responsibly).

**Visitor Policy:** All visitors sign in at reception and wear a visitor badge. You're responsible for hosting and escorting your own visitors — never leave a visitor unattended in an operational or restricted area. Visitors to depots and terminals must follow all Health & Safety requirements, including PPE.

**Why this matters:** none of these standards exist for their own sake. A visitor left unattended near operational equipment is a genuine safety risk, not just an inconvenience. A confidential document left visible in a meeting room a client just walked into is a genuine business risk. Professional standards are really just applied common sense about protecting people and information.$$, 5, 3
from courses where title = 'Code of Conduct';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do if you suspect a security incident, like a phishing email?',
  '["Ignore it if it seems minor", "Report it to IT within 24 hours", "Forward it to a colleague to check first", "Wait to see if it happens again"]'::jsonb, 1,
  'Suspected security incidents must be reported to IT promptly, within 24 hours of noticing them.', 1
from courses where title = 'Code of Conduct';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Why is pasting Confidential Information into a public AI tool a real risk, not just a technicality?',
  '["It costs the Company money", "Public AI tools can retain and use what you type to train their models — a permanent disclosure", "It is slower than using an internal system", "It is against copyright law"]'::jsonb, 1,
  'Many public AI tools retain submitted content and may use it for training, making it a genuine, often irreversible disclosure of confidential data.', 2
from courses where title = 'Code of Conduct';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Who is responsible for hosting and escorting a visitor on FortunIQ premises?',
  '["Reception, for the entire visit", "Security", "The employee or intern who invited them", "No one — visitors can move freely once signed in"]'::jsonb, 2,
  'The employee or intern responsible for the visitor must host and escort them — never leave a visitor unattended, especially in operational areas.', 3
from courses where title = 'Code of Conduct';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is required for client-facing meetings, tenders, or presentations, in terms of dress?',
  '["Casual wear is fine", "PPE only", "Formal business attire", "No specific requirement"]'::jsonb, 2,
  'Formal business attire is expected specifically for client meetings, tenders, and presentations.', 4
from courses where title = 'Code of Conduct';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Does the Code of Conduct list every possible form of misconduct?',
  '["Yes, only listed items count", "No — conduct inconsistent with the general standards can still lead to action", "Only for interns, not employees", "Only for IT-related conduct"]'::jsonb, 1,
  'The Code explicitly states it cannot list every scenario — conduct inconsistent with its general standards can still result in disciplinary action.', 5
from courses where title = 'Code of Conduct';

-- =========================================================================
-- COURSE: WORKPLACE BEHAVIOUR
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Respect and Professionalism', $$How we treat each other, our customers, and the public is not a "soft" issue — it directly determines whether FortunIQ is a place people want to work, and a company people want to do business with.

**The standard is simple:** treat everyone with courtesy and respect, regardless of their role, seniority, background, or how busy you are. This applies to colleagues, clients, suppliers, and members of the public.

**Harassment, discrimination, bullying, and victimisation are never acceptable**, in any form — whether based on race, gender, religion, disability, age, or any other characteristic, and whether it's a single serious incident or a pattern of smaller ones. This applies in the office, at depots, on site visits, and in any work-related communication, including messages sent outside of normal hours.

**Professionalism under pressure matters most.** It's easy to be respectful when things are going well. The real test is how you communicate when a delivery is late, a customer is frustrated, or a colleague has made a mistake that affects your own work. FortunIQ's reputation is built or damaged in exactly those harder moments.

**A practical guide:** before sending a frustrated email or making a sharp comment in a meeting, ask whether you'd be comfortable if the person you're speaking about could read or hear it. If not, that's usually a sign to pause and reconsider how you're raising the issue.$$, 5, 1
from courses where title = 'Workplace Behaviour';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Handling Disagreements and Concerns', $$Disagreements and concerns are normal in any workplace. What matters is having a real, fair way to raise and resolve them.

**Start informally, where appropriate.** If something is bothering you and it feels safe and reasonable to do so, raising it directly with the person involved, or with your supervisor, is often the fastest and least stressful path to resolution.

**The formal Grievance Procedure exists for when that's not appropriate or doesn't work:**
1. Submit a written grievance to your supervisor or the People team.
2. It will be acknowledged within a few business days and investigated promptly, fairly, and confidentially.
3. You'll have the opportunity to explain the grievance and provide supporting information.
4. A written outcome, with reasons, will follow.

**If you're not satisfied with the outcome**, you can escalate to more senior management, and you always retain the right to refer an unresolved dispute to the CCMA or the relevant external forum — the internal process is there to help, not to replace your legal rights.

**No one will be penalised for raising a grievance in good faith.** Victimising someone for speaking up is itself a serious breach of this Code.$$, 5, 2
from courses where title = 'Workplace Behaviour';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'When Standards Aren''t Met', $$It's worth understanding, in outline, what happens when workplace conduct falls short of these standards — not to create anxiety, but because a fair, predictable process protects everyone, including the person raising a concern and the person accused of something they may not have done.

**Misconduct ranges in seriousness.** Minor issues (like occasional lateness) are handled differently from serious misconduct (like theft, harassment, or a serious breach of confidentiality).

**FortunIQ generally applies progressive discipline** for anything short of serious misconduct: a verbal warning, then a written warning, then a final written warning, before dismissal would even be considered. This gives people a genuine opportunity to correct course.

**Serious misconduct can bypass those steps**, but even then, a fair process applies: written notice of the allegations, a real opportunity to respond and be represented, and a decision communicated in writing with reasons.

**This isn't about fear — it's about fairness.** A predictable, consistent process is what stops workplace discipline from being arbitrary or based on who someone happens to get along with. It protects you exactly as much whether you're the one raising a concern or the one responding to one.$$, 5, 3
from courses where title = 'Workplace Behaviour';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Where do FortunIQ''s standards of respect and professionalism apply?',
  '["Only in the main office", "Only during official working hours", "In the office, at depots, on site visits, and in work-related communication generally", "Only when clients are present"]'::jsonb, 2,
  'These standards apply broadly — office, depots, site visits, and work-related communication, not just one specific setting.', 1
from courses where title = 'Workplace Behaviour';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'According to the lesson, when does professionalism matter most?',
  '["When everything is going smoothly", "Under pressure — e.g. a late delivery or frustrated customer", "Only in client meetings", "Only during performance reviews"]'::jsonb, 1,
  'The lesson specifically highlights that professionalism under pressure is the real test, since reputation is built or damaged in exactly those harder moments.', 2
from courses where title = 'Workplace Behaviour';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What happens if someone is victimised for raising a grievance in good faith?',
  '["Nothing — it is expected", "It is itself treated as a serious breach of the Code", "Only HR can comment on it", "It only matters if the grievance was upheld"]'::jsonb, 1,
  'Victimising someone for raising a good-faith grievance is explicitly treated as a serious breach of the Code, regardless of the grievance''s outcome.', 3
from courses where title = 'Workplace Behaviour';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What does FortunIQ generally apply for issues short of serious misconduct?',
  '["Immediate dismissal", "No consequence at all", "Progressive discipline (verbal warning through to final written warning)", "A public announcement"]'::jsonb, 2,
  'Progressive discipline gives people a genuine chance to correct course before more serious consequences apply.', 4
from courses where title = 'Workplace Behaviour';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Does using the internal Grievance Procedure remove your right to go to the CCMA?',
  '["Yes, you must choose one or the other", "No — you retain that right if the matter remains unresolved", "Only for interns", "Only for serious misconduct cases"]'::jsonb, 1,
  'The internal process is there to help, not replace your legal rights — you retain the right to refer an unresolved dispute externally.', 5
from courses where title = 'Workplace Behaviour';
