-- =========================================================================
-- FortunIQ OS — Seed: Welcome to FortunIQ, Company Story, and
-- School of Compliance & Governance
-- Run this AFTER migration_v9_academy_schools.sql and
-- migration_v9_seed_corporate_excellence.sql, once.
-- =========================================================================

-- ---------- ADD TO SCHOOL OF CORPORATE EXCELLENCE ----------
insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Welcome to FortunIQ', 'Corporate Excellence', id, 'Who we are, what we do, and how to get oriented in your first days.', 0, 3, '12 min', 70
from schools where name = 'School of Corporate Excellence';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Company Story', 'Corporate Excellence', id, 'Why FortunIQ Fuels exists, and where we''re headed.', 0.5, 2, '10 min', 70
from schools where name = 'School of Corporate Excellence';

-- =========================================================================
-- COURSE: WELCOME TO FORTUNIQ
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Who We Are', $$Welcome to FortunIQ Fuels — we're glad you're here.

**FortunIQ Fuels (Pty) Ltd** is a South African, black-owned, **B-BBEE Level 1** certified petroleum wholesale and logistics company, headquartered at our Head Office in **Pretoria North, Gauteng**, with a second base at the **Riversands Incubation Hub in Fourways** — our Innovation Hub, where we work on new tools like the platform you're using right now.

We operate under **Petroleum Wholesale Licence W/2026/0032**, and our registered company number is **2016/324403/07**.

**What we actually do**, in three parts:
- **Petroleum Supply** — sourcing and wholesaling diesel, petrol, and other fuels
- **Cross-Border Logistics** — moving fuel reliably across South Africa and its borders
- **Licensing** — the regulatory and compliance work that makes the other two possible, legally and safely

Every one of those three depends entirely on trust — a theme you'll see come up throughout your training here, because it genuinely is the core of how this business works.$$, 4, 1
from courses where title = 'Welcome to FortunIQ';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Finding Your Way Around', $$A few practical things that will make your first weeks easier.

**FortunIQ OS** is our internal platform — the one you're using right now. It's where you'll find company documents, your own employee profile, this Academy, and (depending on your role) tools for tenders, finance, operations, sales, and more. Bookmark it; you'll be here often.

**Your Employee Hub profile** is your digital personnel file — it holds your role, department, manager, and other details. Some fields (like banking details) are deliberately restricted to just you, HR, Finance, and Super Admins — that's not a bug, it's intentional protection of your personal information.

**Who to ask, for what:**
- IT or system access issues → your manager, who can route you to the right person
- HR questions (leave, policies, personal details) → HR/Admin
- Questions about a specific tender, customer, or operational matter → your direct team/manager

**FortunIQ Intelligence**, the AI assistant built into FortunIQ OS, can help you draft documents, summarise information, and answer general questions — but like any assistant, check its work, especially anything that matters.$$, 4, 2
from courses where title = 'Welcome to FortunIQ';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Your First Few Weeks', $$A realistic guide to settling in.

**It's normal not to know everything yet.** Petroleum logistics has its own language and processes — bills of lading, fuel grades, supply chain terminology — and nobody expects you to have it all down in week one. The School of Petroleum Operations in this Academy exists specifically to help with that.

**Complete your required training.** Depending on your role, you'll be assigned specific courses in this Academy — some, like this one and the Code of Conduct, apply to everyone; others are specific to your department.

**Ask questions early rather than guessing.** In an industry where fuel quality, delivery timing, and documentation accuracy genuinely matter, a clarifying question is always better than a confident guess.

**You're now part of how FortunIQ delivers on Integrity, Excellence, Reliability, and Sustainability** — the values covered in the next course in this school. Welcome aboard.$$, 4, 3
from courses where title = 'Welcome to FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is FortunIQ Fuels'' B-BBEE certification level?',
  '["Level 4", "Level 2", "Level 1", "Not certified"]'::jsonb, 2,
  'FortunIQ Fuels is B-BBEE Level 1 certified.', 1
from courses where title = 'Welcome to FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Where is FortunIQ''s Innovation Hub located?',
  '["Cape Town", "Riversands Incubation Hub, Fourways", "Durban", "Pretoria North"]'::jsonb, 1,
  'The Innovation Hub is at Riversands Incubation Hub in Fourways — Pretoria North is the Head Office.', 2
