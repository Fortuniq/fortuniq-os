import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER, // e.g. https://login.microsoftonline.com/<tenant-id>/v2.0
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
  },
  trustHost: true,
});
