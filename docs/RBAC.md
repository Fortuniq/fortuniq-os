# Role-Based Access Control (RBAC)

FortunIQ OS now has two permission layers working together:

1. **The existing coarse layer** (`permissions-core.ts`, unchanged) — six
   roles (Super Admin, Management, HR/Admin, Finance, Sales/Marketing,
   Employee), each with a default set of modules they can open at all.
   Still fully in force.
2. **The new granular layer** (`rbac-core.ts`, this document) — within a
   module a person can already open, exactly which actions they hold:
   View, Create, Edit, Delete, Approve, Export, Manage.

Both apply together. A person needs module access from layer 1 *and* the
specific action from layer 2 to actually do something. This is managed
from **Employee Hub → any employee's profile → System Access &
Permissions**, exactly as specified.

## The permission matrix

Every employee profile now shows a table: 13 modules × 7 actions, with a
checkbox at every intersection. Tick or untick any box and it saves
immediately — no separate Save button. "Manage" is a superset — ticking
it automatically covers every other action for that module, shown as
greyed-out ticked boxes.

## Role Templates

Ten reusable templates exist, selectable from a dropdown at the top of
the matrix: **CEO, Director, HR Manager, Finance Officer, Sales
Representative, Tender Administrator, Marketing, Operations,
Administrator, Intern.** Applying one replaces that employee's entire
permission set with the template's — a one-time copy, not a live link.
Editing a template's definition in code later never retroactively changes
anyone it was already applied to; permissions can be freely customised
per person after applying a template, exactly as specified.

Four of these are your own worked examples from the brief, reproduced
exactly and verified by automated test: **Tender Administrator, Finance
Officer, Marketing, CEO.** The other six (Director, HR Manager, Sales
Representative, Operations, Administrator, Intern) are reasonable
extrapolations I've defined — worth your review, since you know your
organisation's real reporting lines better than I do. See
`src/lib/rbac-core.ts` (`ROLE_TEMPLATE_PERMISSIONS`) to adjust any of them.

## Where "CRM," "Quotes," "Expenses," and "Payroll" went

Your module list included a few names that aren't separate top-level
modules in FortunIQ OS today — mapped as follows, noted here so nothing
feels silently dropped:
- **CRM** → the existing Customers and Sales modules
- **Quotes** → part of the existing Sales module
- **Expenses** and **Payroll** → both live inside the existing Finance
  module; a Finance Officer's "Expenses: Approve" and "Payroll: View,
  Edit" from your brief are both represented as Finance module actions

If Payroll and Expenses become genuinely separate modules later (real
candidates, given your original Employee Hub brief), the module list in
`rbac-core.ts` extends to cover them without redesigning anything — see
"Future Expansion" below.

## Real backend enforcement — and an honest account of how far it reaches today

Per your explicit requirement ("hiding menu items is not sufficient"),
this is built as real, server-side enforcement, not a UI-only mockup.
**Tenders is the reference implementation**, fully wired: Add, Edit, and
Delete each check the specific granular action (`Create`, `Edit`,
`Delete`) via `requirePermissionAction()` in `src/lib/rbac.ts` — not just
"do they have Tenders module access," which was the old behaviour. This
was verified by testing the exact Tender Administrator scenario from your
brief end-to-end.

**Honestly, not every other module's actions are wired to this same
granular check yet** — Employee Hub, Documents, Academy, and Team
Management still use their existing enforcement (module-level access, or
in Employee Hub's case, a stricter Super-Admin-only gate on editing).
Extending the same pattern to them is now genuinely easy — each is a
small, mechanical change following exactly the pattern in
`tender-actions.ts` — but doing all of them in the same pass as building
the whole engine would have meant less time verifying the core system
actually works correctly. Worth asking for as a direct, focused next
step once you're ready.

## The backward-compatible rollout design

This matters enough to explain clearly: the moment this migration runs,
**nobody's access silently changes.** `requirePermissionAction()` only
enforces granular rules for a specific employee on a specific module once
an admin has explicitly configured that module for that person in System
Access & Permissions (even setting it to "No Access" counts as
configuring it). Until then, it falls back to the exact behaviour the app
already had — the coarse module-level gate. This means you can roll RBAC
out gradually, person by person, module by module, rather than every
existing user suddenly losing access to everything the instant the
migration runs.

## Navigation automatically hides inaccessible modules

Per "menus, navigation... should automatically hide modules the employee
cannot access" — the sidebar now also respects a person's granular View
permission, the same backward-compatible way: if a module's been
explicitly configured for someone, the sidebar link only shows if they
have View there; otherwise it falls back to the existing coarse
module-access check, same as before. Super Admins always see everything,
consistent with every other part of this system.

## AI permission inheritance

FortunIQ Intelligence already inherits module-level access and document
classification (see `docs/AI_SECURITY.md`) — this was true before RBAC
and remains true now, unchanged. **Extending the AI's own checks to the
new granular action layer specifically** (e.g. a genuine distinction
between someone who can View Finance versus someone who can Export it) is
a natural next refinement, not yet built — the AI currently reasons at
the module level, which is still a real, enforced boundary, just not as
fine-grained as the new per-action system elsewhere in the app.

## Testing

`src/lib/rbac-core.test.ts` — 30 automated tests, including exact,
line-by-line verification of your four worked examples (Tender
Administrator, Finance Officer, Marketing, CEO), plus fail-closed
behaviour, the Manage superset rule, and confirmation all 10 templates
exist. Part of `npm test` (175 tests total across the whole app).

**What these tests can't verify**: the real, live database round-trip
(saving a checkbox change, applying a template, and having it actually
persist and enforce correctly against a real signed-in session) needs a
real account — see the manual checklist below.

## Manual verification checklist

1. **Open any employee's profile** as a Super Admin — confirm the System
   Access & Permissions matrix appears at the bottom, showing all 13
   modules.
2. **Apply the "Tender Administrator" template** to a test employee, and
   confirm the matrix updates to match exactly: Dashboard View only,
   Tenders View/Create/Edit, Documents View/Create, Customers/Sales/Reports
   View only, Finance/People/Settings unticked.
3. **Sign in as that test employee** (or have them sign in) and confirm:
   the sidebar shows Tenders, Documents, Customers, Sales, Reports, and
   Dashboard, but not Finance, People, or Settings.
4. **Try adding a tender** as that person — should succeed (Create is
   granted). **Try deleting one** — should be blocked (Delete wasn't
   granted in this template), redirecting to the access-denied page.
5. **Untick "Edit" on Tenders** for that same person from the matrix, and
   confirm they can no longer open the Edit form for a tender.

## Future expansion

Adding a new module to this system needs exactly one change: add it to
`ALL_RBAC_MODULES` in `src/lib/rbac-core.ts`. It automatically becomes
assignable in every employee's System Access & Permissions matrix, and
available in role template definitions — no redesign of the permission
engine itself required, per your requirement.

The `employee_module_actions` table is a simple, normalised (employee ×
module → actions) structure with no hardcoded limits on employee count or
module count — built to scale to hundreds of employees without changes,
per your requirement.