from courses where title = 'Welcome to FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What are FortunIQ''s three core business areas?',
  '["Retail, Marketing, HR", "Petroleum Supply, Cross-Border Logistics, Licensing", "Mining, Construction, Transport", "IT, Finance, Sales"]'::jsonb, 1,
  'FortunIQ operates across Petroleum Supply, Cross-Border Logistics, and Licensing.', 3
from courses where title = 'Welcome to FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Why are some fields on your Employee Hub profile (like banking details) restricted?',
  '["It is a system error", "To deliberately protect personal information — visible only to you, HR, Finance, and Super Admins", "Only managers have profiles with full details", "Restricted fields are being deprecated"]'::jsonb, 1,
  'This is intentional, deliberate protection of sensitive personal data, not an error.', 4
from courses where title = 'Welcome to FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do if you''re unsure about something, like fuel terminology, in your first weeks?',
  '["Guess confidently to seem competent", "Wait until your annual review to ask", "Ask a clarifying question early", "Avoid the topic entirely"]'::jsonb, 2,
  'Asking early is explicitly encouraged — a clarifying question beats a confident guess, especially where accuracy matters.', 5
from courses where title = 'Welcome to FortunIQ';

-- =========================================================================
-- COURSE: COMPANY STORY
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Why FortunIQ Exists', $$FortunIQ Fuels was built to close a real, specific gap in South Africa's fuel market: reliable, transparent petroleum supply and logistics that customers could actually trust — verifiable documentation, consistent delivery, and fair dealing, in an industry where those things aren't always guaranteed.

As a black-owned, B-BBEE Level 1 energy company, FortunIQ also represents something broader — genuine transformation in an industry that has historically had real barriers to entry for black-owned businesses. That's not a side detail; it's part of why the business was built the way it was, with proper licensing, real compliance infrastructure, and a long-term view rather than a shortcut-driven one.

**Two locations, two purposes.** Our Head Office in Pretoria North is where the core petroleum supply and logistics business runs day to day. Our Innovation Hub at Riversands in Fourways exists because FortunIQ has always intended to be more than "just" a fuel supplier — it's where we build the technology (like FortunIQ OS itself) that makes the rest of the business run better.$$, 5, 1
from courses where title = 'Company Story';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Where We''re Headed', $$FortunIQ's direction is guided by the same four values covered elsewhere in this school — Integrity, Excellence, Reliability, and Sustainability — applied to a genuinely long-term view of the business, not just the next delivery.

**Growing the core business.** Continuing to build long-term, trust-based relationships with customers across mining, logistics, agriculture, and government — the kind of relationships that come from consistently delivering on promises, tender after tender, year after year.

**Investing in our own technology.** FortunIQ OS — the platform you're using right now — is a direct example: rather than relying entirely on generic, off-the-shelf systems, we're building tools specifically shaped around how a South African fuel logistics company actually operates.

**Taking sustainability seriously**, not as a marketing line but as a genuine part of how a responsible fuel company should operate in the coming decades, as South Africa's energy landscape continues to evolve.

**You're joining at a genuinely active stage of that story** — the systems, training programmes, and processes you're using and learning are still being actively built and improved, which means your feedback and ideas can actually shape how FortunIQ works, not just fit into something already fixed.$$, 5, 2
from courses where title = 'Company Story';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What specific gap in the market was FortunIQ built to address?',
  '["Cheapest fuel prices in the market", "Reliable, transparent petroleum supply and logistics customers could trust", "Retail fuel stations", "International fuel exports only"]'::jsonb, 1,
  'FortunIQ was built around trust, transparency, and reliability in fuel supply and logistics.', 1
from courses where title = 'Company Story';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What does the Innovation Hub at Riversands, Fourways, focus on?',
  '["Fuel storage", "Building technology, like FortunIQ OS, that makes the business run better", "Customer complaints", "Vehicle maintenance"]'::jsonb, 1,
  'The Innovation Hub is specifically where FortunIQ builds its own technology tools.', 2
from courses where title = 'Company Story';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'According to this lesson, can employees influence how FortunIQ''s systems and processes evolve?',
  '["No, everything is already fixed", "Yes — the company is at an active stage where feedback and ideas can genuinely shape things", "Only senior management can provide input", "Only after five years of employment"]'::jsonb, 1,
  'The lesson explicitly states that FortunIQ is at an active stage of development where employee input can genuinely shape outcomes.', 3
