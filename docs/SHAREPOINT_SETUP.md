# Connecting SharePoint as the Document Management System

This is a bigger integration than the earlier setup steps, since it touches
both your Microsoft 365 admin settings and a SharePoint site. Take it in
order — about 20 minutes.

## How this works, in plain terms

- **Files themselves live in SharePoint** — FortunIQ OS never stores the
  actual documents.
- **Supabase stores only a pointer**: the document's name, category, owner,
  version, its status (Draft/Approved/Archived), and a link to where it
  really lives in SharePoint.
- **Every request to SharePoint uses the signed-in person's own Microsoft
  identity.** This is deliberate and important: if someone doesn't have
  permission to open a file in SharePoint directly, they won't be able to
  see it through FortunIQ OS either — there's no shared "master" account
  that bypasses this.

## Step 1 — Add the extra permissions to your existing app registration

You already registered FortunIQ OS in Microsoft Entra ID for sign-in — we're
adding to that same registration, not creating a new one.

1. Go to **entra.microsoft.com** → **Identity** → **Applications** →
   **App registrations** → open **FortunIQ OS** (the one you created earlier)
2. Click **API permissions** in the left menu
3. Click **+ Add a permission**
4. Choose **Microsoft Graph**
5. Choose **Delegated permissions**
6. Search for and tick: **Files.Read.All**
7. Search for and tick: **Sites.Read.All**
8. Click **Add permissions**
9. You'll now see a yellow banner about admin consent — click **Grant admin
   consent for [your organisation]**, then confirm. Since you're a Global
   Administrator, this works in one click.

## Step 2 — Decide which SharePoint site holds your documents

This can be an existing SharePoint site, or a new one created specifically
for this. Either way, you need its URL — it looks like:
```
https://yourtenant.sharepoint.com/sites/YourSiteName
```

If you don't have one yet: go to **sharepoint.com**, sign in, click
**+ Create site**, choose **Team site**, and give it a name like
"FortunIQ Documents." Copy its URL once created.

## Step 3 — Add the site URL to your app

Same process as every credential so far:

1. Add to `.env.local`:
   ```
   SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/YourSiteName
   ```
2. Add the same to Netlify's environment variables

## Step 4 — Run the database migration

1. Supabase → SQL Editor → New query
2. Paste and run `supabase/migration_v4_add_sharepoint.sql`
3. This adds a few columns to your existing `documents` table — no data is lost

## Step 5 — Push and redeploy

Same process as always: copy the updated project files into your GitHub
Desktop folder, commit, push, then Netlify → Trigger deploy → Deploy
project without cache.

## Step 6 — Important: everyone needs to sign in again

Because this adds new permissions to what the app can ask Microsoft for,
**everyone's existing sign-in session needs refreshing** — including
yours. The simplest way: have everyone (yourself included) sign out and
sign back in once, after this update is live. Their next sign-in will
include a prompt asking them to approve the new SharePoint access — this
is expected and correct.

## Step 7 — Test it

1. Go to **Documents**
2. Click **Browse SharePoint** — you should see the files already in your
   SharePoint site
3. Click **Add to Documents** on one of them
4. Try the **Preview** and **Version History** buttons on that document
5. Try the search bar

## How approval and the AI Assistant connect

Every catalogued document starts as **Draft**. Use the status dropdown in
the Documents table to mark ones that are finalised as **Approved** — only
Approved documents are ever visible to the AI Assistant. Draft and Archived
documents are invisible to it, even if you ask about them directly.

## Known limitation: what the AI can actually read

The AI Assistant can always see the *names and categories* of Approved
documents. For actual document *content* (so it can summarise or quote
from a document, not just know it exists), this currently only works
reliably for plain text files (`.txt`, `.md`). Word documents, PDFs, and
Excel files come back from Microsoft as binary data that isn't parsed into
readable text in this version — the AI will know the document exists, but
won't be able to read what's inside it yet. Teaching it to properly extract
text from Office formats is a good next enhancement, using either Microsoft
Graph's file conversion features or a dedicated document-parsing library.

## Troubleshooting

**"SharePoint isn't connected yet" message won't go away** — double-check
`SHAREPOINT_SITE_URL` is set in both `.env.local` and Netlify, and that
you've redeployed since adding it.

**"Couldn't reach SharePoint" when browsing** — most likely the admin
consent step (Step 1) wasn't completed, or the person needs to sign out
and back in to pick up the new permissions (Step 6).

**A specific person can't see a file others can** — this is very likely
correct behaviour, not a bug — it means that person genuinely doesn't have
permission to that file in SharePoint itself. Check their access there
first before assuming something's broken.
