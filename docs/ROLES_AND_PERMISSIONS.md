# Roles & Permissions

FortunIQ OS uses six named roles. Assigning a role to someone in
**Settings → Team Management** immediately sets their access to that
role's defaults below — an Admin can still fine-tune an individual
person's exact modules afterwards if one specific person genuinely needs
an exception (the "Fine-tune" option next to their name).

## The full access matrix

| Module | Super Admin | Management | HR/Admin | Finance | Sales/Marketing | Employee |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| People | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Academy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenders | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Finance | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Operations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Customers | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Sales | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| AI Assistant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Logs | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Team Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

This exact table is also encoded as an automated test — see "Testing" below.

## The reasoning behind each role

**Super Admin** — full access to everything, including the two
meta-capabilities (Team Management and Audit Logs) that no other role
gets. Only give this to people who genuinely need to manage who else has
access. You became the first Super Admin automatically when you first
signed in after setup.

**Management** — for people who need broad, cross-functional visibility
(e.g. the COO, an executive) but aren't responsible for administering the
system itself. Sees everything Super Admin does *except* Team Management
and Audit Logs — deliberately, since overseeing the business and
overseeing who-has-access-to-what are different responsibilities.

**HR/Admin** — People, Academy, Documents, and Audit Logs (since you told
us HR should be able to monitor the audit trail alongside Super Admin).
Deliberately excludes Finance, Sales, Customers, Tenders, and Operations —
HR doesn't need visibility into commercial figures to do HR work.

**Finance** — Finance, Reports, Documents, Academy. Deliberately excludes
People — this is the direct answer to "Finance must not see HR
information they shouldn't see."

**Sales/Marketing** — Customers, Sales, Reports, Documents, Academy.
Deliberately excludes Finance — the direct answer to "Marketing must not
see confidential finance records." Tenders is also excluded by default,
since tender values often reveal pricing/margin information that's
finance-adjacent — if your Sales team genuinely needs Tenders visibility,
that's a reasonable one-person "Fine-tune" exception rather than a
blanket default.

**Employee** — the default, most restrictive role. Dashboard, Academy,
Documents, AI Assistant, Settings only. This is what a new person gets
automatically when added, and what interns should stay on — the direct
answer to "Interns must not have admin access." There is no path from
Employee to any admin capability without a Super Admin explicitly
changing their role.

## A few deliberate design choices worth knowing about

- **Dashboard and Settings are always available to everyone provisioned**,
  regardless of role. This is intentional — everyone needs a home page to
  land on, and everyone should be able to see their own access status in
  Settings, even if nothing else is granted.
- **AI Assistant is available to every role**, including Employee. This
  was a deliberate call: the assistant only ever answers from what's typed
  to it directly, plus company documents explicitly marked Approved (see
  docs/SHAREPOINT_SETUP.md) — it doesn't expose Finance, People, or any
  other module's live data just by being enabled. If that reasoning
  doesn't match how you want to run things, restricting AI Assistant per
  role is a one-line change in `src/lib/permissions-core.ts`.
- **Academy and Documents are available to every role.** Training content
  and general company documents (policies, SOPs, certificates) aren't
  treated as sensitive by default. If specific documents genuinely need
  tighter restriction than "everyone with Documents access can see the
  metadata," that would need a further access-control layer within the
  Documents module itself — not built yet.

## Changing a role's defaults

The defaults live in one place: `ROLE_DEFAULT_MODULES` in
`src/lib/permissions-core.ts`. Change the array for a role, and:

1. Update the table at the top of this file to match
2. Update the `EXPECTED` matrix in `src/lib/permissions.test.ts` to match
3. Run `npm test` to confirm everything's consistent

Existing team members already assigned that role keep whatever modules
they currently have — changing the default doesn't retroactively change
people already on that role. Re-assign their role from Team Management
(pick a different role, then back) if you want to push the new defaults
to them specifically.

## Testing

Run `npm test` at any time to verify the entire permission system
behaves exactly as documented — 105 automated tests cover every role
against every module, plus the three specific requirements you gave:
Finance can't see People, Sales/Marketing can't see Finance, and Employee
has no path to admin access. See `src/lib/permissions.test.ts`.

**What automated tests can and can't tell you:** these tests verify the
*logic* is correct — given a role, exactly the right modules are
allowed and no others. They run instantly and don't need a real database
or Microsoft account. What they *can't* verify is your actual live
deployment — whether the right role is really assigned to the right
person, whether a real signed-in session correctly resolves to that role,
and so on. For that, do a real, live walkthrough — see
"Manual verification checklist" below.

## Manual verification checklist

Do this once after deploying this update, using real (or temporary test)
accounts:

1. **Create a test person for each role** you actually use (or reassign
   a real colleague's role temporarily with their knowledge) — Finance,
   Sales/Marketing, HR/Admin, Employee at minimum.
2. **Sign in as each one** and confirm the sidebar shows exactly the
   modules from the table above — nothing more, nothing less.
3. **Try to visit a restricted module directly by typing its URL**
   (e.g. a Sales/Marketing person typing `/finance` into the address bar)
   — confirm you land on the "You don't have access" page, not the real
   module.
4. **Confirm Audit Logs is only visible** to your Super Admin and
   HR/Admin test accounts.
5. **Confirm Team Management is only visible** to your Super Admin test
   account.

Once you've done this once for real, you can trust the automated tests to
catch any future regressions without repeating the full manual walkthrough
every time.
