import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

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
    async session({ session }) {
      return session;
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