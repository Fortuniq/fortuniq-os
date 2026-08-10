import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { logAudit } from "@/lib/audit";

// The one, fixed, correct public address for this app. Used below to force
// every sign-in redirect to the right place, regardless of what internal
// hostname Netlify's infrastructure might otherwise report.
const CANONICAL_URL = process.env.AUTH_URL || "https://fortuniq-os.netlify.app";

// Scopes requested at sign-in. Beyond basic sign-in (openid/profile/email/
// User.Read), this now also asks for read access to SharePoint files and
// sites — required for the Documents module to work as a real SharePoint-
// backed system. "offline_access" is what lets us silently refresh access
// without asking the person to sign in again every hour.
const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Files.Read.All",
  "Sites.Read.All",
].join(" ");

type JWTWithGraphToken = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  error?: "RefreshAccessTokenError";
  [key: string]: unknown;
};

async function refreshAccessToken(token: JWTWithGraphToken): Promise<JWTWithGraphToken> {
  try {
    const url = `${process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER}/oauth2/v2.0/token`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
        client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken ?? "",
        scope: SCOPES,
      }),
    });

    // Read as text first — Microsoft's token endpoint can occasionally
    // return an empty or non-JSON body on certain error conditions, and
    // calling .json() directly on that throws an unhelpful "Unexpected
    // end of JSON input" that hides the real problem. This way we always
    // get a clear log of what actually came back.
    const rawBody = await response.text();
    let refreshed: Record<string, unknown>;
    try {
      refreshed = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.error("Microsoft Graph token refresh: non-JSON response, status", response.status, "body:", rawBody.slice(0, 300));
      // Back off for 5 minutes rather than retrying on every single
      // request — the person stays signed in with their existing
      // session; only SharePoint-dependent features (Documents preview,
      // search, and the AI reading SharePoint content) are affected
      // until the next successful refresh.
      return { ...token, accessTokenExpires: Date.now() + 5 * 60 * 1000, error: "RefreshAccessTokenError" as const };
    }

    if (!response.ok) {
      console.error("Microsoft Graph token refresh failed:", response.status, refreshed);
      return { ...token, accessTokenExpires: Date.now() + 5 * 60 * 1000, error: "RefreshAccessTokenError" as const };
    }

    return {
      ...token,
      accessToken: refreshed.access_token as string,
      accessTokenExpires: Date.now() + (refreshed.expires_in as number) * 1000,
      refreshToken: (refreshed.refresh_token as string) ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("Failed to refresh Microsoft Graph access token:", error instanceof Error ? error.message : error);
    // Same backoff as above — avoid hammering Microsoft's endpoint (and
    // filling the logs) on every request when something's genuinely wrong.
    return { ...token, accessTokenExpires: Date.now() + 5 * 60 * 1000, error: "RefreshAccessTokenError" as const };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: { params: { scope: SCOPES } },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  // Security hardening: sessions expire after 8 hours of being issued,
  // and are refreshed (re-issued for another 8 hours) whenever the person
  // is actively using the app within that window. This means someone
  // genuinely idle overnight is signed out and must sign in again, rather
  // than a session staying valid indefinitely. See docs/SECURITY.md.
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // re-issue at most once per hour of activity
  },
  callbacks: {
    // Runs when a person signs in, and on every subsequent request. Stores
    // the Microsoft Graph access token (and refreshes it automatically
    // when it's about to expire) so server-side code can call SharePoint
    // on this person's behalf — with exactly their own permissions, never
    // more.
    async jwt({ token, account, user }) {
      let t = token as JWTWithGraphToken;
      if (account) {
        t = {
          ...t,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : undefined,
        };
        // This branch only runs on a fresh sign-in (account is only
        // present here right after the OAuth handshake) — exactly once
        // per sign-in, not on every page load. That makes it the right
        // place to record a sign-in audit event.
        if (user?.email) {
          logAudit({
            actorEmail: user.email,
            actorName: user.name,
            action: "sign_in",
          });
        }
        return t;
      }
      if (t.accessTokenExpires && Date.now() < t.accessTokenExpires - 60_000) {
        return t;
      }
      if (!t.refreshToken) return t;
      return refreshAccessToken(t);
    },
    // Exposes the Graph access token to server-side code via the session
    // object (see src/lib/graph.ts). Never sent to the browser as part of
    // any client-visible session data beyond what's needed.
    async session({ session, token }) {
      const t = token as JWTWithGraphToken;
      return {
        ...session,
        accessToken: t.accessToken,
        error: t.error,
      };
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${CANONICAL_URL}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url.replace(baseUrl, CANONICAL_URL);
      } catch {}
      return CANONICAL_URL;
    },
  },
  trustHost: true,
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}
