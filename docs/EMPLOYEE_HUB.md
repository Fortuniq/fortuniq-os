# Employee Hub

The Employee Hub is FortunIQ OS's Employee Lifecycle Management system —
the single source of truth for every employee. This document covers what
Phase 1 actually built, what's genuinely still ahead, and the security
model behind the restricted fields.

## What Phase 1 built

- **Employee Directory** — a searchable, card-based directory of every
  employee, replacing the old simple People list. Search works across
  name, role, department, and employee number.
- **Employee Profile** — a full digital personnel file per person, at
  `/people/[id]`: employment details, contact information, restricted
  financial data, skills, certifications, equipment issued, performance
  rating, leave balance, and system access — all the fields from your
  brief, laid out across clean, scannable cards.
- **Auto-generated employee numbers** (EMP-0001, EMP-0002, ...).
- **Restricted field security** (banking details, tax number) — see
  below. This is real, server-enforced access control, not a UI toggle.
- **The data model for equipment and certifications**, with a working UI
  to display them (adding/editing currently happens via Supabase's Table
  Editor — see "What's not built yet").
- **The data model for the Document Centre and digital signatures** —
  `documents` now has an `employee_id` link, a `document_type` field, and
  signature-tracking columns (`signature_status`, `signed_by_email`,
  `signed_at`, `signed_ip_address`, `original_document_id` for
  never-overwrite versioning) — ready for Phase 2, not yet wired into a
  UI for browsing an employee's documents specifically.

## Why banking and tax data are genuinely protected, not just hidden

This is the part worth understanding, not just trusting. When you open
someone else's profile and you're not authorised to see their banking
details:

1. The server (`src/app/(app)/people/[id]/page.tsx`) checks
   `canViewRestrictedEmployeeField()` **before** rendering anything.
2. If you're not authorised, the banking/tax fields are set to `null`
   **on the server**, before the page is ever sent to your browser.
3. Your browser never receives the real values at all — there's no
   client-side check to bypass, because the data was never there to find.

This was verified directly during development: inspecting the actual
HTML sent to an unauthorised test account's browser confirmed the real
banking values were absent entirely — not present-but-hidden-by-CSS,
genuinely not there.

**Who's authorised**, per `src/lib/employee-hub-core.ts`:
- the employee themselves, viewing their own profile
- HR/Admin
- Finance (needs this for payroll processing)
- Super Admin

Notably, **Management does not see this data**, despite Management's
otherwise broad visibility across the business — organisational oversight
isn't the same thing as a legitimate need to see someone's bank account
number. This is deliberately stricter than Management's usual access
level everywhere else in FortunIQ OS.

## Testing

`src/lib/employee-hub-core.test.ts` — 11 automated tests covering every
role against the restricted-field rule, run as part of `npm test`
(138 tests total across the whole app). Covers: fail-closed for
signed-out users, denial for ordinary Employees and for Management
specifically, and explicit allow for self/HR/Finance/Super Admin.

## What's honestly not built yet — a real roadmap, not a vague promise

Everything below is a genuinely separate system, not a small addition —
building shallow versions of all of them in the same pass as the
Directory and Profile would have meant a worse version of everything.
Here's the honest state of each, roughly in the order they'd naturally
get built:

### Onboarding & Offboarding workflows
Not built. The `status` field supports the right states (Onboarding,
Active, Archived), but the actual step-by-step workflow — welcome email,
Microsoft account creation, Academy path assignment, contract issue,
signature, manager approval — doesn't exist as a guided process yet. This
is a genuinely new feature: a workflow engine, a checklist UI, and
integration points into Academy, Documents, and email.

### Digital Signatures (the real signing flow)
The data model is ready (see above), but there's no actual UI for
"employee receives a notification, opens a document, reviews it, signs
electronically." A real implementation needs: a notification system, a
signing UI/consent flow, and a decision about whether to build your own
lightweight e-signature capture or integrate a dedicated e-signature
provider (DocuSign, Adobe Sign, or Microsoft's own signature capabilities
via SharePoint/Power Automate) — the last option is worth strongly
considering rather than building signature legal-validity infrastructure
from scratch.

### Attendance & Time Management
Not built. Clock in/out, break tracking, overtime, and attendance
reporting would need their own tables and UI, plus a real decision about
how attendance is actually captured (a kiosk? mobile check-in? integration
with an existing time clock system, if you have one?) before building the
data model around it.

### Leave Management (beyond the balance field)
The Employee Profile shows a leave balance, but there's no leave
*application* workflow yet — no request form, approval chain, or leave
calendar. This connects naturally to Attendance above.

### Performance Management (beyond the rating field)
The profile shows a single performance rating; the fuller system
(objectives, KPIs, quarterly/annual review cycles, self-review,
manager notes, career development plans) is a separate build, though it
would naturally read from the same employee record and could genuinely
connect to Academy training completion, as you described.

### Payroll workspace
Not built. As you specified, this should prepare the data (salary,
allowances, deductions) rather than calculate payroll — that's still a
real, separate module to build, restricted to Finance and authorised
management, per your requirement.

### Expense Management
Not built. This needs its own submission/approval workflow and, as you
specified, a real integration point into the Finance module (which
already exists) — a natural next build given Finance is already live.

### Benefits Administration
Not built. Medical aid, retirement fund, and the other benefit types
you listed need their own data model and enrolment/change workflow.

### Statutory Compliance Dashboard
Not built. This would pull from several of the above (contracts,
certifications, POPIA acknowledgement, mandatory training) — makes the
most sense to build once those underlying pieces exist, so it has real
data to summarise rather than being an empty shell.

### Employee Self-Service beyond viewing your own profile
Employees can currently view their own profile, including their own
restricted fields. Actually applying for leave, submitting expenses,
signing documents, and updating their own contact details all depend on
the workflows above existing first.

### Manager Portal
Not built. A dedicated view for managers (approve leave, review
attendance, monitor team progress) depends on Leave, Attendance, and
Performance existing first — this is naturally one of the last pieces to
build, once there's something for a manager to actually approve.

## A sensible build order, if you want one

Given the dependencies above, a reasonable next-phase order:
1. Add/Edit forms for the Employee Hub itself (currently new
   employees/equipment/certifications go through Supabase directly)
2. Leave Management (request + approval), since it's relatively
   self-contained and immediately useful
3. Onboarding workflow (ties together Academy, Documents, and the
   Employee Hub you already have)
4. Digital signatures — worth deciding early whether to build custom or
   integrate a provider, since that choice affects a few things downstream
5. Attendance & Time (once you've decided how attendance is actually captured)
6. Performance Management
7. Expense Management (Finance already exists, so this connects cleanly)
8. Payroll workspace, Benefits Administration
9. Compliance Dashboard (once there's real underlying data to summarise)
10. Manager Portal (once there's something for managers to approve)

This isn't a commitment to build all of this — just a considered order
for whenever you're ready to keep going.
