"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermissionAction, isNextRedirectError } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getFinanceVatSettings, getDocumentNumberPrefixes } from "@/lib/finance-settings";
import { COMPANY_INFO } from "@/lib/company-info";
import {
  computeLineItems, calculateDocumentTotals, validateLineItems, evaluateVatApplicability,
  canAccessCustomerForQuotation, buildDocumentSnapshot, formatDocumentNumber, sequenceKeyFor,
  isPreIssueInvoiceStatus, NOT_VAT_REGISTERED_NOTICE, type FinanceLineItemInput,
} from "@/lib/finance-core";

/**
 * Mirrors quotation-actions.ts exactly — same six hard controls (VAT
 * hard block, immutable issued-document snapshots, numbering allocated
 * at issue rather than creation, server-side customer ownership,
 * decimal-safe money via finance-core.ts, and never-throw {error?}
 * returns so a production Server Action never redacts the real reason
 * to a generic digest). The one structural difference: an invoice has
 * no separate "Pending Approval" step (see InvoiceStatus in
 * finance-core.ts) — issueInvoice() below allocates the number, takes
 * the snapshot, AND marks it Sent in one action.
 */

type LineItemFormRow = { productService: string; description?: string; quantity: number; unit?: string; unitPrice: number };

function parseLineItemsFromFormData(formData: FormData): FinanceLineItemInput[] {
  const raw = String(formData.get("lineItems") ?? "[]");
  let parsed: LineItemFormRow[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) => ({
    productService: String(row.productService ?? "").trim(),
    description: row.description ? String(row.description).trim() : null,
    quantity: Number(row.quantity),
    unit: row.unit ? String(row.unit).trim() : null,
    unitPrice: Number(row.unitPrice),
  }));
}

async function fetchCustomerForOwnershipCheck(customerId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
  return data;
}

/** Creates a new Draft invoice. No document number is allocated yet — see issueInvoice() below. */
export async function createInvoiceDraft(formData: FormData): Promise<{ error?: string; id?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Create");
    const supabase = createServiceClient();

    const customerId = String(formData.get("customerId") ?? "").trim();
    if (!customerId) return { error: "A customer is required." };

    const customer = await fetchCustomerForOwnershipCheck(customerId);
    if (!customer) return { error: "That customer could not be found." };

    const canAccess = canAccessCustomerForQuotation({
      requesterIsAdmin: permissions.isAdmin,
      requesterRole: permissions.role ?? null,
      requesterEmail: permissions.email ?? null,
      customerAccountOwnerEmail: customer.account_owner_email ?? null,
    });
    if (!canAccess) return { error: "You are not authorised to create an invoice for this customer." };

    const lines = parseLineItemsFromFormData(formData);
    const lineErrors = validateLineItems(lines);
    if (lineErrors.length > 0) return { error: lineErrors[0].message };

    const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const terms = String(formData.get("terms") ?? "").trim() || null;

    // Draft shows a LIVE, indicative total only — same VAT hard-block
    // preview pattern as quotations.
    const vatSettings = await getFinanceVatSettings();
    const today = new Date().toISOString().slice(0, 10);
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: today,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });
    const totals = calculateDocumentTotals(lines, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lines);

    const { data: inserted, error } = await supabase
      .from("invoices")
      .insert({
        customer_id: customerId,
        customer: customer.name, // legacy free-text column, kept in sync for the old Finance dashboard widget
        status: "Draft",
        subtotal: totals.subtotal,
        vat_applied: totals.vatApplied,
        vat_rate: totals.vatRate,
        vat_amount: totals.vatAmount,
        total: totals.total,
        amount: totals.total, // legacy column, kept in sync with total
        notes, terms,
        due_date: dueDate,
        created_by_name: permissions.name ?? null,
        created_by_email: (permissions.email ?? "unknown").toLowerCase(),
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("Failed to create invoice:", error);
      return { error: "Couldn't create this invoice. Please try again." };
    }

    const lineRows = computedLines.map((line, index) => ({
      invoice_id: inserted.id,
      line_order: index,
      product_service: line.productService,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }));
    const { error: lineError } = await supabase.from("invoice_line_items").insert(lineRows);
    if (lineError) {
      console.error("Failed to save invoice line items, rolling back the draft:", lineError);
      await supabase.from("invoices").delete().eq("id", inserted.id);
      return { error: "Couldn't save the line items for this invoice. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "invoice_created", targetType: "invoice", targetId: inserted.id,
      targetLabel: `Draft for ${customer.name}`,
      metadata: { customerId, lineCount: lineRows.length, total: totals.total },
    });

    revalidatePath("/finance/invoices");
    return { id: inserted.id };
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't create this invoice." };
  }
}

