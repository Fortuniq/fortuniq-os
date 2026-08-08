import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Every route requires a signed-in Microsoft account except the sign-in
// page itself and Next.js internals. This is what makes the app genuinely
// "internal only" — without a valid Microsoft 365 login, visitors are
// redirected straight to /auth/signin and never see any real page or data.
export default auth((req) => {
  const isSignedIn = !!req.auth;
  const isSignInPage = req.nextUrl.pathname.startsWith("/auth/signin");

  if (!isSignedIn && !isSignInPage) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|brand).*)"],
};
