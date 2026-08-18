import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Next.js's own default Server Action body limit is 1MB — well
      // under the 4MB SharePoint simple-upload ceiling this app
      // actually enforces in code (see docs/DOCUMENT_CONTROL.md,
      // "Upload size limit"). Any file between 1MB and 4MB was being
      // silently rejected at the FRAMEWORK level before ever reaching
      // the application's own size check — and on Netlify's Next.js
      // runtime specifically, that rejection surfaced as a raw crash
      // ("Cannot set property socket of #<ComputeJsIncomingMessage>...")
      // instead of a clean error, because the request gets aborted
      // mid-stream in a way Netlify's request wrapper doesn't expect.
      // Set with headroom above the real 4MB ceiling so the
      // application's own, friendlier size check is what actually
      // fires for an oversized file, not this framework-level cutoff.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