/** Edits an invoice that is still Draft. Anything Sent+ must be cancelled and re-issued instead — invoices don't carry a "Revised" state like quotations (see finance-core.ts). */
export async function updateInvoiceDraft(formData: FormData): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Missing invoice id." };

    const { data: existing } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
    if (!existing || !existing.customer_id) return { error: "That invoice could not be found." };
    if (!isPreIssueInvoiceStatus(existing.status)) {
      return { error: `A ${existing.status} invoice can no longer be edited — it has already been issued to the customer.` };
    }
    if (!permissions.isAdmin && permissions.role !== "Finance" && permissions.role !== "Management" && existing.created_by_email !== (permissions.email ?? "").toLowerCase()) {
      return { error: "You can only edit invoices you created." };
    }

    const customerId = String(formData.get("customerId") ?? existing.customer_id).trim();
    const customer = await fetchCustomerForOwnershipCheck(customerId);
    if (!customer) return { error: "That customer could not be found." };
    const canAccess = canAccessCustomerForQuotation({
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
      requesterEmail: permissions.email ?? null, customerAccountOwnerEmail: customer.account_owner_email ?? null,
    });
    if (!canAccess) return { error: "You are not authorised to assign this customer to this invoice." };

    const lines = parseLineItemsFromFormData(formData);
    const lineErrors = validateLineItems(lines);
    if (lineErrors.length > 0) return { error: lineErrors[0].message };

    const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const terms = String(formData.get("terms") ?? "").trim() || null;

    const vatSettings = await getFinanceVatSettings();
    const today = new Date().toISOString().slice(0, 10);
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: today,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });
    const totals = calculateDocumentTotals(lines, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lines);

    const { error } = await supabase.from("invoices").update({
      customer_id: customerId,
      customer: customer.name,
      subtotal: totals.subtotal, vat_applied: totals.vatApplied, vat_rate: totals.vatRate,
      vat_amount: totals.vatAmount, total: totals.total, amount: totals.total,
      notes, terms, due_date: dueDate,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      console.error("Failed to update invoice:", error);
      return { error: "Couldn't update this invoice. Please try again." };
    }

    await supabase.from("invoice_line_items").delete().eq("invoice_id", id);
    const lineRows = computedLines.map((line, index) => ({
      invoice_id: id, line_order: index, product_service: line.productService,
      description: line.description, quantity: line.quantity, unit: line.unit,
      unit_price: line.unitPrice, line_total: line.lineTotal,
    }));
    const { error: lineError } = await supabase.from("invoice_line_items").insert(lineRows);
    if (lineError) {
      console.error("Failed to save updated invoice line items:", lineError);
      return { error: "The invoice was updated but its line items could not be saved. Please re-open and try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "invoice_updated", targetType: "invoice", targetId: id, targetLabel: customer.name,
    });

    revalidatePath(`/finance/invoices/${id}`);
    revalidatePath("/finance/invoices");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't update this invoice." };
  }
}

/**
 * Issues a Draft invoice: allocates its permanent INV-YYYY-XXXX number,
 * re-evaluates the VAT hard block using the actual issuer's own
 * permissions (never trusting whatever was previewed at Draft time),
 * takes the immutable customer-facing snapshot, and marks it Sent — all
 * in one step, since invoices have no separate approval stage. This is
 * the ONE place an invoice_number and snapshot are ever written.
 */
