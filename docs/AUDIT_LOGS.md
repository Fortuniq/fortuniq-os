# Audit Logs

Visible in-app only to **Super Admin** and **HR/Admin** roles, at
**Audit Logs** in the sidebar (nobody else can see this page, or even
knows it exists in their own navigation).

## What is actually recorded right now

| Event | Where it's logged from |
|---|---|
| Someone signs in | `src/auth.ts` |
| A person's role is changed | `src/app/(app)/settings/team-actions.ts` |
| A person's individual module access is fine-tuned | same file |
| A new person is added to the team | same file |
| A person is removed from the team | same file |
| A document's status changes (Draft/Approved/Archived) | `src/app/(app)/documents/document-actions.ts` |
| A document is catalogued from SharePoint | same file |
| A document is previewed/opened | `src/app/api/sharepoint/preview/route.ts` |

Every entry records: who (email + name), what action, what it was done to,
when, and — where relevant — what changed (e.g. old role → new role).

## What is honestly NOT recorded yet, and why

You originally asked for audit logging on **customer changes** and
**employee record changes** specifically. **Employee record changes are
now logged** — adding, editing, or archiving an employee, and adding
equipment or certifications, all go through the real Add/Edit forms
described in `docs/EMPLOYEE_HUB.md` and `docs/ADD_EDIT_COVERAGE.md`, and
each one calls `logAudit()` the same way Team Management and Documents do.

**Customer changes are still not logged**, for the same reason employee
changes weren't until recently: **there is currently no way to create or
edit a customer record from inside FortunIQ OS at all.** Editing that
data still means using Supabase's Table Editor directly, completely
outside the app's reach.

This remains a gap in the underlying feature, not the logging itself —
the moment a real in-app Add/Edit form exists for Customers, adding audit
logging to it is a small, mechanical addition, following the exact same
pattern already used for Documents, Team Management, Academy, and now
Employee Hub and Tenders.

**In the meantime**, anyone with direct Supabase access (which should
only ever be you, as the project owner, plus anyone you've explicitly
given Supabase login access to — never your FortunIQ OS team, who only
ever interact with the app itself) can make changes to this data with no
audit trail. Treat direct Supabase access with the same care as a master
key.

## How to read an entry

Each row shows:
- **When** it happened
- **Who** did it (name and email)
- **What** kind of action it was, with a small coloured tag
- **Details** — for role and status changes, this shows the before → after
  values directly

## Retention

Entries are kept indefinitely by default — there's no automatic deletion.
If your audit log table grows very large over time (years of daily use),
consider periodically archiving older entries; this isn't necessary for
normal use in the near term.

## Extending this to log something new

Every logged action follows the same three-line pattern, using the
`logAudit()` helper in `src/lib/audit.ts`:

```typescript
import { logAudit } from "@/lib/audit";

await logAudit({
  actorEmail: permissions.email!,
  actorName: permissions.name,
  action: "your_new_action_name",
  targetType: "whatever this action affects",
  targetId: "an ID for that thing",
  targetLabel: "a human-readable name for it",
  metadata: { anything: "extra you want to record" },
});
```

Add the call at the point in the code where the action actually happens
(inside the relevant Server Action or API route), and it'll show up in
Audit Logs automatically — you'll also want to add a friendly label and
icon for the new action type in `src/app/(app)/audit/audit-view.tsx`
(`ACTION_META`), otherwise it'll still show up, just without the nice
formatting.
