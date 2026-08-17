// Microsoft Graph API client for SharePoint document access.
//
// IMPORTANT: every function here takes the CURRENT SIGNED-IN USER'S access
// token (from their session — see src/auth.ts), never a shared app-level
// credential. This is deliberate: it means every call to SharePoint is made
// "as" that specific person, so Microsoft's own permission rules apply
// exactly as they would if they opened SharePoint directly. If someone
// doesn't have access to a file in SharePoint, calling these functions with
// their token will fail or omit that file — there is no back door.

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type SharePointFile = {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
  lastModifiedBy?: string;
  mimeType?: string;
  isFolder: boolean;
};

export type SharePointVersion = {
  id: string;
  lastModifiedDateTime: string;
  modifiedBy?: string;
  size?: number;
};

class GraphError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function graphFetch(path: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GraphError(`Graph API error ${res.status}: ${body}`, res.status);
  }
  return res.json();
}

/**
 * Resolves a SharePoint site URL (e.g.
 * "https://iqfuels.sharepoint.com/sites/FortunIQDocuments") into the
 * site ID and default document library (drive) ID Graph needs for
 * everything else below. Configured once via SHAREPOINT_SITE_URL.
 */
export async function resolveSharePointSite(accessToken: string) {
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  if (!siteUrl) {
    throw new Error("SHAREPOINT_SITE_URL is not configured.");
  }
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname; // e.g. /sites/FortunIQDocuments

  const site = await graphFetch(`/sites/${hostname}:${sitePath}`, accessToken);
  const drive = await graphFetch(`/sites/${site.id}/drive`, accessToken);

  return { siteId: site.id as string, driveId: drive.id as string };
}

/** Lists files in the configured SharePoint document library (root folder). */
export async function listSharePointFiles(accessToken: string): Promise<SharePointFile[]> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const data = await graphFetch(
    `/drives/${driveId}/root/children?$select=id,name,webUrl,size,lastModifiedDateTime,lastModifiedBy,file,folder`,
    accessToken
  );
  return (data.value ?? []).map(mapDriveItem);
}

/** Full-text search across the configured document library. */
export async function searchSharePointFiles(accessToken: string, query: string): Promise<SharePointFile[]> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const data = await graphFetch(
    `/drives/${driveId}/root/search(q='${encodeURIComponent(query)}')?$select=id,name,webUrl,size,lastModifiedDateTime,lastModifiedBy,file,folder`,
    accessToken
  );
  return (data.value ?? []).map(mapDriveItem);
}

/** Gets a short-lived embeddable preview URL for a file (Office/PDF viewer). */
export async function getDocumentPreviewUrl(accessToken: string, itemId: string): Promise<string> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const data = await graphFetch(`/drives/${driveId}/items/${itemId}/preview`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.getUrl as string;
}

/** Gets SharePoint's built-in version history for a file. */
export async function getDocumentVersions(accessToken: string, itemId: string): Promise<SharePointVersion[]> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const data = await graphFetch(`/drives/${driveId}/items/${itemId}/versions`, accessToken);
  return (data.value ?? []).map((v: Record<string, unknown>) => ({
    id: v.id,
    lastModifiedDateTime: v.lastModifiedDateTime,
    modifiedBy: (v.lastModifiedBy as { user?: { displayName?: string } })?.user?.displayName,
    size: v.size,
  }));
}

/**
 * Downloads raw text content of a file — used only for the AI Assistant's
 * document retrieval. Works well for plain text; rich formats (Word, PDF)
 * come back as binary and are not parsed into readable text by this
 * function yet (see docs/SHAREPOINT_SETUP.md for this known limitation).
 */
