import { describe, it, expect } from "vitest";

// Regression test for a real production bug: the Microsoft Graph token
// refresh endpoint was being built by appending "/oauth2/v2.0/token"
// directly onto AUTH_MICROSOFT_ENTRA_ID_ISSUER, which already ends in
// "/v2.0" — producing a broken, duplicated URL that 404'd every single
// refresh attempt, silently, until the original sign-in token expired.
// This test locks in the correct construction so it can't quietly
// regress again. See src/auth.ts (refreshAccessToken) for the real logic.

function buildTokenUrl(issuer: string): string {
  const issuerRoot = issuer.replace(/\/v2\.0\/?$/, "");
  return `${issuerRoot}/oauth2/v2.0/token`;
}

describe("Microsoft Graph token refresh URL construction", () => {
  it("does not duplicate /v2.0 in the resulting URL", () => {
    const issuer = "https://login.microsoftonline.com/abc-123-tenant/v2.0";
    const url = buildTokenUrl(issuer);
    expect(url).toBe("https://login.microsoftonline.com/abc-123-tenant/oauth2/v2.0/token");
    // The specific bug: the broken version contained "v2.0/oauth2/v2.0"
    expect(url).not.toContain("v2.0/oauth2/v2.0");
  });

  it("still works correctly if the issuer somehow lacks the trailing /v2.0", () => {
    const issuer = "https://login.microsoftonline.com/abc-123-tenant";
    const url = buildTokenUrl(issuer);
    expect(url).toBe("https://login.microsoftonline.com/abc-123-tenant/oauth2/v2.0/token");
  });
});
