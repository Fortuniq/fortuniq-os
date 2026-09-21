/**
 * Pure business logic for the Finance Module (Quotations, Invoices,
 * Payments). Zero DB/Next dependencies — see finance-core.test.ts.
 *
 * VAT PRINCIPLE (per Project ORION Finance Module clarification):
 * FortunIQ Fuels is NOT currently VAT registered. Nothing in this file
 * ever computes or displays a VAT amount unless it is explicitly told
 * vatApplied = true for that specific document — there is no "global on
 * switch" read here. A document's VAT fields are decided ONCE, at issue
 * time, by the caller (using Finance Settings' current VAT Registered
 * flag), and are then permanent, immutable facts about that document —
 * this file never recomputes them from "current" settings.
 */

// ---------- Money / line-item calculations ----------

/**
 * Rounds a number to 2 decimal places (cents) using standard
 * half-up rounding, avoiding floating-point artifacts like
 * 0.1 + 0.2 !== 0.3 by rounding through integer cents.
 */
export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface FinanceLineItemInput {
  productService: string;
  description?: string | null;
  quantity: number;   // supports fractional units (e.g. litres)
  unit?: string | null;
  unitPrice: number;  // supports sub-cent rates (e.g. R18.875/litre)
}

export interface FinanceLineItemComputed extends FinanceLineItemInput {
  lineTotal: number;  // quantity * unitPrice, rounded to cents
}

/**
 * The Calculation Engine's current, validated rule for Quotations and
 * Invoices: Quantity × Rate = Line Total. This is deliberately the ONLY
 * calculation performed here — no VAT, no levies, no surcharges. A
 * separate future Excel-derived Calculation Tool (a distinct feature,
 * not yet built) may add further calculations later, but must never be
 * assumed to apply to quotations/invoices without being explicitly
 * wired in after validation against the source Excel workbook.
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return roundToCents(quantity * unitPrice);
}

export function computeLineItems(lines: FinanceLineItemInput[]): FinanceLineItemComputed[] {
  return lines.map((line) => ({
    ...line,
    lineTotal: calculateLineTotal(line.quantity, line.unitPrice),
  }));
}

export function calculateSubtotal(lines: FinanceLineItemComputed[]): number {
  return roundToCents(lines.reduce((sum, l) => sum + l.lineTotal, 0));
}

export interface VatConfig {
  vatApplied: boolean;   // whether VAT applies to THIS document, decided at issue time
  vatRate: number;       // percentage, e.g. 15 for 15%. Ignored (treated as 0) when vatApplied is false.
}

export interface FinanceDocumentTotals {
  subtotal: number;
  vatApplied: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;
}

/**
 * Computes a document's totals from its line items and a VAT decision
 * that has ALREADY been made by the caller for this specific document.
 * When vatApplied is false, vatAmount is always 0 and total === subtotal,
 * regardless of what vatRate is set to (vatRate may still be non-zero —
 * e.g. Finance Settings keeps "15" on file as the standard SA rate ready
 * for future use — but it is never applied while vatApplied is false).
 */
export function calculateDocumentTotals(lines: FinanceLineItemInput[], vat: VatConfig): FinanceDocumentTotals {
  const computed = computeLineItems(lines);
  const subtotal = calculateSubtotal(computed);
  const vatApplied = vat.vatApplied === true;
  const vatAmount = vatApplied ? roundToCents(subtotal * (vat.vatRate / 100)) : 0;
  const total = roundToCents(subtotal + vatAmount);
  return { subtotal, vatApplied, vatRate: vatApplied ? vat.vatRate : 0, vatAmount, total };
}

// ---------- Document numbering ----------

/**
 * Formats a sequential number into the display format used on
 * quotations/invoices, e.g. formatDocumentNumber("FQ", 2026, 1) => "FQ-2026-0001".
 * The numeric part is zero-padded to 4 digits and grows beyond that
 * naturally (e.g. 10000 => "FQ-2026-10000") rather than truncating.
 */