from courses where title = 'Company Story';

-- =========================================================================
-- SCHOOL OF COMPLIANCE & GOVERNANCE — COURSES
-- =========================================================================

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'POPIA — Protecting Personal Information', 'Compliance & Governance', id, 'What South Africa''s data protection law requires, and what it means for your daily work.', 1, 3, '16 min', 70
from schools where name = 'School of Compliance & Governance';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Anti-Bribery & Corruption', 'Compliance & Governance', id, 'Recognising and refusing bribery, in all its forms — including the subtle ones.', 2, 3, '15 min', 70
from schools where name = 'School of Compliance & Governance';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Ethics at FortunIQ', 'Compliance & Governance', id, 'Making good decisions when the right answer isn''t written down anywhere.', 3, 3, '14 min', 70
from schools where name = 'School of Compliance & Governance';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Confidentiality', 'Compliance & Governance', id, 'What counts as confidential, and how to actually protect it.', 4, 2, '12 min', 70
from schools where name = 'School of Compliance & Governance';

insert into courses (title, category, school_id, description, sort_order, modules, duration, pass_mark_pct)
select 'Cybersecurity Essentials', 'Compliance & Governance', id, 'The everyday habits that keep FortunIQ''s systems and data safe.', 5, 3, '16 min', 70
from schools where name = 'School of Compliance & Governance';

-- =========================================================================
-- COURSE: POPIA
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'What POPIA Actually Requires', $$The **Protection of Personal Information Act (POPIA)** is South Africa's data protection law. It applies to any "personal information" FortunIQ handles — and in a company managing employee records, customer accounts, and supplier details, that's a lot of information.

**Personal information** means anything that identifies a specific person: names, ID numbers, contact details, banking details, even opinions expressed about someone. It doesn't have to be dramatic to count — an email address is personal information.

**POPIA's core principles, in plain terms:**
- **Only collect what you actually need** for a specific, legitimate purpose — not "just in case."
- **Only use it for that purpose** — customer contact details gathered for delivery logistics shouldn't be repurposed for unrelated marketing without proper consent.
- **Keep it secure** — reasonable technical and organisational measures to prevent loss, unauthorised access, or disclosure.
- **Don't keep it longer than necessary.**
- **People have rights over their own information** — including the right to know what you hold about them, and to request correction or deletion in many cases.

**Why this matters at FortunIQ specifically:** we hold sensitive personal information across Employee Hub profiles (banking details, ID numbers), customer records, and supplier details. A POPIA breach isn't just a compliance technicality — it's a real breach of trust with the people whose information we're responsible for.$$, 6, 1
from courses where title = 'POPIA — Protecting Personal Information';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'POPIA in Your Daily Work', $$Practical rules for handling personal information day to day.

**Only access what your role requires.** FortunIQ OS is built around exactly this principle — Finance can see banking details for payroll purposes, HR can see personnel records, but access is deliberately restricted by role. Don't try to view information outside what your work genuinely requires, even out of curiosity.

**Never share personal information over insecure channels.** Emailing a spreadsheet of customer ID numbers to a personal email address, or discussing an employee's medical certificate in a public space, are both real POPIA risks — not hypothetical ones.

**Get proper authorisation before sharing personal information externally** — with a supplier, a partner, or anyone outside FortunIQ. This isn't about being unhelpful; it's about protecting the person whose information it is.

**Report a suspected data breach immediately** — a lost laptop with customer data, an email sent to the wrong recipient, an unauthorised access attempt. POPIA has real timelines for reporting breaches to the Information Regulator, so speed matters.

**When in doubt, ask.** POPIA compliance isn't about memorising the Act — it's about building the habit of pausing before you collect, use, or share someone's personal information, and asking whether you're handling it the way you'd want your own information handled.$$, 6, 2
from courses where title = 'POPIA — Protecting Personal Information';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Special Categories & Consequences', $$Some personal information gets extra protection under POPIA, and the consequences of getting this wrong are real.

**"Special personal information"** includes things like health information, race, religious beliefs, and criminal history — this category requires an even higher standard of care than ordinary personal information. Employee medical certificates and disciplinary records fall into this category.

**Children's information** also gets special protection, though this is less commonly relevant to FortunIQ's day-to-day operations.