export async function getDocumentTextContent(accessToken: string, itemId: string): Promise<string | null> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const res = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/") || contentType.includes("json")) {
    return res.text();
  }

  // PDF and Word (.docx) are the most common real tender document
  // formats, so real text extraction matters here specifically — a
  // filename-only fallback (the old behaviour) misses everything the
  // document actually says. Both libraries are pure JavaScript, chosen
  // deliberately so this keeps working in Netlify's serverless
  // functions without any native binary dependencies to worry about.
  // Extraction failures are swallowed here, not thrown — a single
  // unreadable or corrupted file should never break the rest of an AI
  // checklist run; the caller already falls back to inferring from the
  // filename alone when this returns null. See docs/TENDER_WORKSPACE.md.
  try {
    if (contentType.includes("application/pdf")) {
      const buffer = Buffer.from(await res.arrayBuffer());
      // Imported from pdf-parse's inner lib file, not the package root —
      // pdf-parse@1.x's own index.js has a well-known bug where it
      // misdetects certain module-loading contexts (including dynamic
      // import()) as "being run directly," and tries to read a sample
      // PDF that only exists inside the package's own repository,
      // crashing on load. The actual parsing logic underneath is fine;
      // this simply bypasses the buggy wrapper around it.
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const parsed = await pdfParse(buffer);
      return parsed.text || null;
    }

    if (contentType.includes("wordprocessingml.document")) {
      // .docx specifically — mammoth's format (Office Open XML).
      const buffer = Buffer.from(await res.arrayBuffer());
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    }

    if (contentType.includes("application/msword")) {
      // Old, pre-2007 .doc format — a genuinely different binary format
      // that mammoth (and most pure-JS libraries) can't parse. Rather
      // than fail silently or produce garbled text, this is an honest
      // "not supported" rather than attempting extraction. Converting
      // the file to .docx first is the practical workaround.
      return null;
    }
  } catch (err) {
    console.error("getDocumentTextContent: extraction failed:", err instanceof Error ? err.message : err);
    return null;
  }

  return null; // other binary formats (xlsx, images, etc.) — not extracted
}

function mapDriveItem(item: Record<string, unknown>): SharePointFile {
  const file = item.file as { mimeType?: string } | undefined;
  const lastModifiedBy = item.lastModifiedBy as { user?: { displayName?: string } } | undefined;
  return {
    id: item.id as string,
    name: item.name as string,
    webUrl: item.webUrl as string,
    size: (item.size as number) ?? 0,
    lastModifiedDateTime: item.lastModifiedDateTime as string,
    lastModifiedBy: lastModifiedBy?.user?.displayName,
    mimeType: file?.mimeType,
    isFolder: !!item.folder,
  };
}

/**
 * Real-time check: can THIS specific person (their own access token)
 * actually open this specific SharePoint item right now? Used by the AI
 * Assistant before including any document in its context — see
 * docs/AI_SECURITY.md, requirement 7 (AI permission inheritance).
 *
 * Deliberately fails closed: any error (network issue, expired token,
 * Graph API hiccup, the item no longer existing) returns false, not true.
 * An AI feature should never assume access when it can't actually verify
 * it — a false negative here just means the AI doesn't mention a document
 * it maybe could have; a false positive would mean it discloses something
 * it shouldn't.
 */
export async function canUserAccessItem(accessToken: string, itemId: string): Promise<boolean> {
  try {
    const { driveId } = await resolveSharePointSite(accessToken);
    await graphFetch(`/drives/${driveId}/items/${itemId}?$select=id`, accessToken);
    return true;
  } catch {
    return false;
  }
}

export const isSharePointConfigured = !!process.env.SHAREPOINT_SITE_URL;

// =========================================================================
// PER-TENDER DOCUMENT WORKSPACES
// =========================================================================

// Created automatically inside every new tender's folder. Adjust this
// list if your real tender workflow needs different subfolders — no
// other code changes are needed, this is the single source of truth.
export const TENDER_STANDARD_SUBFOLDERS = [
  "01 - Tender Documents (RFT)",
  "02 - Compliance Documents",
  "03 - Pricing  Schedules",
  "04 - Submission Pack",
  "05 - Correspondence",
];

function sanitiseFolderName(name: string): string {
  // SharePoint/OneDrive forbid these characters in item names.
  return name.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 150);
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Gets a folder by path if it already exists, without creating anything.
 * Returns null (not an error) if it doesn't exist yet — this is the
 * normal, expected case the first time a tender's folder is set up.
 */
