import { describe, it, expect } from "vitest";
import {
  roundToCents, calculateLineTotal, computeLineItems, calculateSubtotal,
  calculateDocumentTotals, formatDocumentNumber, sequenceKeyFor, documentHeading,
  requiresRevisionToEdit, statusAfterRevised, calculateOutstandingBalance,
  derivePaymentStatus, formatCustomerCode, validateLineItems, DEFAULT_NON_VAT_NOTICE,
} from "./finance-core";

describe("roundToCents", () => {
  it("avoids floating-point drift", () => {
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
  });
  it("rounds half-up to 2 decimals", () => {
    expect(roundToCents(1.005)).toBe(1.01);
    expect(roundToCents(458.649999)).toBe(458.65);
  });
});

describe("calculateLineTotal — Quantity x Rate", () => {
  it("matches the brief's worked example exactly", () => {
    expect(calculateLineTotal(39_864, 25.20)).toBe(1_004_572.80);
  });
  it("supports sub-cent per-unit rates without losing precision on the total", () => {
    expect(calculateLineTotal(1000, 18.875)).toBe(18_875);
  });
  it("supports fractional rates like R458.65", () => {
    expect(calculateLineTotal(2, 458.65)).toBe(917.30);
  });
  it("returns 0 for non-finite input rather than NaN", () => {
    expect(calculateLineTotal(NaN, 10)).toBe(0);
    expect(calculateLineTotal(10, Infinity)).toBe(0);
  });
});

describe("computeLineItems / calculateSubtotal", () => {
  it("sums multiple line items into a grand total", () => {
    const lines = computeLineItems([
      { productService: "Diesel 50ppm", quantity: 39_864, unitPrice: 25.20 },
      { productService: "ULP 95", quantity: 1000, unitPrice: 24.65 },
    ]);
    expect(lines[0].lineTotal).toBe(1_004_572.80);
    expect(lines[1].lineTotal).toBe(24_650);
    expect(calculateSubtotal(lines)).toBe(1_029_222.80);
  });
});

describe("calculateDocumentTotals — VAT OFF (current FortunIQ state)", () => {
  it("never applies VAT when vatApplied is false, regardless of vatRate on file", () => {
    const totals = calculateDocumentTotals(
      [{ productService: "Diesel 50ppm", quantity: 1000, unitPrice: 25.20 }],
      { vatApplied: false, vatRate: 15 }
    );
    expect(totals.vatApplied).toBe(false);
    expect(totals.vatAmount).toBe(0);
    expect(totals.vatRate).toBe(0);
    expect(totals.total).toBe(totals.subtotal);
    expect(totals.total).toBe(25_200);
  });
});

describe("calculateDocumentTotals — VAT ON (future-readiness)", () => {
  it("applies VAT only when explicitly told to for that document", () => {
    const totals = calculateDocumentTotals(
      [{ productService: "Diesel 50ppm", quantity: 1000, unitPrice: 25.20 }],
      { vatApplied: true, vatRate: 15 }
    );
    expect(totals.vatApplied).toBe(true);
    expect(totals.vatAmount).toBe(3_780);
    expect(totals.total).toBe(28_980);
  });
});

describe("formatDocumentNumber", () => {
  it("zero-pads to 4 digits", () => {
    expect(formatDocumentNumber("FQ", 2026, 1)).toBe("FQ-2026-0001");
    expect(formatDocumentNumber("INV", 2026, 42)).toBe("INV-2026-0042");
  });
  it("grows beyond 4 digits without truncating", () => {
    expect(formatDocumentNumber("FQ", 2026, 10_234)).toBe("FQ-2026-10234");
  });
});

describe("sequenceKeyFor", () => {
  it("namespaces by document kind and year", () => {
    expect(sequenceKeyFor("quotation", 2026)).toBe("quotation:2026");
    expect(sequenceKeyFor("invoice", 2027)).toBe("invoice:2027");
  });
});

describe("documentHeading", () => {
  it("never says Tax Invoice or VAT Invoice", () => {
    expect(documentHeading("quotation")).toBe("QUOTATION");
    expect(documentHeading("invoice")).toBe("INVOICE");
  });
});

describe("revision control", () => {
  it("only a Draft can be edited in place", () => {
    expect(requiresRevisionToEdit("Draft")).toBe(false);
    expect(requiresRevisionToEdit("Issued")).toBe(true);
    expect(requiresRevisionToEdit("Accepted")).toBe(true);
    expect(requiresRevisionToEdit("Sent")).toBe(true);
    expect(requiresRevisionToEdit("Paid")).toBe(true);
  });
  it("marks the original Revised once superseded", () => {
    expect(statusAfterRevised()).toBe("Revised");
  });
});

describe("payments / outstanding balance", () => {
  it("computes balance and never goes negative on overpayment", () => {
    expect(calculateOutstandingBalance(1000, 400)).toBe(600);
    expect(calculateOutstandingBalance(1000, 1200)).toBe(0);
  });
  it("derives payment status", () => {
    expect(derivePaymentStatus(1000, 0)).toBe("Unpaid");
    expect(derivePaymentStatus(1000, 400)).toBe("Partially Paid");
    expect(derivePaymentStatus(1000, 1000)).toBe("Paid");
    expect(derivePaymentStatus(1000, 1500)).toBe("Paid");
  });
});

describe("formatCustomerCode", () => {
  it("zero-pads to 4 digits", () => {
    expect(formatCustomerCode(7)).toBe("CUST-0007");
  });
});

describe("validateLineItems", () => {
  it("requires at least one line item", () => {
    const errors = validateLineItems([]);
    expect(errors).toHaveLength(1);
  });
  it("rejects a zero or negative quantity", () => {
    const errors = validateLineItems([{ productService: "Diesel", quantity: 0, unitPrice: 25 }]);
    expect(errors.some((e) => e.message.includes("Quantity"))).toBe(true);
  });
  it("rejects a negative rate but allows a zero rate (e.g. a free line item)", () => {
    const negative = validateLineItems([{ productService: "Diesel", quantity: 10, unitPrice: -1 }]);
    expect(negative.some((e) => e.message.includes("Rate"))).toBe(true);
    const zero = validateLineItems([{ productService: "Diesel", quantity: 10, unitPrice: 0 }]);
    expect(zero).toHaveLength(0);
  });
  it("requires a product/service name", () => {
    const errors = validateLineItems([{ productService: "  ", quantity: 10, unitPrice: 25 }]);
    expect(errors.some((e) => e.message.includes("Product/Service"))).toBe(true);
  });
  it("passes for a valid multi-line quotation", () => {
    const errors = validateLineItems([
      { productService: "Diesel 50ppm", quantity: 39_864, unit: "litres", unitPrice: 25.20 },
      { productService: "ULP 95", quantity: 1000, unit: "litres", unitPrice: 24.65 },
    ]);
    expect(errors).toHaveLength(0);
  });
});

describe("DEFAULT_NON_VAT_NOTICE", () => {
  it("is present and does not claim VAT registration", () => {
    expect(DEFAULT_NON_VAT_NOTICE).toContain("not registered as a VAT vendor");
  });
});
