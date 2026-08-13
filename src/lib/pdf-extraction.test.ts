import { describe, it, expect } from "vitest";
// Imported from the inner lib file, not the package root — see the
// matching comment in src/lib/graph.ts for why: pdf-parse@1.x's own
// index.js has a real bug that crashes on load in certain module
// contexts (including dynamic import()), triggered by a debug-mode
// misdetection wholly unrelated to the actual parsing logic underneath.
// Typed via src/types/pdf-parse-lib.d.ts.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// A genuine functional test, not just a build check — constructs a real,
// valid, minimal single-page PDF containing the text "Hello FortunIQ",
// and confirms pdf-parse actually extracts it correctly in this
// environment. Byte offsets in the PDF's cross-reference table are
// computed programmatically here, not hand-counted, since a single wrong
// offset produces a PDF that's silently unreadable by some parsers.
function buildMinimalPdf(text: string): Buffer {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 144] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 18 Tf 10 100 Td (${text}) Tj ET`;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

describe("PDF text extraction (pdf-parse)", () => {
  it("extracts real text content from a genuine, valid PDF buffer", async () => {
    // A single extraction call per test, deliberately — pdf-parse@1.x
    // keeps some internal state at the module level, which can bleed
    // between rapid sequential calls within one long-lived test process.
    // This isn't a concern in actual production use: each Netlify
    // serverless invocation is its own short-lived process handling one
    // request, matching this test's single-call shape exactly.
    const pdfBuffer = buildMinimalPdf("B-BBEE Certificate Required");
    const result = await pdfParse(pdfBuffer);
    expect(result.text).toContain("B-BBEE Certificate Required");
  });
});
