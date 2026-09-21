import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // pdfkit (Finance module PDF generation, src/lib/finance-pdf.ts) pulls
  // in fontkit, whose prebuilt dist/module.mjs imports a decorator
  // helper (`applyDecoratedDescriptor`) from `@swc/helpers` under a name
  // that this project's resolved @swc/helpers version no longer exports
  // (it now ships as `_apply_decorated_descriptor`). That mismatch only
  // surfaces because Turbopack/webpack tries to bundle fontkit's ESM
  // file through this app's module graph — a route handler running in
  // the Node.js runtime doesn't need it bundled at all; it can just
  // `require()` it natively at runtime, where the mismatch never
  // triggers. Listing both packages here (the stable, non-experimental
  // key as of Next.js 15+) tells Next to leave them external to the
  // server bundle instead of pulling them through Turbopack/webpack.
  // Only affects server-side route handlers/Server Components — this
  // app never imports pdfkit from client components.
  serverExternalPackages: ["pdfkit", "fontkit"],
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