export async function issueInvoice(id: string): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Approve");
    const supabase = createServiceClient();

    const { data: invoice } = await supabase.from("invoices").select("*, invoice_line_items(*)").eq("id", id).maybeSingle();
    if (!invoice || !invoice.customer_id) return { error: "That invoice could not be found." };
    if (invoice.status !== "Draft") {
      return { error: `Only a Draft invoice can be issued (this one is ${invoice.status}).` };
    }

    const customer = await fetchCustomerForOwnershipCheck(invoice.customer_id);
    if (!customer) return { error: "The customer on this invoice could not be found." };

    const issueDate = new Date().toISOString().slice(0, 10);
    const vatSettings = await getFinanceVatSettings();
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: issueDate,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });

    const lineItemInputs = (invoice.invoice_line_items ?? [])
      .sort((a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order)
      .map((li: { product_service: string; description: string | null; quantity: string; unit: string | null; unit_price: string }) => ({
        productService: li.product_service, description: li.description,
        quantity: Number(li.quantity), unit: li.unit, unitPrice: Number(li.unit_price),
      }));
    const totals = calculateDocumentTotals(lineItemInputs, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lineItemInputs);

    const { invoicePrefix } = await getDocumentNumberPrefixes();
    const year = new Date().getFullYear();
    const { data: sequenceNumber, error: seqError } = await supabase.rpc("next_finance_number", { p_seq_key: sequenceKeyFor("invoice", year) });
    if (seqError || typeof sequenceNumber !== "number") {
      console.error("Failed to allocate an invoice number:", seqError);
      return { error: "Couldn't allocate a document number for this invoice. Please try again." };
    }
    const invoiceNumber = formatDocumentNumber(invoicePrefix, year, sequenceNumber);

    const snapshot = buildDocumentSnapshot({
      customer: {
        name: customer.name, customerCode: customer.customer_code ?? null,
        billingAddress: customer.billing_address ?? null, contact: customer.contact ?? null,
        email: customer.email ?? null, phone: customer.phone ?? null,
        vatRegistered: customer.vat_registered === true, vatNumber: customer.vat_number ?? null,
      },
      company: COMPANY_INFO,
      vat: { applied: totals.vatApplied, rate: totals.vatRate, amount: totals.vatAmount, registrationNumber: totals.vatApplied ? vatSettings.vatRegistrationNumber : null },
      lineItems: computedLines,
      totals,
      terms: invoice.terms, notes: invoice.notes,
      nonVatNotice: totals.vatApplied ? null : NOT_VAT_REGISTERED_NOTICE,
      templateVersion: "v1",
    });

    const { error } = await supabase.from("invoices").update({
      status: "Sent",
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      subtotal: totals.subtotal, vat_applied: totals.vatApplied, vat_rate: totals.vatRate,
      vat_amount: totals.vatAmount, total: totals.total, amount: totals.total,
      approved_at: new Date().toISOString(),
      approved_by_name: permissions.name ?? null,
      approved_by_email: permissions.email ?? null,
      sent_at: new Date().toISOString(),
      snapshot,
    }).eq("id", id);
    if (error) {
      console.error("Failed to issue invoice:", error);
      return { error: "Couldn't issue this invoice. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "invoice_issued", targetType: "invoice", targetId: id, targetLabel: invoiceNumber,
      metadata: { vatApplied: totals.vatApplied, total: totals.total },
    });

    revalidatePath(`/finance/invoices/${id}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't issue this invoice." };
  }
}

/**
 * Cancels an invoice. Blocked once anything has actually been paid
 * against it (see finance-core.ts's derivePaymentStatus / Phase 7) —
 * cancelling a paid invoice is a business decision that needs a credit
 * note / refund process, not a silent status flip, so this deliberately
 * refuses rather than guessing.
 */
export async function cancelInvoice(id: string): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const { data: existing } = await supabase.from("invoices").select("id, status, invoice_number, paid_amount").eq("id", id).maybeSingle();
    if (!existing) return { error: "That invoice could not be found." };
    if (existing.status === "Cancelled") return { error: "This invoice is already cancelled." };
    if (Number(existing.paid_amount ?? 0) > 0) {
      return { error: "This invoice has payments recorded against it and can't simply be cancelled. Contact Finance about issuing a credit note instead." };
    }

    const { error } = await supabase.from("invoices").update({ status: "Cancelled" }).eq("id", id);
    if (error) {
      console.error("Failed to cancel invoice:", error);
      return { error: "Couldn't cancel this invoice. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "invoice_cancelled", targetType: "invoice", targetId: id, targetLabel: existing.invoice_number ?? undefined,
    });

    revalidatePath(`/finance/invoices/${id}`);
    revalidatePath("/finance/invoices");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't cancel this invoice." };
  }
}
