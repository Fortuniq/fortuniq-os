import { createServiceClient } from "@/lib/supabase/service";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  sharepointItemId: string;
  sharepointWebUrl: string | null;
  isCurrent: boolean;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  comments: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
};

function mapRow(row: Record<string, unknown>): DocumentVersion {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    versionNumber: row.version_number as number,
    sharepointItemId: row.sharepoint_item_id as string,
    sharepointWebUrl: (row.sharepoint_web_url as string) ?? null,
    isCurrent: !!row.is_current,
    uploadedBy: (row.uploaded_by as string) ?? null,
    uploadedByName: (row.uploaded_by_name as string) ?? null,
    uploadedAt: row.uploaded_at as string,
    comments: (row.comments as string) ?? null,
    archivedAt: (row.archived_at as string) ?? null,
    archivedBy: (row.archived_by as string) ?? null,
  };
}

/** Full version history for a document, newest first — Current Version and every Archived Version. */
export async function getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", documentId)
      .order("version_number", { ascending: false });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Records a newly linked/uploaded file as a document's new current
 * version. Does NOT touch the previous version's is_current flag —
 * callers archive the previous version explicitly first (see
 * archivePreviousVersion()), so the two steps stay independently
 * auditable rather than being one implicit side effect.
 */
export async function recordNewVersion(params: {
  documentId: string;
  versionNumber: number;
  sharepointItemId: string;
  sharepointWebUrl: string | null;
  uploadedBy: string;
  uploadedByName: string | null;
  comments?: string;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const supabase = createServiceClient();
  await supabase.from("document_versions").insert({
    document_id: params.documentId,
    version_number: params.versionNumber,
    sharepoint_item_id: params.sharepointItemId,
    sharepoint_web_url: params.sharepointWebUrl,
    is_current: true,
    uploaded_by: params.uploadedBy,
    uploaded_by_name: params.uploadedByName,
    comments: params.comments ?? null,
  });
}

/** Marks the currently-active version row as archived — called just before a replacement becomes current. */
export async function archivePreviousVersion(documentId: string, archivedBy: string): Promise<void> {
  if (!supabaseConfigured) return;
  const supabase = createServiceClient();
  await supabase
    .from("document_versions")
    .update({ is_current: false, archived_at: new Date().toISOString(), archived_by: archivedBy })
    .eq("document_id", documentId)
    .eq("is_current", true);
}

/**
 * Restores a previously archived version as the current one — the
 * inverse of archivePreviousVersion(), used by "Restore Previous
 * Version." The version being restored is marked current again; the
 * version that was current a moment ago is archived. Nothing is
 * deleted — the full chain of versions remains in the table regardless
 * of how many times a document is restored back and forth.
 */
export async function restoreVersion(params: { documentId: string; versionId: string; restoredBy: string }): Promise<void> {
  if (!supabaseConfigured) return;
  const supabase = createServiceClient();
  await archivePreviousVersion(params.documentId, params.restoredBy);
  await supabase
    .from("document_versions")
    .update({ is_current: true, archived_at: null, archived_by: null })
    .eq("id", params.versionId);
}