**Real consequences exist for non-compliance** — POPIA gives the Information Regulator the power to issue significant fines, and serious or repeated non-compliance can mean criminal liability for responsible parties. Beyond the legal consequences, a data breach damages the trust that FortunIQ's entire business model depends on.

**This is a shared responsibility, not just "IT's problem" or "HR's problem."** Every employee who touches personal information — which, in some form, is nearly everyone — has a real role in keeping FortunIQ POPIA-compliant.$$, 4, 3
from courses where title = 'POPIA — Protecting Personal Information';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Which of these counts as "personal information" under POPIA?',
  '["Only ID numbers", "Only banking details", "Any information that identifies a specific person, including an email address", "Only information marked as confidential"]'::jsonb, 2,
  'Personal information is broadly defined — anything identifying a specific person, including something as simple as an email address.', 1
from courses where title = 'POPIA — Protecting Personal Information';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Under POPIA, can you collect personal information "just in case" it might be useful later?',
  '["Yes, always", "No — only collect what you need for a specific, legitimate purpose", "Only for customers, not employees", "Only with verbal permission"]'::jsonb, 1,
  'A core POPIA principle is only collecting information for a specific, legitimate purpose — not speculative future use.', 2
from courses where title = 'POPIA — Protecting Personal Information';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do if you suspect a data breach, like customer data sent to the wrong email address?',
  '["Wait to see if anyone notices", "Report it immediately — POPIA has real reporting timelines", "Delete the evidence", "Only report it if it involves employee data"]'::jsonb, 1,
  'Immediate reporting matters because POPIA imposes real timelines for reporting breaches to the Information Regulator.', 3
from courses where title = 'POPIA — Protecting Personal Information';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Which of these is an example of "special personal information" requiring extra care?',
  '["A phone number", "A job title", "An employee''s medical certificate", "A company address"]'::jsonb, 2,
  'Health information, such as a medical certificate, falls under special personal information requiring a higher standard of care.', 4
from courses where title = 'POPIA — Protecting Personal Information';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Whose responsibility is POPIA compliance at FortunIQ?',
  '["Only IT", "Only HR", "Only senior management", "Every employee who handles personal information in some form"]'::jsonb, 3,
  'POPIA compliance is described as a shared responsibility across nearly everyone in the company, not confined to one department.', 5
from courses where title = 'POPIA — Protecting Personal Information';

-- =========================================================================
-- COURSE: ANTI-BRIBERY & CORRUPTION
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'What Counts as Bribery', $$Bribery isn't always a briefcase of cash in a parking garage — in the real world, it's usually much subtler than that, which is exactly why this training matters.

**A bribe is anything of value offered, given, or accepted to improperly influence a business decision.** That includes:
- Cash or cash equivalents (gift cards, vouchers)
- Gifts that are disproportionate to the relationship or occasion
- Excessive hospitality (extravagant meals, trips, entertainment)
- Job offers or other favours for a family member
- "Facilitation payments" — small payments to speed up a routine process you're already entitled to

**This applies in both directions.** Offering a bribe to win a tender is corruption. So is accepting one to award a contract, approve a supplier, or overlook a compliance failure. FortunIQ operates in the tender and government-adjacent space, which makes this a genuinely live risk, not an abstract policy requirement.

**The test isn't "did anyone get caught"** — it's "was this intended, or reasonably capable of, improperly influencing a decision." A R500 client dinner is normal business hospitality. A R50,000 "gift" right before a tender decision is not, regardless of how it's described.$$, 5, 1
from courses where title = 'Anti-Bribery & Corruption';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Recognising the Grey Areas', $$Most real bribery risk doesn't look like a crime — it looks like a favour, a relationship, or "just how business is done here." Here's how to think about the genuinely tricky situations.

**Gifts and hospitality:** A modest, occasional gift or meal, disclosed openly, is normal relationship-building. The warning signs are: unusual timing (right before a decision), unusual value, a request to keep it quiet, or a pattern of repeated "generosity" from the same party.

**Third parties and agents:** Using an agent or intermediary to "handle" a difficult approval doesn't remove FortunIQ's responsibility — if the agent pays a bribe on the company's behalf, that's still the company's problem, legally and ethically.

**Family and personal relationships:** Awarding a supplier contract to a family member's company isn't automatically corrupt, but it needs to be disclosed and handled with real transparency — hiding the relationship is where it becomes a genuine problem.

