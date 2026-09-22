// Pure logic for My Notes (Project ORION). Zero DB/Next dependencies,
// same pattern as every other *-core.ts file in this app. See
// docs/EMPLOYEE_DASHBOARD.md.
//
// The brief: "My Notes: private notes widget (notes, meeting minutes,
// ideas, phone numbers, reminders, action items)." Deliberately a
// single free-text `content` field rather than a structured schema per
// note "type" — the brief lists examples of what people jot down, not
// distinct record types, and a phone number or an action item is just
// as much "a note" as a paragraph of meeting minutes. Keeping it plain
// text is also why this never needed its own rich-text/markdown system.

export interface PersonalNote {
  id: string;
  employeeEmail: string;
  title: string | null;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title?: unknown;
  content?: unknown;
}

/** Validates a proposed note create/edit before it reaches the database — same never-trust-the-client discipline as every other *-core.ts validator (see market-news-core.ts, tasks-core.ts). */
export function validateNoteInput(input: NoteInput): string | null {
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!content) return "A note can't be empty.";
  if (content.length > 10000) return "Note is too long (10,000 characters max).";

  if (input.title !== undefined && input.title !== null) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (title.length > 200) return "Title must be 200 characters or fewer.";
  }

  return null;
}

/** Pinned notes first, then most recently updated. */
export function sortNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** A short preview for the collapsed card — first line, or a fixed character cap for a single long line, whichever is shorter. */
export function notePreview(content: string, maxLength = 80): string {
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.slice(0, maxLength).trimEnd() + "…";
}
