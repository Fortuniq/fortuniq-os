# Add/Edit Coverage

A running, honest record of exactly which pages have real in-app
Add/Edit, and which still require Supabase's Table Editor directly. This
gets updated every time a new page gains real Add/Edit — check here
rather than assuming.

## Has real in-app Add/Edit today

| Page | What you can do | Who can do it |
|---|---|---|
| Settings → Team Management | Add people, assign roles, fine-tune module access | Super Admin |
| Documents | Link files from SharePoint, change status, manage classification/access | Everyone with Documents access (classification changes: Super Admin only) |
| Academy → Manage Content | Add/edit Schools, Courses, Lessons, Assessment Questions | Super Admin |
| Employee Hub | Add/edit a full employee profile, add equipment, add certifications, archive (never delete) | Super Admin |
| Tenders | Add/edit/delete tenders | Everyone with Tenders module access |

## Still requires Supabase's Table Editor directly

| Page | What's missing |
|---|---|
| Finance | No form to add an invoice, expense, or supplier |
| Operations | No form to add a fuel order or fleet vehicle |
| Customers | No form to add or edit a customer |
| Sales | No form to add a quote or pipeline deal |

Dashboard, Reports, and Audit Logs aren't editable pages in the same
sense — they're views built from other data, so there's nothing to add
there directly.

## Why access levels differ between pages

This is deliberate, not inconsistent. Two different rules are at work:

- **Tenders** uses the same rule as viewing the page at all — anyone with
  Tenders module access can add/edit/delete, matching the module's
  existing access level (Super Admin and Management by default).
- **Employee Hub and Academy content** are restricted to Super Admin
  specifically, even though HR/Admin can view Employee Hub and Audit
  Logs. Deciding what training every employee receives, or editing
  someone's banking details, is treated as a narrower responsibility than
  ordinary module access — the same reasoning already documented in
  `docs/EMPLOYEE_HUB.md` for why banking/tax fields are restricted beyond
  normal Documents-style access.

If a specific page's access level doesn't match what makes sense for how
your team actually works, that's a one-line change in that page's
`page.tsx` or server actions file — worth raising if something here
doesn't fit.
