import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

// The one, fixed, correct public address for this app. Used below to force
// every sign-in redirect to the right place, regardless of what internal
// hostname Netlify's infrastructure might otherwise report.
const CANONICAL_URL = process.env.AUTH_URL || "https://fortuniq-os.netlify.app";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    // Runs every time a session is checked. Keeps the user's name/email/photo
    // available to the app (see TopBar.tsx) without extra API calls.
    async session({ session }) {
      return session;
    },
    // Forces every redirect (including the one sent to Microsoft as the
    // "come back here" address) to use our known-correct public URL,
    // instead of trusting whatever internal hostname the request claims.
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