**"Everyone does it" is not a defence.** In industries where facilitation payments or favouritism are unfortunately common, FortunIQ's position is that this doesn't change what's acceptable for us — our Integrity value exists specifically for moments when the easier path and the right path diverge.$$, 5, 2
from courses where title = 'Anti-Bribery & Corruption';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'What To Do If You''re Approached', $$Practical guidance for the moment this actually happens to you.

**If someone offers you something that feels like it's meant to influence a decision:**
1. Decline clearly and professionally — you don't need to be dramatic about it, a simple "I'm not able to accept that" is enough.
2. Report it to your manager or HR/Admin, even if you're not entirely sure it counts as a bribe — let them make that call, not you alone.
3. Document what happened while it's fresh — who, what, when, and the context.

**If you're asked to make a payment or offer something that feels wrong** — a "facilitation fee" to speed up a licence approval, an unusual request from a colleague to route a payment a certain way — pause and raise it before proceeding, not after.

**You will never be penalised for refusing a bribe**, even if it costs FortunIQ a deal or causes a delay. Losing business because we refused to pay a bribe is a cost the company accepts; losing our licence to operate, or our reputation, because we didn't is not.

**Reporting in good faith is protected.** If you raise a genuine concern about bribery or corruption, you will not face retaliation for doing so — this is the same principle covered in the Grievance Procedure.$$, 5, 3
from courses where title = 'Anti-Bribery & Corruption';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Which of these could be considered a bribe under FortunIQ''s policy?',
  '["A modest, disclosed client lunch", "An unusually large gift arriving right before a tender decision", "A standard, published discount offered to all customers", "A public thank-you note"]'::jsonb, 1,
  'Unusual timing and value right before a decision are classic warning signs of an improper attempt to influence.', 1
from courses where title = 'Anti-Bribery & Corruption';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Does using an agent or third party to make a payment remove FortunIQ''s responsibility if that payment is a bribe?',
  '["Yes, only the agent is responsible", "No — the company remains responsible even if a third party pays on its behalf", "Only if the agent is based overseas", "Only for payments over R10,000"]'::jsonb, 1,
  'Using an intermediary does not remove the company''s legal or ethical responsibility for a bribe paid on its behalf.', 2
from courses where title = 'Anti-Bribery & Corruption';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do if you''re offered something that feels like it''s meant to influence a business decision?',
  '["Accept it quietly to avoid awkwardness", "Decline, then report it to your manager or HR/Admin", "Only worry about it if it''s cash", "Handle it yourself without telling anyone"]'::jsonb, 1,
  'Decline clearly and report it — even if you''re unsure whether it technically counts as a bribe, let your manager or HR/Admin make that assessment.', 3
from courses where title = 'Anti-Bribery & Corruption';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What happens if refusing a bribe costs FortunIQ a deal?',
  '["The employee who refused is held responsible for the loss", "FortunIQ accepts this as a cost worth bearing", "The deal must be reconsidered", "It is treated as a performance issue"]'::jsonb, 1,
  'The lesson is explicit: losing business by refusing a bribe is an accepted cost — losing reputation or licence by paying one is not.', 4
from courses where title = 'Anti-Bribery & Corruption';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Is "everyone in this industry does it" a valid justification for a facilitation payment?',
  '["Yes, if it is standard practice locally", "No — FortunIQ''s standards apply regardless of industry norms", "Only for international contracts", "Only if approved verbally by a manager"]'::jsonb, 1,
  'The lesson explicitly rejects "everyone does it" as a justification — FortunIQ''s standards do not shift based on industry norms.', 5
from courses where title = 'Anti-Bribery & Corruption';

-- =========================================================================
-- COURSE: ETHICS AT FORTUNIQ
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Beyond the Rulebook', $$Policies and codes of conduct can't cover every situation you'll ever face. Ethics is what guides you in the situations they don't.

**A simple, practical test for tricky situations:**
1. Would I be comfortable if this decision were made public?
2. Would I be comfortable explaining this decision to my manager, in detail?
3. Am I treating this person the way I'd want to be treated in their position?

If the honest answer to any of these is "no" or "I'd rather not," that's a real signal worth pausing on, even if you can't point to a specific rule being broken.

