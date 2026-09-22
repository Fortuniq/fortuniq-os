import { createServiceClient } from "@/lib/supabase/service";
import { validateNoteInput, sortNotes, type PersonalNote, type NoteInput } from "@/lib/notes-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): PersonalNote {
  return {
    id: row.id,
    employeeEmail: row.employee_email,
    title: row.title ?? null,
    content: row.content,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every note WRITE/READ function here is scoped to a single employee_email — nobody, not even Super Admin, has a way to read another employee's notes through this module. See migration_v32_personal_notes.sql. */
export async function getMyNotes(employeeEmail: string): Promise<PersonalNote[]> {
  if (!supabaseConfigured || !employeeEmail) return [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("personal_notes").select("*").eq("employee_email", employeeEmail.toLowerCase());
    if (error || !data) return [];
    return sortNotes(data.map(mapRow));
  } catch {
    return [];
  }
}

export async function createNote(employeeEmail: string, input: NoteInput): Promise<{ error?: string; id?: string }> {
  const validationError = validateNoteInput(input);
  if (validationError) return { error: validationError };
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const { data, error } = await supabase.from("personal_notes").insert({
      employee_email: employeeEmail.toLowerCase(),
      title: title || null,
      content: (input.content as string).trim(),
      pinned: false,
    }).select("id").single();
    if (error || !data) return { error: "Couldn't save the note. Please try again." };
    return { id: data.id as string };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save note." };
  }
}

export async function updateNote(noteId: string, actorEmail: string, input: NoteInput): Promise<{ error?: string }> {
  const validationError = validateNoteInput(input);
  if (validationError) return { error: validationError };
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("personal_notes").select("employee_email").eq("id", noteId).maybeSingle();
    if (!existing) return { error: "Note not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only edit your own notes." };

    const title = typeof input.title === "string" ? input.title.trim() : "";
    await supabase.from("personal_notes").update({
      title: title || null,
      content: (input.content as string).trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", noteId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update note." };
  }
}

export async function deleteNote(noteId: string, actorEmail: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("personal_notes").select("employee_email").eq("id", noteId).maybeSingle();
    if (!existing) return { error: "Note not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only delete your own notes." };

    await supabase.from("personal_notes").delete().eq("id", noteId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete note." };
  }
}

export async function toggleNotePin(noteId: string, actorEmail: string, pinned: boolean): Promise<{ error?: string }> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("personal_notes").select("employee_email").eq("id", noteId).maybeSingle();
    if (!existing) return { error: "Note not found." };
    if ((existing.employee_email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return { error: "You can only pin your own notes." };

    await supabase.from("personal_notes").update({ pinned, updated_at: new Date().toISOString() }).eq("id", noteId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update note." };
  }
}
