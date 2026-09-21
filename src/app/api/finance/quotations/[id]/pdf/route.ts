import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { hasModuleAccess } from "@/lib/permissions-core";
import { getQuotationDetail } from "@/lib/quotations-data";
import { getFinanceVatSettings } from "@/lib/finance-settings";
import { COMPANY_INFO } from "@/lib/company-info";
import {
  computeLineItems, calculateDocumentTotals, evaluateVatApplicability,
  buildDocumentSnapshot, isPreIssueQuotationStatus, NOT_VAT_REGISTERED_NOTICE,
  type QuotationStatus, type DocumentSnapshotInput,
} from "@/lib/finance-core";
import { generateFinancePdf } from "@/lib/finance-pdf";

/**
 * Serves a quotation as a branded PDF. An Approved/Sent/etc. quotation
 * is rendered from its immutable snapshot (never live data — see
 * docs/FINANCE_MODULE.md). A Draft/Pending Approval quotation has no
 * snapshot yet, so this builds an equivalent structure from CURRENT
 * live data and marks it a watermarked, non-official preview — the
 * same generateFinancePdf() renderer either way, never two competing
 * PDF layouts.
 *
 * Access is enforced the same way as the quotation detail page:
 * getQuotationDetail() already returns null for both "doesn't exist"
 * and "not authorised", so a disallowed id can't be distinguished from
 * a nonexistent one, and a non-privileged (Sales) user can only ever
 * download a PDF for a quotation they created.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permissions = await getCurrentUserPermissions();

  if (permissions.status === "signed-out") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (permissions.status === "pending-approval") {
    return NextResponse.json({ error: "Your account is still pending approval." }, { status: 403 });
  }
  if (!hasModuleAccess(permissions, "finance")) {
    return NextResponse.json({ error: "You don't have access to Finance." }, { status: 403 });
  }

  const quotation = await getQuotationDetail(id, permissions);
  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  let snapshot: DocumentSnapshotInput;
  const isPreview = isPreIssueQuotationStatus(quotation.status as QuotationStatus);

  if (!isPreview && quotation.snapshot) {
    // Approved+ — the whole point is to render EXACTLY what was issued.
    snapshot = quotation.snapshot as unknown as DocumentSnapshotInput;
  } else {
    // Draft/Pending Approval (or, defensively, an older row with no
    // snapshot) — build a live equivalent for a watermarked preview
    // only. Never presented as the official document.
    const supabase = createServiceClient();
    const { data: customer } = await supabase.from("customers").select("*").eq("id", quotation.customerId).maybeSingle();

    const lineItemInputs = quotation.lineItems.map((li) => ({
      productService: li.productService, description: li.description, quantity: li.quantity, unit: li.unit, unitPrice: li.unitPrice,
    }));
    const vatSettings = await getFinanceVatSettings();
    const today = new Date().toISOString().slice(0, 10);
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: today,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });
    const totals = calculateDocumentTotals(lineItemInputs, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lineItemInputs);

    snapshot = buildDocumentSnapshot({
      customer: {
        name: customer?.name ?? quotation.customerName,
        customerCode: customer?.customer_code ?? null,
        billingAddress: customer?.billing_address ?? null,
        contact: customer?.contact ?? null,
        email: customer?.email ?? null,
        phone: customer?.phone ?? null,
        vatRegistered: customer?.vat_registered === true,
        vatNumber: customer?.vat_number ?? null,
      },
      company: COMPANY_INFO,
      vat: { applied: totals.vatApplied, rate: totals.vatRate, amount: totals.vatAmount, registrationNumber: totals.vatApplied ? vatSettings.vatRegistrationNumber : null },
      lineItems: computedLines,
      totals,
      terms: quotation.terms, notes: quotation.notes,
      nonVatNotice: totals.vatApplied ? null : NOT_VAT_REGISTERED_NOTICE,
      templateVersion: "v1",
    });
  }

  const pdfBuffer = await generateFinancePdf({
    kind: "quotation",
    documentNumber: quotation.quotationNumber,
    status: quotation.status,
    revisionNumber: quotation.revisionNumber,
    issueDate: quotation.issueDate,
    validUntil: quotation.validUntil,
    snapshot,
    isPreview,
  });

  const filename = `${quotation.quotationNumber ?? `Quotation-Draft-${quotation.id.slice(0, 8)}`}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
