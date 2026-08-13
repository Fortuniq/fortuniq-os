// pdf-parse@1.x only ships type declarations for its package root, not
// its inner lib file — but the root's own index.js has a real bug that
// crashes on load in certain module contexts (see the comment in
// src/lib/graph.ts). Importing from the inner file directly avoids that
// bug entirely; this declaration just gives that import path the same
// documented shape the package root already has, so it can be a normal,
// type-checked import wherever it's used, without a suppression comment
// on every call site.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
  }
  interface PdfParseOptions {
    max?: number;
    pagerender?: (pageData: unknown) => string | Promise<string>;
  }
  function PdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
  export default PdfParse;
}
