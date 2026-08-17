import { describe, it, expect } from "vitest";
import {
  canTransitionStatus, isActiveDocument, isExpiringSoon, isExpired,
  daysUntilExpiry, nextVersionNumber, archivedFileName,
} from "./documents-core";

const TODAY = new Date("2026-08-17T09:00:00");

describe("canTransitionStatus", () => {
  it("allows the normal forward path: Draft -> Pending Approval -> Approved -> Published", () => {
    expect(canTransitionStatus("Draft", "Pending Approval")).toBe(true);
    expect(canTransitionStatus("Pending Approval", "Approved")).toBe(true);
    expect(canTransitionStatus("Approved", "Published")).toBe(true);
  });

  it("allows a rejected approval to send a document back to Draft", () => {
    expect(canTransitionStatus("Pending Approval", "Draft")).toBe(true);
  });

  it("allows any non-archived status to move straight to Archived", () => {
    expect(canTransitionStatus("Draft", "Archived")).toBe(true);
    expect(canTransitionStatus("Approved", "Archived")).toBe(true);
    expect(canTransitionStatus("Published", "Archived")).toBe(true);
  });

  it("does not allow skipping straight from Draft to Published", () => {
    expect(canTransitionStatus("Draft", "Published")).toBe(false);
  });

  it("does not allow an Archived document to jump straight back to Published", () => {
    expect(canTransitionStatus("Archived", "Published")).toBe(false);
  });

  it("allows restoring an Archived document, but only back to Draft", () => {
    expect(canTransitionStatus("Archived", "Draft")).toBe(true);
  });

  it("treats staying in the same status as always allowed (a no-op save)", () => {
    expect(canTransitionStatus("Approved", "Approved")).toBe(true);
  });
});

describe("isActiveDocument", () => {
  it("only Published counts as the active version of record", () => {
    expect(isActiveDocument("Published")).toBe(true);
    expect(isActiveDocument("Approved")).toBe(false);
    expect(isActiveDocument("Draft")).toBe(false);
  });
});

describe("isExpiringSoon", () => {
  it("flags a document expiring within the default 30-day window", () => {
    expect(isExpiringSoon("2026-09-10", 30, TODAY)).toBe(true); // 24 days out
  });

  it("does not flag a document expiring well beyond the window", () => {
    expect(isExpiringSoon("2026-12-01", 30, TODAY)).toBe(false);
  });

  it("does not flag a document with no expiry date at all", () => {
    expect(isExpiringSoon(null, 30, TODAY)).toBe(false);
  });

  it("does not flag a document that has already expired (that's isExpired's job)", () => {
    expect(isExpiringSoon("2026-08-01", 30, TODAY)).toBe(false);
  });
});

describe("isExpired", () => {
  it("flags a past expiry date", () => {
    expect(isExpired("2026-08-01", TODAY)).toBe(true);
  });

  it("does not flag today or a future date", () => {
    expect(isExpired("2026-08-17", TODAY)).toBe(false);
    expect(isExpired("2026-09-01", TODAY)).toBe(false);
  });
});

describe("daysUntilExpiry", () => {
  it("computes whole days remaining", () => {
    expect(daysUntilExpiry("2026-09-10", TODAY)).toBe(24);
  });

  it("returns a negative number for an already-expired date", () => {
    expect(daysUntilExpiry("2026-08-10", TODAY)).toBe(-7);
  });
});

describe("nextVersionNumber", () => {
  it("increments by one", () => {
    expect(nextVersionNumber(4)).toBe(5);
  });
});

describe("archivedFileName", () => {
  it("inserts the version and archive date before the extension", () => {
    expect(archivedFileName("Company Profile.docx", 4, "2026-08-17")).toBe(
      "Company Profile v4 (superseded 2026-08-17).docx"
    );
  });

  it("handles a file with no extension", () => {
    expect(archivedFileName("README", 2, "2026-08-17")).toBe("README v2 (superseded 2026-08-17)");
  });
});
