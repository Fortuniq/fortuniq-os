import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Next.js's own default Server Action body limit is 1MB — far
      // under FortunIQ OS's own 8MB file-upload ceiling (see
      // docs/DOCUMENT_CONTROL.md, "Upload size limit"). Set well above
      // 8MB to leave real headroom for multipart/form-data overhead
      // (boundaries, part headers, other form fields sent alongside the
      // file) — Next.js's own docs recommend leaving 10–20KB of margin
      // for that overhead alone, and this app's upload forms also
      // include several text fields in the same submission. Without
      // this, any file between 1MB and 8MB is rejected at the
      // FRAMEWORK level before ever reaching the application's own
      // size check — and on Netlify's Next.js runtime specifically,
      // that rejection surfaces as a raw crash ("Cannot set property
      // socket of #<ComputeJsIncomingMessage>...") instead of a clean
      // error, because the request gets aborted mid-stream in a way
      // Netlify's request wrapper doesn't expect.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
