import { describe, it, expect } from "vitest";
import { validateNoteInput, sortNotes, notePreview, type PersonalNote } from "./notes-core";

function note(overrides: Partial<PersonalNote> = {}): PersonalNote {
  return {
    id: "1", employeeEmail: "person@iqfuels.co.za", title: null, content: "Test note",
    pinned: false, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("validateNoteInput", () => {
  it("accepts a plain note with no title", () => {
    expect(validateNoteInput({ content: "Call John about the invoice" })).toBeNull();
  });
  it("rejects empty content", () => {
    expect(validateNoteInput({ content: "   " })).toMatch(/empty/i);
  });
  it("rejects content over the length cap", () => {
    expect(validateNoteInput({ content: "x".repeat(10001) })).toMatch(/10,000/);
  });
  it("accepts a title within the length cap", () => {
    expect(validateNoteInput({ content: "x", title: "Meeting minutes" })).toBeNull();
  });
  it("rejects a title over the length cap", () => {
    expect(validateNoteInput({ content: "x", title: "x".repeat(201) })).toMatch(/200/);
  });
});

describe("sortNotes", () => {
  it("puts pinned notes first", () => {
    const notes = [note({ id: "1", updatedAt: "2026-09-10T00:00:00Z" }), note({ id: "2", pinned: true, updatedAt: "2026-09-01T00:00:00Z" })];
    expect(sortNotes(notes)[0].id).toBe("2");
  });
  it("falls back to most recently updated", () => {
    const notes = [note({ id: "1", updatedAt: "2026-09-01T00:00:00Z" }), note({ id: "2", updatedAt: "2026-09-10T00:00:00Z" })];
    expect(sortNotes(notes)[0].id).toBe("2");
  });
  it("does not mutate the input array", () => {
    const notes = [note({ id: "1" }), note({ id: "2", pinned: true })];
    const copy = [...notes];
    sortNotes(notes);
    expect(notes).toEqual(copy);
  });
});

describe("notePreview", () => {
  it("returns the first line unchanged when short", () => {
    expect(notePreview("Call the auditor\nMore details here")).toBe("Call the auditor");
  });
  it("truncates a long first line with an ellipsis", () => {
    const long = "x".repeat(100);
    const preview = notePreview(long, 80);
    expect(preview.length).toBe(81); // 80 chars + ellipsis
    expect(preview.endsWith("…")).toBe(true);
  });
});
