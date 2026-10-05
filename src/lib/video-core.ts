// Pure logic for turning whatever URL an admin pasted into a lesson's
// "Video URL" field into something the course player can actually show.
// Zero dependencies on Next.js/Supabase, same pattern as every other
// *-core.ts file — see video-core.test.ts.
//
// WHY THIS EXISTS: the player used a bare <video src={url}>, which only
// plays a direct media FILE (…/lesson.mp4). A YouTube/Vimeo page link, a
// SharePoint/OneDrive/Stream share link, etc. is an ordinary web page, not
// a media file, so the browser shows a dead player. See
// docs/ACADEMY_SCHOOLS.md.

export type VideoSource =
  | { kind: "direct"; src: string }
  | { kind: "embed"; src: string; provider: "YouTube" | "Vimeo" }
  | { kind: "link"; src: string; provider: string }
  | { kind: "invalid" };

const DIRECT_EXTENSIONS = /\.(mp4|webm|ogg|ogv|m4v|mov)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (hostMatches(host, "youtube.com") || hostMatches(host, "youtube-nocookie.com")) {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;
    const parts = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "") && YOUTUBE_ID.test(parts[1] ?? "")) return parts[1];
  }
  return null;
}

function vimeoParts(url: URL): { id: string; hash?: string } | null {
  const host = url.hostname.toLowerCase();
  if (!hostMatches(host, "vimeo.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // player.vimeo.com/video/ID  |  vimeo.com/ID  |  vimeo.com/ID/HASH (unlisted)
  const start = parts[0] === "video" ? 1 : 0;
  const id = parts[start];
  if (!id || !/^\d+$/.test(id)) return null;
  const hashFromPath = parts[start + 1] && /^[a-z0-9]+$/i.test(parts[start + 1]) ? parts[start + 1] : undefined;
  return { id, hash: hashFromPath ?? url.searchParams.get("h") ?? undefined };
}

// Hosts whose links are authenticated web pages (sign-in required, and they
// refuse to be framed by other sites) — they can't be played inline by a
// <video> or <iframe> here, so the player offers an "Open video" link.
const WEB_PAGE_HOSTS: { domain: string; provider: string }[] = [
  { domain: "sharepoint.com", provider: "SharePoint" },
  { domain: "1drv.ms", provider: "OneDrive" },
  { domain: "onedrive.live.com", provider: "OneDrive" },
  { domain: "web.microsoftstream.com", provider: "Microsoft Stream" },
  { domain: "teams.microsoft.com", provider: "Microsoft Teams" },
  { domain: "drive.google.com", provider: "Google Drive" },
  { domain: "dropbox.com", provider: "Dropbox" },
];

export function resolveVideoSource(raw: string | null | undefined): VideoSource | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: "invalid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { kind: "invalid" };

  const yt = youtubeId(url);
  if (yt) return { kind: "embed", provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0` };

  const vimeo = vimeoParts(url);
  if (vimeo) {
    const hash = vimeo.hash ? `?h=${encodeURIComponent(vimeo.hash)}` : "";
    return { kind: "embed", provider: "Vimeo", src: `https://player.vimeo.com/video/${vimeo.id}${hash}` };
  }

  // A real media file on any host plays natively, even on SharePoint
  // (when the URL is a direct, already-authorised file URL).
  if (DIRECT_EXTENSIONS.test(url.pathname)) return { kind: "direct", src: trimmed };

  const host = url.hostname.toLowerCase();
  const webPage = WEB_PAGE_HOSTS.find((h) => hostMatches(host, h.domain));
  if (webPage) return { kind: "link", provider: webPage.provider, src: trimmed };

  // Unknown host, no recognisable extension (e.g. a storage URL with no
  // extension) — try native playback; the player falls back to a link if
  // the browser can't play it.
  return { kind: "direct", src: trimmed };
}
