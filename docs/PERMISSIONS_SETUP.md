# Setting up Admin & Permissions

This is a two-part step: one small database migration (5 minutes), then
everything else happens inside the app itself — no more file editing or
Netlify configuration needed for this part.

## Step 1 — Run the migration

Same process as before:

1. Open your Supabase project → **SQL Editor** → **New query**
2. Open `supabase/migration_v3_add_permissions.sql` from this project,
   copy the whole file, paste it in, and click **Run**

This adds one new table (`user_permissions`) that controls who can sign in
and what each person can see. It doesn't touch any of your existing data.

## Step 2 — Sign in as yourself, first

This part matters: **the very first person to sign in after running this
migration automatically becomes the first Administrator**, with access to
every module. Make sure that's you — sign in to the live app once, right
after running the migration, before telling anyone else about it.

If someone else signs in first by accident, don't worry — see
"Fixing a mistake" below.

## Step 3 — Add your team

Once you're signed in as the first Admin:

1. Go to **Settings** in the sidebar
2. You'll see a **Team Management** panel (only Admins see this section)
3. Click **Add Person**, enter someone's work email (the same one they'll
   use to sign in with Microsoft), and their name
4. They'll start with just Dashboard and Settings access — tick the boxes
   for whatever else they should see (e.g. tick "Sales" and "Customers"
   for a salesperson, leave "Finance" unticked for Marketing)
5. To make someone else an Admin too, click **"Make admin"** next to their
   name — this gives them every module automatically, and the ability to
   manage the team themselves

That's it — changes apply immediately. The next time that person signs in
(or refreshes the app if already signed in), they'll see exactly the
modules you've granted them, nothing more.

## How access is decided, in plain terms

- **Not on the list at all**: if someone signs in with Microsoft but an
  Admin hasn't added them yet, they see a polite "ask your administrator"
  screen instead of the app — they can't see anything.
- **On the list, not an Admin**: they see exactly the modules ticked for
  them, plus Dashboard and Settings (always available to everyone, so
  nobody hits a dead end).
- **Admin**: sees and can manage everything, including the Team Management
  panel itself.

## Fixing a mistake

**Wrong person became the first Admin?** As an existing Admin, go to
Settings → Team Management, and click "Make admin" on the correct
person's row (add them first if needed). You can't remove your *own* admin
rights or delete your *own* account from inside the app (to prevent
accidentally locking everyone out) — if you genuinely need to remove the
original admin, do it from Supabase's Table Editor directly, in the
`user_permissions` table.

**Need to reset everything and start over?** Delete all rows from the
`user_permissions` table in Supabase's Table Editor. The next person to
sign in becomes the new first Admin, same as the original setup.
