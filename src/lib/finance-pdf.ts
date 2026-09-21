import PDFDocument from "pdfkit";
import type { DocumentSnapshotInput } from "@/lib/finance-core";
import type { CompanyInfo } from "@/lib/company-info";
import { formatZARFull } from "@/lib/format";

/**
 * Renders a branded Quotation/Invoice PDF from a DOCUMENT SNAPSHOT —
 * the same immutable structure captured once at Approval
 * (buildDocumentSnapshot() in finance-core.ts). This function never
 * fetches anything itself and never reads "live" Customer/Settings
 * tables — whatever is passed in is exactly what gets printed, so an
 * Approved/Sent/etc. document's PDF can never drift from what was
 * actually approved.
 *
 * For a Draft/Pending Approval quotation (no snapshot exists yet — see
 * isPreIssueQuotationStatus in finance-core.ts), the caller builds an
 * equivalent object from LIVE data and passes isPreview: true, which
 * adds a watermark and disclaimer rather than using a second renderer —
 * one rendering path, never two competing ones.
 *
 * Uses pdfkit (pure JS, no headless browser) so this works in a
 * Netlify serverless function without a Chromium binary.
 */
export interface FinancePdfOptions {
  kind: "quotation" | "invoice";
  documentNumber: string | null; // null while still Draft/Pending Approval
  status: string;
  revisionNumber: number;
  issueDate: string | null;
  validUntil?: string | null; // quotations only
  snapshot: DocumentSnapshotInput;
  isPreview: boolean; // true = Draft/Pending Approval, no official number/snapshot yet
}

const INK = "#1C1B1C";
const ORANGE = "#F05A28";
const BODY_GREY = "#6E6E70";
const MUTED_GREY = "#9A9A9C";
const LIGHT_CARD = "#F5F4F3";