**Ethics often shows up in small moments, not dramatic ones:** Do you flag a pricing error that's in the customer's favour, or quietly let it stand? Do you give honest feedback in a performance review, or take the easier, vaguer path? Do you admit when you don't know something, or bluff your way through? These small, everyday choices are where a company's real ethical culture is built — far more than in the rare, dramatic ethical dilemma.$$, 5, 1
from courses where title = 'Ethics at FortunIQ';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Ethical Decision-Making at Work', $$A few realistic scenarios to think through — there's rarely one perfect answer, but there's usually a clearly better one.

**Scenario: A colleague asks you to backdate a document.** Even if the request seems minor and well-intentioned ("it'll just save everyone a headache"), backdating a document is a form of dishonesty that undermines the integrity of FortunIQ's records. The right response is a respectful "I'm not comfortable doing that" — and if you're pressured, raise it with your manager.

**Scenario: You notice a supplier invoice that seems inflated, but flagging it might delay an urgent delivery.** Reliability matters, but not at the cost of Integrity — flag the discrepancy while working in parallel to keep the delivery on track if possible, rather than staying silent to avoid friction.

**Scenario: A friend outside the company asks for "insider" information about an upcoming tender.** Confidential information stays confidential, regardless of the relationship asking for it. A friendship doesn't change what you're authorised to share.

**When genuinely unsure, ask.** Raising an ethical question with your manager or HR/Admin is never held against you — staying silent about a real concern is the choice that actually causes harm.$$, 5, 2
from courses where title = 'Ethics at FortunIQ';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Ethics and the Bigger Picture', $$Why ethical culture matters beyond any single decision.

**Ethical companies are more resilient.** A company culture where people feel safe raising concerns catches problems early — a small pricing error, a compliance gap, a quality issue — before they become expensive, public, or dangerous. A culture where people are afraid to speak up just delays problems until they're much bigger.

**Ethics protects FortunIQ's licence to operate, in every sense.** Beyond the literal Petroleum Wholesale Licence, FortunIQ's ongoing ability to win tenders, retain customers, and attract good people depends on a reputation for being genuinely trustworthy — not just compliant on paper.

**You don't need to have all the answers — you need to be willing to ask the question.** Nobody expects every employee to be an ethics expert. What actually matters is a habit of pausing on decisions that feel uncomfortable, and having the confidence to raise them rather than push through alone.$$, 4, 3
from courses where title = 'Ethics at FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is one of the simple tests suggested for a tricky ethical situation?',
  '["Would I get away with it?", "Would I be comfortable explaining this decision to my manager, in detail?", "Is anyone watching?", "Has anyone been caught doing this before?"]'::jsonb, 1,
  'This test focuses on genuine comfort explaining the decision transparently, not on whether you would get caught.', 1
from courses where title = 'Ethics at FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do if a colleague asks you to backdate a document, even with good intentions?',
  '["Do it, since the intention is good", "Say you''re not comfortable doing that, and raise it with your manager if pressured", "Backdate it only once", "Ask a different colleague to do it instead"]'::jsonb, 1,
  'Backdating undermines record integrity regardless of intent — decline respectfully and escalate if pressured.', 2
from courses where title = 'Ethics at FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'A friend outside the company asks about details of an upcoming tender. What should you do?',
  '["Share general details since it''s a friend", "Keep it confidential, regardless of the relationship", "Share it only if they promise not to tell anyone", "Ask your manager for permission to share"]'::jsonb, 1,
  'Confidentiality doesn''t change based on who is asking — friendship is not a valid reason to disclose confidential information.', 3
from courses where title = 'Ethics at FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'According to the lesson, where is a company''s real ethical culture actually built?',
  '["In formal policy documents only", "In rare, dramatic ethical dilemmas", "In small, everyday choices", "In annual compliance training alone"]'::jsonb, 2,
  'The lesson emphasises that everyday small choices, not rare dramatic moments, are where ethical culture is really built.', 4
from courses where title = 'Ethics at FortunIQ';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What does the lesson say is expected of every employee regarding ethics?',
  '["Being an ethics expert", "Having every answer memorised", "A habit of pausing on uncomfortable decisions and raising them", "Avoiding difficult situations entirely"]'::jsonb, 2,
  'Nobody is expected to be an ethics expert — the real expectation is a willingness to pause and ask when something feels wrong.', 5
