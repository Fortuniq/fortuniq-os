"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { createNote, updateNote, deleteNote, toggleNotePin } from "@/lib/notes-data";

// Every action here derives the owner from the SESSION (no employeeEmail
// parameter ever accepted from the client) — same posture as the
// personal-task actions in task-actions.ts. The real ownership check
// still lives in notes-data.ts, not just here.

function readNoteFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim() || undefined,
    content: String(formData.get("content") ?? ""),
  };
}

export async function createNoteAction(formData: FormData): Promise<{ error?: string; id?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await createNote(permissions.email, readNoteFields(formData));
  if (result.error) return result;
  revalidatePath("/dashboard");
  return result;
}

export async function updateNoteAction(noteId: string, formData: FormData): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await updateNote(noteId, permissions.email, readNoteFields(formData));
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}

export async function deleteNoteAction(noteId: string): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await deleteNote(noteId, permissions.email);
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}

export async function toggleNotePinAction(noteId: string, pinned: boolean): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };
  const result = await toggleNotePin(noteId, permissions.email, pinned);
  if (result.error) return result;
  revalidatePath("/dashboard");
  return {};
}
