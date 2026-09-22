"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Plus, Pin, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { createNoteAction, updateNoteAction, deleteNoteAction, toggleNotePinAction } from "./note-actions";
import { notePreview, type PersonalNote } from "@/lib/notes-core";

/**
 * "My Notes: private notes widget (notes, meeting minutes, ideas, phone
 * numbers, reminders, action items)" — Project ORION. Entirely private:
 * nobody but the signed-in employee ever sees these (notes-data.ts
 * enforces that server-side; this component has no privacy logic of its
 * own to get wrong).
 */
export function MyNotesCard({ notes }: { notes: PersonalNote[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createNoteAction(formData);
      if (result?.error) setError(result.error);
      else { setAdding(false); router.refresh(); }
    });
  }

  function handleUpdate(noteId: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateNoteAction(noteId, formData);
      if (result?.error) setError(result.error);
      else { setEditingId(null); router.refresh(); }
    });
  }

  function handleDelete(noteId: string, label: string) {
    if (!confirm(`Delete "${label}"?`)) return;
    startTransition(async () => {
      await deleteNoteAction(noteId);
      router.refresh();
    });
  }

  function handleTogglePin(noteId: string, pinned: boolean) {
    startTransition(async () => {
      await toggleNotePinAction(noteId, pinned);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5 text-orange" /> My Notes
          </span>
        </CardTitle>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add note
          </button>
        )}
      </CardHeader>
      <CardBody className="space-y-2">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {adding && <NoteForm onSubmit={handleCreate} onCancel={() => { setAdding(false); setError(null); }} submitting={isPending} />}

        {notes.length === 0 && !adding && <p className="text-sm text-light-grey py-2">Nothing here yet — jot down anything: an idea, a phone number, meeting minutes.</p>}

        {notes.map((n) =>
          editingId === n.id ? (
            <NoteForm
              key={n.id}
              note={n}
              onSubmit={(fd) => handleUpdate(n.id, fd)}
              onCancel={() => { setEditingId(null); setError(null); }}
              submitting={isPending}
            />
          ) : (
            <div key={n.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Pin className="w-3 h-3 text-orange shrink-0" />}
                    {n.title && <p className="text-sm font-semibold text-navy truncate">{n.title}</p>}
                  </div>
                  <p className="text-xs text-grey truncate mt-0.5">{expandedId === n.id ? "" : notePreview(n.content)}</p>
                </div>
                {expandedId === n.id ? <ChevronUp className="w-4 h-4 text-grey shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-grey shrink-0 mt-0.5" />}
              </button>

              {expandedId === n.id && (
                <div className="px-3 pb-2.5 pt-0.5 border-t border-border">
                  <p className="text-sm text-navy whitespace-pre-line">{n.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => handleTogglePin(n.id, !n.pinned)} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-orange transition-colors">
                      <Pin className="w-3.5 h-3.5" /> {n.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button onClick={() => { setEditingId(n.id); setAdding(false); setError(null); }} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDelete(n.id, n.title ?? notePreview(n.content))} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
}

function NoteForm({
  note, onSubmit, onCancel, submitting,
}: {
  note?: PersonalNote;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <form action={onSubmit} className="border border-border rounded-lg p-2.5 space-y-2 bg-surface">
      <input name="title" defaultValue={note?.title ?? ""} placeholder="Title (optional)" maxLength={200} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
      <textarea name="content" defaultValue={note?.content} placeholder="Write anything — an idea, a phone number, meeting minutes…" required rows={4} autoFocus className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-2.5 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
          <Check className="w-3.5 h-3.5" /> {submitting ? "Saving…" : note ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </form>
  );
}
