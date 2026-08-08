# Connecting real Microsoft Login

This takes about 15 minutes. You'll need your **Global Administrator**
Microsoft 365 login for this — you confirmed you have that, so you're set.

Once this is done, nobody can see any page of FortunIQ OS without signing
in with a real `@iqfuels.co.za` (or whatever your Microsoft 365 domain is)
account. Anyone else trying the link gets bounced straight to a sign-in
screen and can go no further.

---

## Part 1 — Register the app in Microsoft (your side)

### Step 1 — Open the Microsoft Entra admin center

1. Go to **entra.microsoft.com**
2. Sign in with your Global Administrator account

### Step 2 — Start a new app registration

1. In the left-hand menu, find **Identity** → **Applications** → **App registrations**
   *(if you don't see "Identity" immediately, use the search bar at the top and type "App registrations")*
2. Click **+ New registration**

### Step 3 — Fill in the registration form

1. **Name**: type `FortunIQ OS`
2. **Supported account types**: choose the option that says
   **"Accounts in this organizational directory only"** (it may show your
   company name). This is the important one — it's what makes sure only
   people inside FortunIQ Fuels' own Microsoft 365 can ever sign in, not
   the general public.
3. **Redirect URI**:
   - From the dropdown, choose **Web**
   - In the text box next to it, type exactly:
     ```
     https://fortuniq-os.netlify.app/api/auth/callback/microsoft-entra-id
     ```
4. Click **Register**

### Step 4 — Copy two values from the Overview page

You'll land on an "Overview" page for your new app. Copy these two values
somewhere safe (a Notepad window is fine, temporarily):

- **Application (client) ID** — a long code with dashes in it
- **Directory (tenant) ID** — another long code with dashes

### Step 5 — Create a client secret (this is like a password for the app)

1. In the left menu (still inside your app), click **Certificates & secrets**
2. Click **+ New client secret**
3. Add any description (e.g. "FortunIQ OS production")
4. Leave the expiry as default (or choose 24 months)
5. Click **Add**
6. **Immediately copy the value shown under "Value"** — not the "Secret ID"
   column next to it, the **Value** column. This is shown to you only
   once — if you navigate away before copying it, you'll have to create a
   new one.

### Step 6 — Confirm basic permissions are in place

1. In the left menu, click **API permissions**
2. You should already see **User.Read** listed under Microsoft Graph — this
   is the default and is all we need for sign-in. If it's there, you're
   done with this step.
3. If there's a yellow warning banner about needing admin consent, click
   **Grant admin consent for [your organisation]**, then confirm — since
   you're a Global Admin, this will work in one click.

You're done on the Microsoft side. You should now have **three values**
saved somewhere: **Application (client) ID**, **Directory (tenant) ID**,
and the **client secret Value**.

---

## Part 2 — Add these values to your app (your side, but easy)

### Step 1 — Update your local `.env.local` file

Open `.env.local` in Notepad and add these new lines (keep your existing
Supabase lines too):

```
AUTH_MICROSOFT_ENTRA_ID_ID=paste-your-application-client-id-here
AUTH_MICROSOFT_ENTRA_ID_SECRET=paste-your-client-secret-value-here
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/paste-your-tenant-id-here/v2.0
AUTH_SECRET=F4++dG6E1+z9lt2zs37U7f52LUP/DI0kB1Zn5du5yqg=
```

Notes:
- For the `ISSUER` line, keep the `https://login.microsoftonline.com/` and
  `/v2.0` parts exactly as shown — just swap in your Directory (tenant) ID
  in the middle where it says `paste-your-tenant-id-here`.
- The `AUTH_SECRET` value above is already a real, randomly generated
  secret, ready to use as-is — you don't need to create your own.

Save the file (same care as last time — make sure it's still named exactly
`.env.local`, not `.env.local.txt`).

### Step 2 — Add the same values to Netlify

1. Go to your Netlify site → **Site configuration** → **Environment variables**
2. Add each of the four new variables above individually (Key/value pairs
   is easiest for a handful of values like this), using the exact same
   names and values as your `.env.local` file
3. Save

### Step 3 — Push the new code to GitHub

I've made a number of code changes for this (new sign-in page, the login
logic itself, route protection). Since this is a lot of new files rather
than one small edit, use the **re-upload the whole folder** approach this
time rather than editing individual files:

1. Download the fresh project zip I'm providing with this guide
2. Unzip it
3. Go to your GitHub repository → **Add file** → **Upload files**
4. Drag in everything from the unzipped folder **except** `.env.local` and
   `node_modules` (same exclusions as the very first upload)
5. Commit — GitHub will automatically update any files that changed and
   add the new ones
6. Netlify will detect the change and redeploy automatically, same as always

### Step 4 — Test it

Once Netlify finishes redeploying (check the Deploys tab, same as before):

1. Open `fortuniq-os.netlify.app` in an incognito/private window
2. You should be redirected straight to a **black sign-in screen** with a
   "Sign in with Microsoft" button — if you see the dashboard instead
   without signing in, something's not connected yet
3. Click it, sign in with your real Microsoft 365 account
4. You should land on the real Dashboard, and your actual name should now
   appear in the top-right corner instead of "Thabo Mokoena"

Let me know what happens at each step — as always, if something doesn't
look right, tell me exactly what you see and we'll pin it down together.
