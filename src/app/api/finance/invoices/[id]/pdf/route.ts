import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { hasModuleAccess } from "@/lib/permissions-core";
import { getInvoiceDetail } from "@/lib/invoices-data";
import { getFinanceVatSettings } from "@/lib/finance-settings";
import { COMPANY_INFO } from "@/lib/company-info";
import {
  computeLineItems, calculateDocumentTotals, evaluateVatApplicability,
  buildDocumentSnapshot, isPreIssueInvoiceStatus, NOT_VAT_REGISTERED_NOTICE,
  type InvoiceStatus, type DocumentSnapshotInput,
} from "@/lib/finance-core";
import { generateFinancePdf } from "@/lib/finance-pdf";

/**
 * Serves an invoice as a branded PDF — identical shape to
 * /api/finance/quotations/[id]/pdf, see the comment there for the full
 * rationale (snapshot-based rendering for issued documents, a
 * watermarked live-data preview for Draft, same access enforcement as
 * the detail page).
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

  const invoice = await getInvoiceDetail(id, permissions);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  let snapshot: DocumentSnapshotInput;
  const isPreview = isPreIssueInvoiceStatus(invoice.status as InvoiceStatus);

  if (!isPreview && invoice.snapshot) {
    // Sent+ — the whole point is to render EXACTLY what was issued.
    snapshot = invoice.snapshot as unknown as DocumentSnapshotInput;
  } else {
    // Draft (or, defensively, an older row with no snapshot) — build a
    // live equivalent for a watermarked preview only.
    const supabase = createServiceClient();
    const { data: customer } = await supabase.from("customers").select("*").eq("id", invoice.customerId).maybeSingle();

    const lineItemInputs = invoice.lineItems.map((li) => ({
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
        name: customer?.name ?? invoice.customerName,
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
      terms: invoice.terms, notes: invoice.notes,
      nonVatNotice: totals.vatApplied ? null : NOT_VAT_REGISTERED_NOTICE,
      templateVersion: "v1",
    });
  }

  const pdfBuffer = await generateFinancePdf({
    kind: "invoice",
    documentNumber: invoice.invoiceNumber,
    status: invoice.status,
    revisionNumber: invoice.revisionNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    snapshot,
    isPreview,
  });

  const filename = `${invoice.invoiceNumber ?? `Invoice-Draft-${invoice.id.slice(0, 8)}`}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
