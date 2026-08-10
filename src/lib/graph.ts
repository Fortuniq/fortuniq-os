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

export const isSharePointConfigured = !!process.env.SHAREPOINT_SITE_URL;
