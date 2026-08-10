# Security

This covers every item from the security hardening request, what's
actually been built into the app, and what's a configuration step on your
side (with exact instructions where that's the case).

## 1. Session expiry — done, in app code

Sessions now expire after **8 hours**, and are quietly renewed for
another 8 hours whenever someone is actively using the app within that
window. Someone who leaves a tab open overnight will find themselves
signed out and asked to sign in again — a session doesn't stay valid
indefinitely. Configured in `src/auth.ts` (`session.maxAge`). Change the
number there if 8 hours doesn't suit how your team works.

## 2. MFA through Microsoft — a setting on your side, not app code

This can't be done in FortunIQ OS's own code — sign-in security is
entirely Microsoft's responsibility once someone reaches the Microsoft
sign-in screen. The good news: this is genuinely simple to turn on, and
your Business Standard licence includes what you need.

### Turn on Security Defaults (free, available on your current licence)

1. Go to **entra.microsoft.com**, sign in with your Global Administrator account
2. **Identity** → **Overview** → **Properties** (left-hand menu)
3. Scroll down and click **Manage Security Defaults**
4. Toggle **Enable Security Defaults** to **Yes**
5. Save

This requires MFA for every user in your organisation, enforced by
Microsoft itself — before someone even reaches FortunIQ OS's sign-in
screen. It applies to everyone automatically, with no per-app
configuration needed.

### If you later want more granular control (Conditional Access)

Conditional Access lets you do things like "only require MFA when signing
in from an unfamiliar location" instead of every single time. This needs
**Microsoft Entra ID P1**, which isn't included in Business Standard —
it's either a standalone add-on or comes bundled with Microsoft 365
Business Premium. Not necessary to get real MFA protection today —
Security Defaults above already provides that — just worth knowing if you
want finer control later.

## 3. Secure environment variables — audited, one real bug found and fixed

Every secret credential (`SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`) is
deliberately **not** prefixed with `NEXT_PUBLIC_`, which is what keeps
Next.js from ever bundling them into code the browser can see. Verified
directly against the source — nothing sensitive carries that prefix.

`.env.local` is excluded from Git via `.gitignore`, so it's never
accidentally pushed to GitHub — confirmed as part of this audit.

**One real bug found and fixed during this pass:** the Settings page's
"Database Connected" indicator was checking for the wrong environment
variable (the public anon key, rather than the private service role key
the app actually uses for every query). In an edge case — service role
key missing, anon key present — this could have shown "Connected" while
silently running on fallback data behind the scenes. Fixed in
`src/lib/data.ts`.

## 4. Row Level Security in Supabase — hardened, made deliberate

Every table already had Row Level Security turned on. The gap: most
tables were protected by a policy that happened to always evaluate to
"deny" for the public key — not because it was written to explicitly deny
it, but because of a technicality in how this app's authentication works
(Microsoft sign-in, not Supabase's own auth system, so the public key is
never "authenticated" in Supabase's own sense).

`supabase/migration_v6_security_hardening.sql` replaces every one of
those with an explicit, unambiguous **deny all public access**, full
stop — the same real-world result, but no longer dependent on that
coincidence, so it stays correct even if something about your setup
changes later. `schema.sql` has also been updated so a brand new install
gets the deliberate version from day one.

This doesn't affect the app itself at all — every real read and write
already goes through a separate, private, server-only connection
(`src/lib/supabase/service.ts`) that intentionally bypasses these
policies, because FortunIQ OS's real access control happens in the app
itself (Microsoft Login + the roles system), not in Supabase. RLS here is
a second, independent safety net specifically against the scenario where
someone gets hold of your public anon key and tries querying Supabase
directly, bypassing the app entirely.

## 5. Restrictions on file types/uploads — not currently applicable

FortunIQ OS doesn't currently have a file *upload* feature anywhere in
the app itself — Documents links to files that already exist in
SharePoint, rather than accepting uploads directly. All file storage and
upload rules are governed by SharePoint's own settings, not FortunIQ OS's
code.

If a direct upload feature is built later (profile photos, email
attachments, tender document uploads, etc.), it should specifically
restrict allowed file types (e.g. reject `.exe`, `.bat`) and enforce a
reasonable size limit at that point — flagging this here as a requirement
for whoever builds that feature, not something to add speculatively now.

## 6. Rate limiting — built, on the AI Assistant

The AI Assistant is limited to **30 messages per person per hour**,
tracked in a new `rate_limit_events` Supabase table (no external service
like Redis needed). Someone who hits the limit gets a clear message and
can try again shortly after. This is the endpoint that costs real money
per request, so it's the one that mattered most to protect against a
runaway loop, bug, or misuse.

The other API routes (SharePoint browse/search/preview) aren't currently
rate-limited — they're protected by requiring sign-in and respecting each
person's own Microsoft/SharePoint permissions, but not by a request-count
limit. If SharePoint browsing becomes a target for abuse in practice, the
same `checkRateLimit()` helper in `src/lib/rate-limit.ts` can be added to
those routes with one line, following the same pattern used for the AI
Assistant.

## 7. Protection of API keys — audited

Summary of what protects each credential:

| Key | Where it lives | Exposed to browser? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Server only | Never |
| `AUTH_SECRET` | Server only | Never |
| `ANTHROPIC_API_KEY` | Server only | Never |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server + browser | Yes — by design, this one is meant to be public |
| `NEXT_PUBLIC_SUPABASE_URL` | Server + browser | Yes — just a URL, not a secret |

Only the two `NEXT_PUBLIC_` values are ever visible to anyone inspecting
the browser — and that's expected and safe, since the anon key alone
can't do anything without also passing Supabase's Row Level Security
(see #4), which now denies it outright.

No error message anywhere in the app echoes back a raw API key or secret
value — confirmed by reviewing every `catch` block that returns an error
to the client.
