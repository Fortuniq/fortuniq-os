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

export type QuotationStatus =
  | "Draft" | "Pending Approval" | "Approved" | "Sent"
  | "Accepted" | "Declined" | "Expired" | "Revised" | "Cancelled" | "Converted";
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled";

/**
 * Pre-issue statuses may still use LIVE Customer/Company data and have
 * no document number yet. Once a quotation leaves this set (Approved
 * onward), a number is burned and an immutable snapshot is taken — see
 * buildDocumentSnapshot() below.
 */
const PRE_ISSUE_QUOTATION_STATUSES: QuotationStatus[] = ["Draft", "Pending Approval"];

export function isPreIssueQuotationStatus(status: QuotationStatus): boolean {
  return PRE_ISSUE_QUOTATION_STATUSES.includes(status);
}

/**
 * An invoice has a simpler lifecycle than a quotation — there is no
 * separate "Pending Approval" step (see InvoiceStatus above). Only
 * Draft uses live Customer/Company data and has no INV-YYYY-XXXX number
 * yet; issuing it (see issueInvoice() in invoice-actions.ts) allocates
 * the number, takes the immutable snapshot, and moves it straight to
 * Sent in one step.
 */
export function isPreIssueInvoiceStatus(status: InvoiceStatus): boolean {
  return status === "Draft";
}

/**
 * An issued document (anything past Pending Approval) must never be
 * edited in place — editing it means creating a revision instead. Only
 * Draft/Pending Approval may still be freely edited, since nothing has
 * been sent to the customer yet and no number/snapshot exists.
 */
export function requiresRevisionToEdit(status: QuotationStatus | InvoiceStatus): boolean {
  if (status === "Draft") return false;
  if (status === "Pending Approval") return false;
  return true;
}

/** The status the original row moves to once a revision is created from it. */
export function statusAfterRevised(): QuotationStatus {
  return "Revised";
}

// ---------- Quotation → Invoice conversion ----------

const CONVERTIBLE_QUOTATION_STATUSES: QuotationStatus[] = ["Approved", "Sent", "Accepted"];

/**
 * A quotation can become an invoice only once it has actually been
 * issued to the customer (Approved/Sent) or the customer has formally
 * accepted it — never while still Draft/Pending Approval (nothing
 * issued yet to invoice against) and never once it's
 * Declined/Expired/Cancelled/Revised/already Converted. See
 * convertQuotationToInvoice() in quotation-actions.ts, which ALSO
 * checks quotations.converted_to_invoice_id — the two checks together
 * guarantee a quotation is only ever converted once, even under a race.
 */
export function isConvertibleQuotationStatus(status: QuotationStatus): boolean {
  return CONVERTIBLE_QUOTATION_STATUSES.includes(status);
}

// ---------- VAT hard block ----------

export interface VatSettingsSnapshot {
  companyVatRegistered: boolean;
  vatRegistrationNumber: string | null;
  vatEffectiveDate: string | null; // ISO date
  vatRate: number;
}

export interface VatApplicabilityRequest {
  settings: VatSettingsSnapshot;
  transactionDate: string;          // ISO date — the document's issue date
  requesterIsAdmin: boolean;
  requesterRole: string | null;     // RoleKey, kept as string here to avoid a cross-module type dependency in this zero-dependency file
}

export interface VatApplicabilityResult {
  allowed: boolean;
  reason?: string;
  vatRate: number; // the rate to use if allowed; 0 if not allowed
}

/**
 * THE VAT HARD BLOCK. This is the single, backend-enforced gate that
 * decides whether a document is even PERMITTED to carry VAT — it is
 * never enough for a caller to simply pass vatApplied:false; this
 * function is the only place allowed to say "true", and only when
 * every one of the following holds:
 *
 *   1. FortunIQ Fuels' own Finance Settings show VAT Registered = true
 *      (a CUSTOMER's own vat_registered/vat_number are irrelevant here
 *      — see docs/FINANCE_MODULE.md's VAT independence note).
 *   2. A non-blank VAT Registration Number is on file.
 *   3. A VAT effective date is on file.
 *   4. The document's transaction date falls on/after that effective
 *      date (a document dated before FortunIQ's VAT liability began
 *      must never carry VAT even after registration happens).
 *   5. The requesting user is Super Admin or holds the Finance role.
 *
 * Every server action that could possibly apply VAT MUST call this and
 * use its result — never trust a client-supplied vatApplied flag.
 */