async function getFolderByPath(accessToken: string, driveId: string, path: string): Promise<{ id: string; webUrl: string } | null> {
  try {
    const data = await graphFetch(`/drives/${driveId}/root:/${path}`, accessToken);
    return { id: data.id as string, webUrl: data.webUrl as string };
  } catch (err) {
    if (err instanceof GraphError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Creates a folder if it doesn't already exist, or returns the existing
 * one — safe to call repeatedly (idempotent), which matters because
 * tender creation should never fail or duplicate folders just because
 * someone re-triggers it.
 */
async function ensureFolder(accessToken: string, driveId: string, parentPath: string, folderName: string): Promise<{ id: string; webUrl: string }> {
  const cleanName = sanitiseFolderName(folderName);
  const fullPath = parentPath ? `${parentPath}/${encodePathSegment(cleanName)}` : encodePathSegment(cleanName);

  const existing = await getFolderByPath(accessToken, driveId, fullPath);
  if (existing) return existing;

  const parentUrl = parentPath ? `/drives/${driveId}/root:/${parentPath}:/children` : `/drives/${driveId}/root/children`;
  const created = await graphFetch(parentUrl, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: cleanName, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  });
  return { id: created.id as string, webUrl: created.webUrl as string };
}

/**
 * Creates (or finds, if already created — safe to call more than once)
 * a dedicated SharePoint folder for a tender, named
 * "Tenders/{ref} - {title}", with the standard subfolders inside it.
 * Uses the CURRENT SIGNED-IN PERSON'S own delegated permissions, same as
 * every other function in this file — the folder is created "as" the
 * Tender Administrator who created the tender, not a shared app identity.
 */
export async function ensureTenderFolder(
  accessToken: string,
  tenderRef: string,
  tenderTitle: string
): Promise<{ folderId: string; folderUrl: string }> {
  const { driveId } = await resolveSharePointSite(accessToken);

  // Ensure the top-level "Tenders" folder exists first.
  await ensureFolder(accessToken, driveId, "", "Tenders");

  // Then the tender's own folder inside it, e.g.
  // "Tenders/GDOH-2026-114 - Bulk Diesel Supply".
  const tenderFolderName = `${tenderRef} - ${tenderTitle}`;
  const tenderFolder = await ensureFolder(accessToken, driveId, "Tenders", tenderFolderName);

  // Then the standard subfolders inside the tender's own folder.
  const tenderFolderPath = `Tenders/${encodePathSegment(sanitiseFolderName(tenderFolderName))}`;
  for (const subfolder of TENDER_STANDARD_SUBFOLDERS) {
    await ensureFolder(accessToken, driveId, tenderFolderPath, subfolder);
  }

  return { folderId: tenderFolder.id, folderUrl: tenderFolder.webUrl };
}

/**
 * Lists the contents of a specific folder (a tender's document
 * workspace) rather than the whole document library root — used by the
 * Tenders module's Documents tab.
 */
export async function listFolderContents(accessToken: string, folderId: string): Promise<SharePointFile[]> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const data = await graphFetch(
    `/drives/${driveId}/items/${folderId}/children?$select=id,name,webUrl,size,lastModifiedDateTime,lastModifiedBy,file,folder`,
    accessToken
  );
  return (data.value ?? []).map(mapDriveItem);
}

// =========================================================================
// ATTENDANCE REGISTER (SharePoint List)
// =========================================================================
// See docs/ATTENDANCE.md for the full storage decision. Supabase's
// `attendance` table is the operational source of truth that Clock
// In/Out actually reads and writes; this SharePoint List is a
// best-effort mirror kept purely for HR's register-of-record / Excel
// export needs, using the same delegated, per-signed-in-user Graph
// pattern as every other function in this file. A failure here must
// NEVER block or roll back a real Clock In/Clock Out — callers treat
// this as fire-and-forget, same as ensureTenderFolder's folder-creation
// step.
//
// IMPORTANT — list-level SharePoint permissions: creating the list via
// Graph does not, by itself, restrict who in the organisation can open
// it directly in SharePoint (that requires breaking permission
// inheritance on the list, which needs a site-admin action beyond what
// Sites.ReadWrite.All safely automates here). Restricting direct
// SharePoint access to HR/Super Admin is a one-time manual step for a
// site admin to perform in SharePoint's own sharing settings — see
// docs/ATTENDANCE.md, "SharePoint list permissions." FortunIQ OS itself
// already enforces the real access control (see requirePermissionAction
// calls in attendance-actions.ts) regardless of that manual step.

const ATTENDANCE_LIST_NAME = "Attendance Register";

const ATTENDANCE_LIST_COLUMNS = [
  { name: "EmployeeName", text: {} },
  { name: "EmployeeEmail", text: {} },
  { name: "Department", text: {} },
  { name: "AttendanceDate", dateTime: { format: "dateOnly" } },
  { name: "ClockIn", dateTime: { format: "dateTime" } },
  { name: "ClockOut", dateTime: { format: "dateTime" } },
  { name: "HoursWorked", text: {} },
  { name: "Status", text: {} },
];

/**
 * Creates the Attendance Register SharePoint List if it doesn't already
 * exist, or returns its id if it does — idempotent, safe to call before
 * every write, same pattern as ensureFolder() above.
 */
export async function ensureAttendanceList(accessToken: string): Promise<string> {
  const { siteId } = await resolveSharePointSite(accessToken);

  const existing = await graphFetch(
    `/sites/${siteId}/lists?$filter=displayName eq '${ATTENDANCE_LIST_NAME}'`,
    accessToken
  );
  if (existing.value && existing.value.length > 0) {
    return existing.value[0].id as string;
  }

  const created = await graphFetch(`/sites/${siteId}/lists`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: ATTENDANCE_LIST_NAME,
      list: { template: "genericList" },
      columns: ATTENDANCE_LIST_COLUMNS,
    }),
  });
  return created.id as string;
}