export function formatDocumentNumber(prefix: string, year: number, sequence: number): string {
  const padded = sequence < 10000 ? String(sequence).padStart(4, "0") : String(sequence);
  return `${prefix}-${year}-${padded}`;
}

/** The sequence key used with next_finance_number(), namespaced per document kind and calendar year. */
export function sequenceKeyFor(kind: "quotation" | "invoice", year: number): string {
  return `${kind}:${year}`;
}

// ---------- VAT / non-VAT document wording ----------

export const DEFAULT_NON_VAT_NOTICE =
  "FortunIQ Fuels is currently not registered as a VAT vendor. No VAT has been charged.";

/**
 * The document heading to use. Per the brief: while not VAT registered,
 * documents must say "QUOTATION" / "INVOICE" — never "TAX INVOICE" or
 * "VAT INVOICE", even once VAT registration happens in future for a
 * specific document (the heading only changes if/when the business
 * explicitly decides documents should say "Tax Invoice", which is a
 * separate configuration decision, not an automatic consequence of
 * vatApplied being true).
 */
export function documentHeading(kind: "quotation" | "invoice"): "QUOTATION" | "INVOICE" {
  return kind === "quotation" ? "QUOTATION" : "INVOICE";
}

// ---------- Revision control ----------

export type QuotationStatus = "Draft" | "Issued" | "Revised" | "Accepted" | "Declined" | "Expired" | "Converted";
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled";

/**
 * An issued document (anything other than Draft) must never be edited
 * in place — editing it means creating a revision instead. Only a Draft
 * may still be freely edited.
 */
export function requiresRevisionToEdit(status: QuotationStatus | InvoiceStatus): boolean {
  return status !== "Draft";
}

/** The status the original row moves to once a revision is created from it. */
export function statusAfterRevised(): QuotationStatus {
  return "Revised";
}

// ---------- Payments / outstanding balance ----------

export function calculateOutstandingBalance(total: number, paidAmount: number): number {
  return roundToCents(Math.max(0, total - paidAmount));
}

/**
 * Derives the invoice's payment status from its total and how much has
 * been paid so far. Does NOT consider due date (that's a separate
 * Overdue concern, computed alongside this by the caller who knows
 * today's date and the due date) — this only distinguishes Paid /
 * Partially Paid / unpaid, matching how invoices.status should be kept
 * in sync whenever a payment is recorded or removed.
 */
export function derivePaymentStatus(total: number, paidAmount: number): "Paid" | "Partially Paid" | "Unpaid" {
  const paid = roundToCents(paidAmount);
  const due = roundToCents(total);
  if (paid <= 0) return "Unpaid";
  if (paid >= due) return "Paid";
  return "Partially Paid";
}

// ---------- Customer codes ----------

/** Formats a customer's short stable code, e.g. formatCustomerCode(7) => "CUST-0007". */
export function formatCustomerCode(sequence: number): string {
  const padded = sequence < 10000 ? String(sequence).padStart(4, "0") : String(sequence);
  return `CUST-${padded}`;
}

// ---------- Validation ----------

export interface LineItemValidationError {
  index: number;
  message: string;
}

/**
 * Validates line items before any calculation happens, so a bad value
 * (negative quantity, non-numeric rate, empty description) never
 * reaches the database or a PDF. Mirrors the parseTenderValue()
 * validate-before-side-effects pattern used elsewhere in this app.
 */
export function validateLineItems(lines: FinanceLineItemInput[]): LineItemValidationError[] {
  const errors: LineItemValidationError[] = [];
  if (lines.length === 0) {
    errors.push({ index: -1, message: "At least one line item is required." });
    return errors;
  }
  lines.forEach((line, index) => {
    if (!line.productService || !line.productService.trim()) {
      errors.push({ index, message: "Product/Service is required." });
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      errors.push({ index, message: "Quantity must be a positive number." });
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      errors.push({ index, message: "Rate must be a non-negative number." });
    }
  });
  return errors;
}