export function evaluateVatApplicability(req: VatApplicabilityRequest): VatApplicabilityResult {
  const { settings, transactionDate, requesterIsAdmin, requesterRole } = req;

  if (!settings.companyVatRegistered) {
    return { allowed: false, reason: "FortunIQ Fuels is not currently registered as a VAT vendor.", vatRate: 0 };
  }
  if (!settings.vatRegistrationNumber || !settings.vatRegistrationNumber.trim()) {
    return { allowed: false, reason: "No VAT Registration Number is on file in Finance Settings.", vatRate: 0 };
  }
  if (!settings.vatEffectiveDate) {
    return { allowed: false, reason: "No VAT effective date is on file in Finance Settings.", vatRate: 0 };
  }
  if (!transactionDate || transactionDate < settings.vatEffectiveDate) {
    return { allowed: false, reason: "This document's date falls before FortunIQ Fuels' VAT effective date.", vatRate: 0 };
  }
  if (!requesterIsAdmin && requesterRole !== "Finance") {
    return { allowed: false, reason: "Only Finance or Super Admin may issue a VAT-inclusive document.", vatRate: 0 };
  }

  return { allowed: true, vatRate: settings.vatRate };
}

export const NOT_VAT_REGISTERED_NOTICE =
  "FortunIQ Fuels (Pty) Ltd is currently not registered as a Value-Added Tax (VAT) vendor. Accordingly, no VAT has been charged or included in this quotation/invoice.";

// ---------- Customer ownership scoping (Sales: own customers only) ----------

export interface CustomerOwnershipCheck {
  requesterIsAdmin: boolean;
  requesterRole: string | null;
  requesterEmail: string | null;
  customerAccountOwnerEmail: string | null;
}

/**
 * Server-side enforcement (never UI-only) of: Sales users may only
 * create/view draft quotations for customers they're authorised to
 * access. Finance, Management and Super Admin always pass — their
 * broader access comes from the existing RBAC role model, not from
 * account ownership.
 */
export function canAccessCustomerForQuotation(check: CustomerOwnershipCheck): boolean {
  const { requesterIsAdmin, requesterRole, requesterEmail, customerAccountOwnerEmail } = check;
  if (requesterIsAdmin) return true;
  if (requesterRole === "Finance" || requesterRole === "Management") return true;
  if (!customerAccountOwnerEmail) return true; // unassigned account — open to any Sales user until claimed
  return (requesterEmail ?? "").toLowerCase() === customerAccountOwnerEmail.toLowerCase();
}

// ---------- Issued-document snapshots ----------

export interface DocumentSnapshotInput {
  customer: {
    name: string;
    customerCode?: string | null;
    billingAddress?: string | null;
    contact?: string | null;
    email?: string | null;
    phone?: string | null;
    vatRegistered: boolean;
    vatNumber?: string | null;
  };
  company: Record<string, unknown>; // FortunIQ legal/registration/banking/brand facts, passed through as-is
  vat: { applied: boolean; rate: number; amount: number; registrationNumber?: string | null };
  lineItems: FinanceLineItemComputed[];
  totals: FinanceDocumentTotals;
  terms?: string | null;
  notes?: string | null;
  nonVatNotice?: string | null;
  templateVersion: string;
}

/**
 * Builds the immutable snapshot persisted to quotations.snapshot /
 * invoices.snapshot at the moment a document is Approved. Deliberately
 * a pure function of its inputs — the caller is responsible for
 * fetching the CURRENT customer/company/settings data and passing it in
 * ONCE, at approval time; this function does not fetch anything itself,
 * so there is no risk of it silently re-reading live data later.
 */
export function buildDocumentSnapshot(input: DocumentSnapshotInput): DocumentSnapshotInput & { snapshotTakenAt: string } {
  return { ...input, snapshotTakenAt: new Date().toISOString() };
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