/** Adds one row to the Attendance Register list for a clock-in or a completed clock-out. */
export async function upsertAttendanceListItem(
  accessToken: string,
  listItemId: string | null,
  fields: {
    employeeName: string;
    employeeEmail: string;
    department: string | null;
    attendanceDate: string; // YYYY-MM-DD
    clockIn: string | null; // ISO timestamp
    clockOut: string | null;
    hoursWorked: string | null;
    status: string;
  }
): Promise<string> {
  const { siteId } = await resolveSharePointSite(accessToken);
  const listId = await ensureAttendanceList(accessToken);

  const body = {
    fields: {
      Title: `${fields.employeeName} — ${fields.attendanceDate}`,
      EmployeeName: fields.employeeName,
      EmployeeEmail: fields.employeeEmail,
      Department: fields.department ?? "",
      AttendanceDate: fields.attendanceDate,
      ClockIn: fields.clockIn ?? null,
      ClockOut: fields.clockOut ?? null,
      HoursWorked: fields.hoursWorked ?? "",
      Status: fields.status,
    },
  };

  if (listItemId) {
    await graphFetch(`/sites/${siteId}/lists/${listId}/items/${listItemId}/fields`, accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.fields),
    });
    return listItemId;
  }

  const created = await graphFetch(`/sites/${siteId}/lists/${listId}/items`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return created.id as string;
}

// =========================================================================
// ENTERPRISE DOCUMENT CONTROL SYSTEM
// =========================================================================
// See docs/DOCUMENT_CONTROL.md for the full design. This section adds
// the three capabilities the rest of the app didn't have yet: creating
// the FortunIQ Documents library's folder structure, uploading a file
// into it, and moving a file (used to archive a superseded version).
// Everything else (list/search/preview/native version history) already
// existed above and is reused as-is.

/**
 * The top-level category folders inside "FortunIQ Documents" — mirrors
 * the structure requested for the document control system exactly.
 * "Archive" is created too, but is never offered as a place to file a
 * NEW document — see ensureCategoryFolder(), which rejects it.
 */
export const DOCUMENT_LIBRARY_ROOT = "FortunIQ Documents";