function heading(kind: "quotation" | "invoice"): "QUOTATION" | "INVOICE" {
  return kind === "quotation" ? "QUOTATION" : "INVOICE";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function generateFinancePdf(opts: FinancePdfOptions): Promise<Buffer> {
  const { kind, documentNumber, status, revisionNumber, issueDate, validUntil, snapshot, isPreview } = opts;
  const company = snapshot.company as unknown as CompanyInfo;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ---------- Letterhead ----------
    // No logo IMAGE asset is on file yet (see company-info.ts) — this is
    // a deliberate text/colour treatment, not a placeholder box, so the
    // document still reads as properly branded rather than broken.
    doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth, 4).fill(ORANGE);
    doc.moveDown(0.6);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(company.tradingName ?? "FortunIQ Fuels", { continued: false });
    doc.fillColor(ORANGE).font("Helvetica-Oblique").fontSize(10).text(company.tagline ?? "Fortune in Every Drop.");
    doc.moveDown(0.3);
    doc.fillColor(BODY_GREY).font("Helvetica").fontSize(8);
    doc.text(company.legalName ?? "");
    doc.text(`Reg. No: ${company.registrationNumber ?? "—"}   |   Petroleum Wholesale Licence: ${company.petroleumWholesaleLicenceNumber ?? "—"}`);
    doc.text(`SARS Income Tax Ref: ${company.sarsIncomeTaxReferenceNumber ?? "—"}`);
    doc.text(`${company.addresses?.registered ?? ""}`);
    doc.text(`${company.website ?? ""}   |   ${company.email ?? ""}   |   ${company.phone ?? ""}`);
    const letterheadBottomY = doc.y;

    // ---------- Document heading ----------
    // Drawn as a second, independent "column" anchored back at the top
    // (headingY), right-aligned across the full content width. pdfkit
    // only tracks one doc.y cursor, so once this column finishes
    // flowing it may leave doc.y ABOVE where the letterhead column
    // actually ended (the letterhead has more, shorter lines) — the
    // explicit max() below is what stops the divider/next section from
    // being drawn on top of whichever column is taller.
    const headingY = doc.page.margins.top;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(24).text(heading(kind), doc.page.margins.left, headingY, { align: "right", width: pageWidth });
    doc.font("Helvetica").fontSize(10).fillColor(BODY_GREY);
    doc.text(documentNumber ?? "Draft — not yet issued", { align: "right", width: pageWidth });
    if (revisionNumber > 1) doc.text(`Revision ${revisionNumber}`, { align: "right", width: pageWidth });
    doc.text(`Status: ${status}`, { align: "right", width: pageWidth });
    doc.text(`Issue Date: ${fmtDate(issueDate)}`, { align: "right", width: pageWidth });
    if (kind === "quotation" && validUntil) doc.text(`Valid Until: ${fmtDate(validUntil)}`, { align: "right", width: pageWidth });
    doc.y = Math.max(letterheadBottomY, doc.y);

    if (isPreview) {
      doc.save();
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.fillColor(MUTED_GREY).opacity(0.25).font("Helvetica-Bold").fontSize(60)
        .text("DRAFT — NOT ISSUED", 0, doc.page.height / 2 - 30, { align: "center", width: doc.page.width });
      doc.opacity(1);
      doc.restore();
    }

    doc.moveDown(2);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).strokeColor(LIGHT_CARD).lineWidth(1).stroke();
    doc.moveDown(1);

    // ---------- Customer block ----------
    const custY = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BODY_GREY).text("BILL TO", doc.page.margins.left, custY);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(snapshot.customer.name, doc.page.margins.left, doc.y + 2);
    doc.font("Helvetica").fontSize(9).fillColor(BODY_GREY);
    if (snapshot.customer.customerCode) doc.text(snapshot.customer.customerCode);
    if (snapshot.customer.billingAddress) doc.text(snapshot.customer.billingAddress);
    if (snapshot.customer.contact) doc.text(`Attn: ${snapshot.customer.contact}`);
    if (snapshot.customer.email) doc.text(snapshot.customer.email);
    if (snapshot.customer.phone) doc.text(snapshot.customer.phone);
    // Customer's OWN VAT registration — display-only, independent of
    // FortunIQ's VAT status (see finance-core.ts, evaluateVatApplicability
    // doc comment). Never implies VAT was charged on this document.
    if (snapshot.customer.vatRegistered && snapshot.customer.vatNumber) {
      doc.text(`Customer VAT Reg. No: ${snapshot.customer.vatNumber}`);
    }
    doc.moveDown(1.5);

    // ---------- Line items table ----------
    const colX = {
      item: doc.page.margins.left,
      qty: doc.page.margins.left + pageWidth * 0.44,
      unit: doc.page.margins.left + pageWidth * 0.58,
      rate: doc.page.margins.left + pageWidth * 0.70,
      total: doc.page.margins.left + pageWidth * 0.84,
    };
    const tableTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("white");
    doc.rect(doc.page.margins.left, tableTop, pageWidth, 20).fill(INK);
    doc.fillColor("white");
    doc.text("PRODUCT / SERVICE", colX.item + 6, tableTop + 6, { width: colX.qty - colX.item - 10 });
    doc.text("QTY", colX.qty, tableTop + 6, { width: colX.unit - colX.qty - 4, align: "right" });
    doc.text("UNIT", colX.unit, tableTop + 6, { width: colX.rate - colX.unit - 4 });
    doc.text("RATE", colX.rate, tableTop + 6, { width: colX.total - colX.rate - 4, align: "right" });
    doc.text("LINE TOTAL", colX.total, tableTop + 6, { width: pageWidth - (colX.total - doc.page.margins.left), align: "right" });

    let rowY = tableTop + 20;
    doc.font("Helvetica").fontSize(8.5).fillColor(INK);
    snapshot.lineItems.forEach((line, i) => {
      const rowHeight = line.description ? 28 : 18;
      if (rowY + rowHeight > doc.page.height - doc.page.margins.bottom - 140) {
        doc.addPage();
        rowY = doc.page.margins.top;
      }
      if (i % 2 === 1) doc.rect(doc.page.margins.left, rowY, pageWidth, rowHeight).fill(LIGHT_CARD);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5).text(line.productService, colX.item + 6, rowY + 4, { width: colX.qty - colX.item - 10 });
      if (line.description) {
        doc.font("Helvetica").fontSize(7.5).fillColor(BODY_GREY).text(line.description, colX.item + 6, rowY + 15, { width: colX.qty - colX.item - 10 });
      }
      doc.font("Helvetica").fontSize(8.5).fillColor(INK);
      doc.text(line.quantity.toLocaleString("en-ZA", { maximumFractionDigits: 3 }), colX.qty, rowY + 4, { width: colX.unit - colX.qty - 4, align: "right" });
      doc.text(line.unit ?? "—", colX.unit, rowY + 4, { width: colX.rate - colX.unit - 4 });
      doc.text(formatZARFull(line.unitPrice), colX.rate, rowY + 4, { width: colX.total - colX.rate - 4, align: "right" });
      doc.font("Helvetica-Bold").text(formatZARFull(line.lineTotal), colX.total, rowY + 4, { width: pageWidth - (colX.total - doc.page.margins.left), align: "right" });
      rowY += rowHeight;
    });
    doc.moveTo(doc.page.margins.left, rowY).lineTo(doc.page.margins.left + pageWidth, rowY).strokeColor(LIGHT_CARD).stroke();
    doc.y = rowY + 10;

    // ---------- Totals ----------
    const totalsWidth = 220;
    const totalsX = doc.page.margins.left + pageWidth - totalsWidth;
    doc.font("Helvetica").fontSize(9).fillColor(BODY_GREY);
    doc.text("Subtotal", totalsX, doc.y, { width: totalsWidth - 90 });
    doc.text(formatZARFull(snapshot.totals.subtotal), totalsX + totalsWidth - 90, doc.y - doc.currentLineHeight(), { width: 90, align: "right" });
    doc.text("VAT", totalsX, doc.y, { width: totalsWidth - 90 });
    doc.text(snapshot.vat.applied ? `${formatZARFull(snapshot.vat.amount)} (${snapshot.vat.rate}%)` : "Not Applicable", totalsX + totalsWidth - 90, doc.y - doc.currentLineHeight(), { width: 90, align: "right" });
    doc.moveDown(0.3);
    doc.moveTo(totalsX, doc.y).lineTo(totalsX + totalsWidth, doc.y).strokeColor(INK).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
    doc.text("Grand Total", totalsX, doc.y, { width: totalsWidth - 100 });
    doc.text(formatZARFull(snapshot.totals.total), totalsX + totalsWidth - 100, doc.y - doc.currentLineHeight(), { width: 100, align: "right" });
    doc.moveDown(1.5);

    // ---------- Non-VAT notice (exact required wording) ----------
    if (!snapshot.vat.applied && snapshot.nonVatNotice) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(BODY_GREY).text(snapshot.nonVatNotice, doc.page.margins.left, doc.y, { width: pageWidth });
      doc.moveDown(1);
    }

    // ---------- Terms / Notes ----------
    if (snapshot.terms) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Terms");
      doc.font("Helvetica").fontSize(8.5).fillColor(BODY_GREY).text(snapshot.terms, { width: pageWidth });
      doc.moveDown(0.6);
    }
    if (snapshot.notes) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Notes");
      doc.font("Helvetica").fontSize(8.5).fillColor(BODY_GREY).text(snapshot.notes, { width: pageWidth });
      doc.moveDown(0.6);
    }

    // ---------- Banking details ----------
    // Only lines actually on file are printed — never a fabricated
    // account number/branch code. See company-info.ts.
    const banking = company.banking;
    if (banking) {
      const bottomBlockY = doc.page.height - doc.page.margins.bottom - 90;
      const y = Math.max(doc.y + 10, bottomBlockY);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Banking Details", doc.page.margins.left, y);
      doc.font("Helvetica").fontSize(8.5).fillColor(BODY_GREY);
      doc.text(`Bank: ${banking.bank}`);
      doc.text(`Account Type: ${banking.accountType}`);
      doc.text(`Account Holder: ${banking.accountHolder}`);
      if (banking.accountNumber) doc.text(`Account Number: ${banking.accountNumber}`);
      if (banking.branchCode) doc.text(`Branch Code: ${banking.branchCode}`);
    }

    // ---------- Footer ----------
    const footerY = doc.page.height - doc.page.margins.bottom + 10;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED_GREY)
      .text(`${company.tradingName ?? ""} — ${company.tagline ?? ""}   |   ${company.website ?? ""}`, doc.page.margins.left, footerY, { width: pageWidth, align: "center" });

    doc.end();
  });
}