from courses where title = 'Ethics at FortunIQ';

-- =========================================================================
-- COURSE: CONFIDENTIALITY
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'What Counts as Confidential', $$"Confidential" covers more than most people initially assume.

**Clearly confidential information includes:**
- Customer names, volumes, pricing, and contract terms
- Tender strategies, bid pricing, and margin information before submission
- Supplier agreements and terms
- Employee personal and financial information
- Internal financial performance, before it's publicly reported (if ever)
- Business strategy, expansion plans, and unreleased systems (like new FortunIQ OS features)

**A useful rule of thumb:** if you'd be surprised or uncomfortable to see it discussed on a competitor's LinkedIn post, it's probably confidential.

**This obligation doesn't end when you leave FortunIQ.** Confidentiality commitments made during your employment continue to apply afterward — this is a standard, enforceable term of your employment or internship agreement, not a courtesy that expires the day you leave.$$, 4, 1
from courses where title = 'Confidentiality';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Protecting Confidential Information in Practice', $$Confidentiality is mostly about everyday habits, not dramatic secrecy.

**Physical and digital hygiene:**
- Lock your screen when you step away, even briefly.
- Don't discuss confidential matters in public spaces — a coffee shop, a lift, a client's reception area — where you can be overheard.
- Store and share documents through approved Company systems, not personal email or messaging apps.
- Shred or securely dispose of printed confidential documents rather than binning them.

**External conversations:** Be thoughtful about what you say in interviews, on social media, or to friends and family, even when you're not naming names. Describing "a big tender we're working on with a mining client in Limpopo" can be identifiable enough to matter, even without naming the client directly.

**When sharing is genuinely necessary** — with an auditor, a legal advisor, an authorised partner — make sure it goes through the right channel and, where appropriate, is covered by its own confidentiality agreement (like the NDAs used with Advisory Board members and some partners).$$, 4, 2
from courses where title = 'Confidentiality';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Does your confidentiality obligation end when you leave FortunIQ?',
  '["Yes, immediately", "No — it continues to apply after employment ends", "Only for one month after leaving", "Only if you signed an NDA"]'::jsonb, 1,
  'Confidentiality obligations are a standard, enforceable term that continues beyond the end of employment.', 1
from courses where title = 'Confidentiality';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Which of these is a good practical test for whether something is confidential?',
  '["Whether it is marked in bold text", "Whether you would be comfortable seeing it discussed on a competitor''s LinkedIn post", "Whether it was said in a meeting", "Whether a client asked about it"]'::jsonb, 1,
  'This is offered as a practical, intuitive rule of thumb for judging whether information should be treated as confidential.', 2
from courses where title = 'Confidentiality';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Why might describing "a big tender with a mining client in Limpopo" be a confidentiality risk, even without naming the client?',
  '["It is never a risk without a name", "The description can still be identifiable enough to matter", "Only exact names count as confidential", "Mining clients are not covered by confidentiality rules"]'::jsonb, 1,
  'Details can be identifiable even without an explicit name — the lesson warns against this kind of indirect disclosure.', 3
from courses where title = 'Confidentiality';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do with printed confidential documents you no longer need?',
  '["Put them in the regular bin", "Shred or securely dispose of them", "Leave them on your desk for reference", "Recycle them without shredding"]'::jsonb, 1,
  'Confidential printed documents should be securely destroyed, not simply discarded.', 4
from courses where title = 'Confidentiality';

-- =========================================================================
-- COURSE: CYBERSECURITY ESSENTIALS
-- =========================================================================

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Everyday Habits That Matter', $$Most cybersecurity incidents don't come from sophisticated hacking — they come from ordinary, everyday habits going wrong. A few genuinely matter more than the rest:

**Passwords:** Use unique, strong passwords (12+ characters) for every system — never reused from personal accounts. A password manager makes this genuinely easy rather than a burden.

**Multi-Factor Authentication (MFA):** Enable it everywhere it's offered, and never disable it, even temporarily "just this once." MFA is the single most effective everyday protection against someone using a stolen password.

**Phishing awareness:** Be suspicious of unexpected emails asking you to click a link, open an attachment, or urgently transfer money or information — especially ones creating pressure ("respond within the hour" or impersonating a senior person). When in doubt, verify through a separate channel (like calling the person directly) before acting.