export const DOCUMENT_CATEGORIES = [
  "Policies", "SOPs", "Legal", "Brand", "Certificates", "Licences", "Tax",
  "Insurance", "Company Profile", "Marketing", "Finance", "Operations",
  "HR", "Templates",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

const ARCHIVE_FOLDER_NAME = "Archive";

/**
 * Creates the full "FortunIQ Documents" library structure — the root
 * folder, every category subfolder, and the Archive folder (with a
 * mirrored subfolder per category inside it, so archived versions stay
 * organised by category too) — if any part doesn't already exist yet.
 * Idempotent and safe to call on every "Attach Document" action; the
 * underlying ensureFolder() is a no-op for anything already there.
 */
export async function ensureDocumentLibraryStructure(accessToken: string): Promise<void> {
  const { driveId } = await resolveSharePointSite(accessToken);
  await ensureFolder(accessToken, driveId, "", DOCUMENT_LIBRARY_ROOT);
  for (const category of DOCUMENT_CATEGORIES) {
    await ensureFolder(accessToken, driveId, DOCUMENT_LIBRARY_ROOT, category);
  }
  const archiveRoot = await ensureFolder(accessToken, driveId, DOCUMENT_LIBRARY_ROOT, ARCHIVE_FOLDER_NAME);
  const archivePath = `${DOCUMENT_LIBRARY_ROOT}/${encodePathSegment(sanitiseFolderName(ARCHIVE_FOLDER_NAME))}`;
  for (const category of DOCUMENT_CATEGORIES) {
    await ensureFolder(accessToken, driveId, archivePath, category);
  }
  void archiveRoot; // referenced for clarity; callers use getCategoryFolder()/getArchiveFolder() below to fetch ids when needed
}

/** Gets (creating if needed) the live folder for a given document category — where new/current versions are filed. */
export async function getCategoryFolder(accessToken: string, category: string): Promise<{ id: string; webUrl: string }> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const safeCategory = DOCUMENT_CATEGORIES.includes(category as DocumentCategory) ? category : "Policies";
  return ensureFolder(accessToken, driveId, DOCUMENT_LIBRARY_ROOT, safeCategory);
}

/** Gets (creating if needed) the Archive subfolder for a given category — where superseded versions are moved to. */
export async function getArchiveFolder(accessToken: string, category: string): Promise<{ id: string; webUrl: string }> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const safeCategory = DOCUMENT_CATEGORIES.includes(category as DocumentCategory) ? category : "Policies";
  const archivePath = `${DOCUMENT_LIBRARY_ROOT}/${encodePathSegment(sanitiseFolderName(ARCHIVE_FOLDER_NAME))}`;
  return ensureFolder(accessToken, driveId, archivePath, safeCategory);
}

/**
 * Uploads a file's raw bytes into a specific folder using SharePoint's
 * simple-upload endpoint. This endpoint supports files up to 4MB — the
 * overwhelming majority of policy/SOP/certificate/licence documents.
 * Larger files (e.g. a lengthy scanned contract) would need a resumable
 * upload session instead; that's a known, documented limitation rather
 * than a silent failure — see docs/DOCUMENT_CONTROL.md, "Upload size
 * limit," and the friendly error uploadNewDocumentVersion() raises when
 * this is hit.
 */
export async function uploadFileToFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<SharePointFile> {
  if (bytes.byteLength > 4 * 1024 * 1024) {
    throw new GraphError("File is larger than 4MB — SharePoint simple upload doesn't support this yet in FortunIQ OS.", 413);
  }
  const { driveId } = await resolveSharePointSite(accessToken);
  const safeName = sanitiseFolderName(fileName);
  const data = await graphFetch(
    `/drives/${driveId}/items/${folderId}:/${encodePathSegment(safeName)}:/content`,
    accessToken,
    { method: "PUT", headers: { "Content-Type": contentType || "application/octet-stream" }, body: bytes }
  );
  return mapDriveItem(data);
}

/**
 * Moves a file to a different folder (used to move a superseded version
 * into Archive) and optionally renames it in the same call — e.g.
 * "Company Profile.docx" becomes "Company Profile v4 (superseded
 * 2026-08-17).docx" so multiple archived versions of the same document
 * never collide in the Archive folder. Graph preserves the item's id
 * across a move, which is exactly what lets document_versions rows keep
 * referencing the same sharepoint_item_id after archiving — see
 * docs/DOCUMENT_CONTROL.md.
 */
export async function moveFileToFolder(
  accessToken: string,
  itemId: string,
  destinationFolderId: string,
  newName?: string
): Promise<SharePointFile> {
  const { driveId } = await resolveSharePointSite(accessToken);
  const body: Record<string, unknown> = { parentReference: { id: destinationFolderId } };
  if (newName) body.name = sanitiseFolderName(newName);
  const data = await graphFetch(`/drives/${driveId}/items/${itemId}`, accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return mapDriveItem(data);
}

