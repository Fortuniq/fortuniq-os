# Connecting FortunIQ OS to a real database

This takes about 10 minutes. Once it's done, every page switches from mock
data to your real Supabase database automatically — no code changes needed.

## 1. Create your Supabase project

1. Go to **supabase.com** and sign up (free tier is enough to start)
2. Click **New Project**
3. Choose a name (e.g. `fortuniq-os`), set a database password (save it
   somewhere safe — you likely won't need it day-to-day, but you will if you
   ever connect a third-party tool directly to the database), and pick a
   region close to South Africa (e.g. `eu-west-1`)
4. Wait about 2 minutes for the project to finish provisioning

## 2. Create the tables

1. In your new project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `supabase/schema.sql` from this project, copy the whole file, paste
   it in, and click **Run**
4. Repeat the same steps with `supabase/seed.sql` — this fills the tables
   with the same starter data you've already seen in the app, but now it's
   real and editable
5. Click **Table Editor** in the sidebar to confirm you can see the tables
   (`employees`, `courses`, `tenders`, etc.) with data in them

## 3. Get your API keys

1. Click **Settings** (gear icon) → **API**
2. You'll need two values from this page:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

## 4. Connect the app

1. In the project folder, copy `.env.local.example` to a new file named
   `.env.local`
2. Paste in your Project URL and anon key from step 3
3. Restart the app (`npm run dev` again if it's running)

That's it — refresh the app in your browser and every module is now reading
from your real database.

## 5. When you deploy (Vercel / Netlify)

Add the same two variables in your hosting platform's dashboard:

- **Vercel**: Project → Settings → Environment Variables
- **Netlify**: Site configuration → Environment variables

Use the exact same variable names: `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Editing data

For now, the fastest way to add or edit real records (a new employee, a new
tender) is directly in Supabase's **Table Editor** — it works like a
spreadsheet. Building proper "Add" and "Edit" forms inside the app itself
(so your team never needs to open Supabase directly) is a good next step
once the database is connected and working.

## Security note

Row Level Security is already turned on for every table, with a policy that
allows any **logged-in** user to read and write. Right now, since Microsoft
Login isn't wired up yet, there's technically no login gate at the database
level either — treat the current deployment as accessible to anyone with
the link until real authentication is connected. That's the natural next
step after this one.