**Locking your screen** whenever you step away, even for a minute, on any device connected to Company systems.$$, 6, 1
from courses where title = 'Cybersecurity Essentials';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'Recognising an Attack', $$Attackers rely on you not noticing the warning signs. Here's what to watch for.

**Phishing red flags:**
- A sender address that looks almost right, but not quite (e.g. a single changed letter)
- Urgent, pressured language demanding immediate action
- Requests to change banking details, pay an invoice urgently, or share login credentials
- Generic greetings ("Dear Customer") on something claiming to be personal or urgent
- Links that, when hovered over, show a web address that doesn't match what's displayed

**"CEO fraud" specifically** — an email or message that appears to be from a senior leader, asking for an urgent, unusual payment or confidential information — is a well-known and effective attack. Genuine urgent requests from leadership can always be verified with a quick phone call; a genuine sender will never be offended by that.

**If you're not sure, don't act — ask.** Forwarding a suspicious email to IT for a second opinion takes a minute; recovering from a successful attack can take weeks and cause real financial and reputational damage.$$, 5, 2
from courses where title = 'Cybersecurity Essentials';

insert into lessons (course_id, title, content, duration_minutes, sort_order)
select id, 'If Something Goes Wrong', $$Even careful people occasionally click the wrong thing — what matters most is what happens next.

**Report immediately, without fear of blame.** If you think you've clicked a malicious link, entered your password on a fake site, or noticed anything unusual on your device, report it to IT right away. Every minute matters in limiting the damage, and FortunIQ's IT Acceptable Use policy specifically expects this to be reported within 24 hours — being honest and fast about a mistake is exactly the right response, not something to hide out of embarrassment.

**Don't try to fix it yourself first.** Disconnecting from the network and reporting immediately is almost always better than spending time trying to undo the damage alone — you might unintentionally destroy evidence IT needs, or give an attacker more time.

**This applies to AI tools too.** If you've accidentally pasted confidential information into an unapproved AI tool, that's a real disclosure event, not a minor slip — report it the same way you'd report any other data exposure, so it can be properly assessed.

**Cybersecurity is a team effort.** The habits in this course matter far more, in aggregate, than any single piece of security software — you are genuinely part of FortunIQ's defence, not just a user of the systems it protects.$$, 5, 3
from courses where title = 'Cybersecurity Essentials';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is described as the single most effective everyday protection against a stolen password?',
  '["A very long password alone", "Multi-Factor Authentication (MFA)", "Changing your password daily", "Writing your password down securely"]'::jsonb, 1,
  'MFA is highlighted as the most effective everyday defence, even if a password itself is compromised.', 1
from courses where title = 'Cybersecurity Essentials';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is a classic warning sign of "CEO fraud"?',
  '["A routine, scheduled meeting request", "An urgent, unusual payment or confidential information request appearing to be from a senior leader", "A newsletter from IT", "A calendar invite from a colleague"]'::jsonb, 1,
  'CEO fraud typically involves an urgent, unusual request that appears to come from leadership, designed to bypass normal caution.', 2
from courses where title = 'Cybersecurity Essentials';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What should you do if you think you''ve clicked a malicious link?',
  '["Try to fix it yourself quietly first", "Report it to IT immediately, without trying to hide it", "Wait to see if anything bad actually happens", "Only report it if you are certain it was malicious"]'::jsonb, 1,
  'Immediate, honest reporting is explicitly the right response — trying to fix it alone first can make things worse.', 3
from courses where title = 'Cybersecurity Essentials';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'Is accidentally pasting confidential information into an unapproved AI tool a real security concern?',
  '["No, AI tools are always safe", "Yes — it should be reported the same way as any other data exposure", "Only if the AI tool is well-known", "Only if it happens more than once"]'::jsonb, 1,
  'This is treated as a genuine disclosure event requiring the same reporting as any other data exposure incident.', 4
from courses where title = 'Cybersecurity Essentials';

insert into quiz_questions (course_id, question, options, correct_option_index, explanation, sort_order)
select id, 'What is one of the clearest phishing red flags described in this course?',
  '["A well-formatted email", "A sender address that looks almost right, but not quite", "An email from a known colleague", "A message received during work hours"]'::jsonb, 1,
  'A subtly altered sender address is a classic, hard-to-notice phishing red flag highlighted in the lesson.', 5
from courses where title = 'Cybersecurity Essentials';
