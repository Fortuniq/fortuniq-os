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
  return null; // binary formats (docx, pdf, xlsx) — not extracted in this version
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

