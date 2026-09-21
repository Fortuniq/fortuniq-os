import { describe, it, expect } from "vitest";
import { generateFinancePdf } from "./finance-pdf";
import { computeLineItems, calculateDocumentTotals, buildDocumentSnapshot, NOT_VAT_REGISTERED_NOTICE } from "./finance-core";
import { COMPANY_INFO } from "./company-info";

function sampleSnapshot(vatApplied: boolean) {
  const lines = [{ productService: "Diesel 50ppm", quantity: 39_864, unit: "litres", unitPrice: 25.20 }];
  const totals = calculateDocumentTotals(lines, { vatApplied, vatRate: 15 });
  return buildDocumentSnapshot({
    customer: { name: "Rustenburg Mining Group", customerCode: "CUST-0001", vatRegistered: true, vatNumber: "4123456789" },
    company: COMPANY_INFO,
    vat: { applied: totals.vatApplied, rate: totals.vatRate, amount: totals.vatAmount },
    lineItems: computeLineItems(lines),
    totals,
    nonVatNotice: totals.vatApplied ? null : NOT_VAT_REGISTERED_NOTICE,
    templateVersion: "v1",
  });
}

describe("generateFinancePdf", () => {
  it("produces a valid, non-empty PDF for an issued (non-VAT) quotation", async () => {
    const buffer = await generateFinancePdf({
      kind: "quotation", documentNumber: "FQ-2026-0001", status: "Approved", revisionNumber: 1,
      issueDate: "2026-09-17", validUntil: "2026-10-17", snapshot: sampleSnapshot(false), isPreview: false,
    });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("produces a valid PDF for a draft preview (watermarked)", async () => {
    const buffer = await generateFinancePdf({
      kind: "quotation", documentNumber: null, status: "Draft", revisionNumber: 1,
      issueDate: null, validUntil: null, snapshot: sampleSnapshot(false), isPreview: true,
    });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("produces a valid PDF when VAT is applied (future-readiness path)", async () => {
    const buffer = await generateFinancePdf({
      kind: "quotation", documentNumber: "FQ-2027-0001", status: "Approved", revisionNumber: 1,
      issueDate: "2027-01-01", validUntil: null, snapshot: sampleSnapshot(true), isPreview: false,
    });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
