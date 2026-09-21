import { describe, it, expect } from "vitest";
import {
  roundToCents, calculateLineTotal, computeLineItems, calculateSubtotal,
  calculateDocumentTotals, formatDocumentNumber, sequenceKeyFor, documentHeading,
  requiresRevisionToEdit, statusAfterRevised, calculateOutstandingBalance,
  derivePaymentStatus, formatCustomerCode, validateLineItems, DEFAULT_NON_VAT_NOTICE,
  isPreIssueQuotationStatus, evaluateVatApplicability, NOT_VAT_REGISTERED_NOTICE,
  canAccessCustomerForQuotation, buildDocumentSnapshot,
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
  it("only Draft or Pending Approval can be edited in place", () => {
    expect(requiresRevisionToEdit("Draft")).toBe(false);
    expect(requiresRevisionToEdit("Pending Approval")).toBe(false);
    expect(requiresRevisionToEdit("Approved")).toBe(true);
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

describe("isPreIssueQuotationStatus", () => {
  it("Draft and Pending Approval are pre-issue", () => {
    expect(isPreIssueQuotationStatus("Draft")).toBe(true);
    expect(isPreIssueQuotationStatus("Pending Approval")).toBe(true);
  });
  it("Approved onward is issued", () => {
    expect(isPreIssueQuotationStatus("Approved")).toBe(false);
    expect(isPreIssueQuotationStatus("Sent")).toBe(false);
    expect(isPreIssueQuotationStatus("Revised")).toBe(false);
  });
});

describe("evaluateVatApplicability — the VAT hard block", () => {
  const financeAdmin = { requesterIsAdmin: true, requesterRole: null };
  const financeUser = { requesterIsAdmin: false, requesterRole: "Finance" };
  const salesUser = { requesterIsAdmin: false, requesterRole: "Sales/Marketing" };

  it("blocks when FortunIQ is not VAT registered, even if everything else is set", () => {
    const result = evaluateVatApplicability({
      settings: { companyVatRegistered: false, vatRegistrationNumber: "4123456789", vatEffectiveDate: "2026-01-01", vatRate: 15 },
      transactionDate: "2026-09-17",
      ...financeAdmin,
    });
    expect(result.allowed).toBe(false);
    expect(result.vatRate).toBe(0);
  });

  it("blocks when registered but no VAT number on file", () => {
    const result = evaluateVatApplicability({
      settings: { companyVatRegistered: true, vatRegistrationNumber: null, vatEffectiveDate: "2026-01-01", vatRate: 15 },
      transactionDate: "2026-09-17",
      ...financeAdmin,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks when registered but no effective date on file", () => {
    const result = evaluateVatApplicability({
      settings: { companyVatRegistered: true, vatRegistrationNumber: "4123456789", vatEffectiveDate: null, vatRate: 15 },
      transactionDate: "2026-09-17",
      ...financeAdmin,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks a document dated before the VAT effective date", () => {
    const result = evaluateVatApplicability({
      settings: { companyVatRegistered: true, vatRegistrationNumber: "4123456789", vatEffectiveDate: "2027-01-01", vatRate: 15 },
      transactionDate: "2026-09-17",
      ...financeAdmin,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks a Sales user even when company config is fully valid", () => {
    const result = evaluateVatApplicability({
      settings: { companyVatRegistered: true, vatRegistrationNumber: "4123456789", vatEffectiveDate: "2026-01-01", vatRate: 15 },
      transactionDate: "2026-09-17",
      ...salesUser,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Finance or Super Admin");
  });

  it("allows only when every condition holds and requester is Finance or Super Admin", () => {
    const config = { companyVatRegistered: true, vatRegistrationNumber: "4123456789", vatEffectiveDate: "2026-01-01", vatRate: 15 };
    const asFinance = evaluateVatApplicability({ settings: config, transactionDate: "2026-09-17", ...financeUser });
    const asAdmin = evaluateVatApplicability({ settings: config, transactionDate: "2026-09-17", ...financeAdmin });
    expect(asFinance.allowed).toBe(true);
    expect(asFinance.vatRate).toBe(15);
    expect(asAdmin.allowed).toBe(true);
  });

  it("today's real FortunIQ state (not VAT registered) always blocks, regardless of who asks", () => {
    const today = evaluateVatApplicability({
      settings: { companyVatRegistered: false, vatRegistrationNumber: null, vatEffectiveDate: null, vatRate: 15 },
      transactionDate: "2026-09-17",
      ...financeAdmin,
    });
    expect(today.allowed).toBe(false);
  });
});

describe("NOT_VAT_REGISTERED_NOTICE", () => {
  it("matches the exact required wording", () => {
    expect(NOT_VAT_REGISTERED_NOTICE).toBe(
      "FortunIQ Fuels (Pty) Ltd is currently not registered as a Value-Added Tax (VAT) vendor. Accordingly, no VAT has been charged or included in this quotation/invoice."
    );
  });
});

describe("canAccessCustomerForQuotation — ownership scoping", () => {
  it("Super Admin always passes", () => {
    expect(canAccessCustomerForQuotation({ requesterIsAdmin: true, requesterRole: null, requesterEmail: "x@fortuniq.co.za", customerAccountOwnerEmail: "someone.else@fortuniq.co.za" })).toBe(true);
  });
  it("Finance and Management always pass", () => {
    expect(canAccessCustomerForQuotation({ requesterIsAdmin: false, requesterRole: "Finance", requesterEmail: "x@fortuniq.co.za", customerAccountOwnerEmail: "someone.else@fortuniq.co.za" })).toBe(true);
    expect(canAccessCustomerForQuotation({ requesterIsAdmin: false, requesterRole: "Management", requesterEmail: "x@fortuniq.co.za", customerAccountOwnerEmail: "someone.else@fortuniq.co.za" })).toBe(true);
  });
  it("an unassigned account (no owner) is open to any Sales user", () => {
    expect(canAccessCustomerForQuotation({ requesterIsAdmin: false, requesterRole: "Sales/Marketing", requesterEmail: "katlego@fortuniq.co.za", customerAccountOwnerEmail: null })).toBe(true);
  });
  it("a Sales user can access their own assigned account", () => {
    expect(canAccessCustomerForQuotation({ requesterIsAdmin: false, requesterRole: "Sales/Marketing", requesterEmail: "Katlego@FortunIQ.co.za", customerAccountOwnerEmail: "katlego@fortuniq.co.za" })).toBe(true);
  });
  it("a Sales user is blocked from another rep's assigned account", () => {
    expect(canAccessCustomerForQuotation({ requesterIsAdmin: false, requesterRole: "Sales/Marketing", requesterEmail: "thabo@fortuniq.co.za", customerAccountOwnerEmail: "katlego@fortuniq.co.za" })).toBe(false);
  });
});

describe("buildDocumentSnapshot", () => {
  it("captures customer VAT status independently of FortunIQ's own VAT status", () => {
    const snapshot = buildDocumentSnapshot({
      customer: { name: "Rustenburg Mining Group", vatRegistered: true, vatNumber: "4123456789" },
      company: { registrationNumber: "2020/000000/07" },
      vat: { applied: false, rate: 0, amount: 0 },
      lineItems: computeLineItems([{ productService: "Diesel", quantity: 39_864, unitPrice: 25.20 }]),
      totals: calculateDocumentTotals([{ productService: "Diesel", quantity: 39_864, unitPrice: 25.20 }], { vatApplied: false, vatRate: 15 }),
      templateVersion: "v1",
    });
    // Customer's own VAT registration is preserved for display...
    expect(snapshot.customer.vatRegistered).toBe(true);
    expect(snapshot.customer.vatNumber).toBe("4123456789");
    // ...but never causes VAT to be applied on the document itself.
    expect(snapshot.vat.applied).toBe(false);
    expect(snapshot.totals.total).toBe(snapshot.totals.subtotal);
    expect(snapshot.snapshotTakenAt).toBeTruthy();
  });
});
