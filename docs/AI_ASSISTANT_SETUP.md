# Connecting the AI Assistant

The AI Assistant page and its example prompts already work right now —
what's missing until you complete this step is a real API key, so it
currently shows a friendly message explaining that instead of an answer.

This takes about 5 minutes.

## Step 1 — Create an Anthropic account and get an API key

1. Go to **console.anthropic.com** and sign up (or log in)
2. You'll likely need to add billing details — the AI Assistant uses
   Claude's API on a pay-per-use basis. Costs are small for internal use
   at your team's scale (a typical request costs a fraction of a cent to a
   few cents depending on length), but it isn't free the way Supabase's
   free tier is.
3. Once logged in, go to **Settings → API Keys**
4. Click **Create Key**, give it a name like "FortunIQ OS", and copy the
   key it gives you — it starts with `sk-ant-`. Like the Microsoft client
   secret earlier, this is shown to you only once.

## Step 2 — Add it to your app

Same process as every other credential so far:

1. Open `.env.local` and add:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-real-key-here
   ```
2. Add the same key/value to **Netlify → Site configuration → Environment variables**
3. Push the change to GitHub (via GitHub Desktop, same as before) if you
   haven't already deployed this update

## Step 3 — Test it

1. Open the app, go to **AI Assistant**
2. Click one of the example prompts, or type your own
3. You should get a real, written response within a few seconds

## A few practical notes

- **Cost control**: Anthropic lets you set a monthly spending cap in the
  console, which is worth doing for peace of mind — Settings → Billing →
  Usage limits.
- **What it can see**: right now, the AI Assistant answers from general
  knowledge and whatever you type to it — it does not yet automatically
  pull in your real tenders, invoices, or customer data to answer
  questions like "summarise this tender" unless you paste the relevant
  text into the chat yourself. Wiring it up to read live data from
  specific modules (e.g. "summarise tender GDOH-2026-114" pulling the
  real record automatically) is a good next step once this basic
  connection is working.
- **Who can use it**: since the AI Assistant page sits behind the same
  Microsoft Login as everything else, only signed-in FortunIQ Fuels staff
  can use it — there's no separate access control to set up.
