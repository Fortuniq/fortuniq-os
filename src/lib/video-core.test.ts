import { describe, it, expect } from "vitest";
import { resolveVideoSource } from "./video-core";

describe("resolveVideoSource", () => {
  it("returns null for empty input", () => {
    expect(resolveVideoSource("")).toBeNull();
    expect(resolveVideoSource("   ")).toBeNull();
    expect(resolveVideoSource(null)).toBeNull();
  });

  it("flags non-URLs and non-http(s) schemes as invalid", () => {
    expect(resolveVideoSource("not a url")).toEqual({ kind: "invalid" });
    expect(resolveVideoSource("javascript:alert(1)")).toEqual({ kind: "invalid" });
  });

  it("converts every common YouTube form to a privacy-friendly embed", () => {
    const id = "dQw4w9WgXcQ";
    const expected = { kind: "embed", provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    expect(resolveVideoSource(`https://www.youtube.com/watch?v=${id}`)).toEqual(expected);
    expect(resolveVideoSource(`https://youtu.be/${id}`)).toEqual(expected);
    expect(resolveVideoSource(`https://m.youtube.com/watch?v=${id}&t=30s`)).toEqual(expected);
    expect(resolveVideoSource(`https://www.youtube.com/embed/${id}`)).toEqual(expected);
    expect(resolveVideoSource(`https://www.youtube.com/shorts/${id}`)).toEqual(expected);
  });

  it("converts Vimeo links, keeping the unlisted-video hash", () => {
    expect(resolveVideoSource("https://vimeo.com/123456789")).toEqual({ kind: "embed", provider: "Vimeo", src: "https://player.vimeo.com/video/123456789" });
    expect(resolveVideoSource("https://vimeo.com/123456789/abcdef1234")).toEqual({ kind: "embed", provider: "Vimeo", src: "https://player.vimeo.com/video/123456789?h=abcdef1234" });
    expect(resolveVideoSource("https://player.vimeo.com/video/123456789?h=abcdef1234")).toEqual({ kind: "embed", provider: "Vimeo", src: "https://player.vimeo.com/video/123456789?h=abcdef1234" });
  });

  it("plays direct media files natively", () => {
    expect(resolveVideoSource("https://cdn.example.com/lesson.mp4")).toEqual({ kind: "direct", src: "https://cdn.example.com/lesson.mp4" });
    expect(resolveVideoSource("https://cdn.example.com/lesson.webm?token=abc")).toEqual({ kind: "direct", src: "https://cdn.example.com/lesson.webm?token=abc" });
  });

  it("offers an Open link for SharePoint/OneDrive/Stream share pages instead of a dead player", () => {
    const sp = "https://fortuniq.sharepoint.com/:v:/s/Academy/EabC123?e=xyz";
    expect(resolveVideoSource(sp)).toEqual({ kind: "link", provider: "SharePoint", src: sp });
    expect(resolveVideoSource("https://1drv.ms/v/s!abc")).toMatchObject({ kind: "link", provider: "OneDrive" });
    expect(resolveVideoSource("https://web.microsoftstream.com/video/abc")).toMatchObject({ kind: "link", provider: "Microsoft Stream" });
  });

  it("still treats a SharePoint URL that is a real .mp4 file as playable", () => {
    expect(resolveVideoSource("https://fortuniq.sharepoint.com/sites/Academy/Shared%20Documents/intro.mp4")).toMatchObject({ kind: "direct" });
  });

  it("tries native playback for unknown hosts without an extension", () => {
    expect(resolveVideoSource("https://storage.example.com/obj/abc123")).toMatchObject({ kind: "direct" });
  });
});
