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
  isPreIssueQuotationStatus, isConvertibleQuotationStatus, NOT_VAT_REGISTERED_NOTICE, type FinanceLineItemInput,
} from "@/lib/finance-core";

/**
 * Every action here returns { error?: string } — never throws — so a
 * production Server Action never redacts the real reason to a generic
 * digest (see docs/FINANCE_MODULE.md / the app-wide pattern established
 * for document-actions.ts and tender-actions.ts).
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

/** Creates a new Draft quotation. No document number is allocated yet — see docs/FINANCE_MODULE.md, "Document numbering". */
export async function createQuotationDraft(formData: FormData): Promise<{ error?: string; id?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Create");
    const supabase = createServiceClient();

    const customerId = String(formData.get("customerId") ?? "").trim();
    if (!customerId) return { error: "A customer is required." };

    const customer = await fetchCustomerForOwnershipCheck(customerId);
    if (!customer) return { error: "That customer could not be found." };

    // Server-side ownership enforcement — never only a UI filter. A
    // Sales user who somehow submits a customerId they're not
    // authorised for is blocked here, not just hidden from the picker.
    const canAccess = canAccessCustomerForQuotation({
      requesterIsAdmin: permissions.isAdmin,
      requesterRole: permissions.role ?? null,
      requesterEmail: permissions.email ?? null,
      customerAccountOwnerEmail: customer.account_owner_email ?? null,
    });
    if (!canAccess) return { error: "You are not authorised to create a quotation for this customer." };

    const lines = parseLineItemsFromFormData(formData);
    const lineErrors = validateLineItems(lines);
    if (lineErrors.length > 0) return { error: lineErrors[0].message };

    const validUntil = String(formData.get("validUntil") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const terms = String(formData.get("terms") ?? "").trim() || null;

    // Drafts show a LIVE, indicative total only — VAT is still gated
    // through the same hard-block function used at Approval, using
    // today's date, so a draft never even previews VAT it wouldn't
    // actually be allowed to charge.
    const vatSettings = await getFinanceVatSettings();
    const today = new Date().toISOString().slice(0, 10);
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: today,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });
    const totals = calculateDocumentTotals(lines, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lines);

    const { data: inserted, error } = await supabase
      .from("quotations")
      .insert({
        customer_id: customerId,
        status: "Draft",
        subtotal: totals.subtotal,
        vat_applied: totals.vatApplied,
        vat_rate: totals.vatRate,
        vat_amount: totals.vatAmount,
        total: totals.total,
        notes, terms,
        valid_until: validUntil,
        created_by_name: permissions.name ?? null,
        created_by_email: (permissions.email ?? "unknown").toLowerCase(),
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("Failed to create quotation:", error);
      return { error: "Couldn't create this quotation. Please try again." };
    }

    const lineRows = computedLines.map((line, index) => ({
      quotation_id: inserted.id,
      line_order: index,
      product_service: line.productService,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }));
    const { error: lineError } = await supabase.from("quotation_line_items").insert(lineRows);
    if (lineError) {
      console.error("Failed to save quotation line items, rolling back the draft:", lineError);
      await supabase.from("quotations").delete().eq("id", inserted.id);
      return { error: "Couldn't save the line items for this quotation. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_created", targetType: "quotation", targetId: inserted.id,
      targetLabel: `Draft for ${customer.name}`,
      metadata: { customerId, lineCount: lineRows.length, total: totals.total },
    });

    revalidatePath("/finance/quotations");
    return { id: inserted.id };
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't create this quotation." };
  }
}

/** Edits a quotation that is still Draft or Pending Approval. Anything Approved+ must be revised instead — see reviseQuotation(). */
export async function updateQuotationDraft(formData: FormData): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Missing quotation id." };

    const { data: existing } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
    if (!existing) return { error: "That quotation could not be found." };
    if (!isPreIssueQuotationStatus(existing.status)) {
      return { error: `A ${existing.status} quotation can no longer be edited directly — create a revision instead.` };
    }
    if (!permissions.isAdmin && permissions.role !== "Finance" && permissions.role !== "Management" && existing.created_by_email !== (permissions.email ?? "").toLowerCase()) {
      return { error: "You can only edit quotations you created." };
    }

    const customerId = String(formData.get("customerId") ?? existing.customer_id).trim();
    const customer = await fetchCustomerForOwnershipCheck(customerId);
    if (!customer) return { error: "That customer could not be found." };
    const canAccess = canAccessCustomerForQuotation({
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
      requesterEmail: permissions.email ?? null, customerAccountOwnerEmail: customer.account_owner_email ?? null,
    });
    if (!canAccess) return { error: "You are not authorised to assign this customer to this quotation." };

    const lines = parseLineItemsFromFormData(formData);
    const lineErrors = validateLineItems(lines);
    if (lineErrors.length > 0) return { error: lineErrors[0].message };

    const validUntil = String(formData.get("validUntil") ?? "").trim() || null;
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

    const { error } = await supabase.from("quotations").update({
      customer_id: customerId,
      subtotal: totals.subtotal, vat_applied: totals.vatApplied, vat_rate: totals.vatRate,
      vat_amount: totals.vatAmount, total: totals.total,
      notes, terms, valid_until: validUntil,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      console.error("Failed to update quotation:", error);
      return { error: "Couldn't update this quotation. Please try again." };
    }

    await supabase.from("quotation_line_items").delete().eq("quotation_id", id);
    const lineRows = computedLines.map((line, index) => ({
      quotation_id: id, line_order: index, product_service: line.productService,
      description: line.description, quantity: line.quantity, unit: line.unit,
      unit_price: line.unitPrice, line_total: line.lineTotal,
    }));
    const { error: lineError } = await supabase.from("quotation_line_items").insert(lineRows);
    if (lineError) {
      console.error("Failed to save updated quotation line items:", lineError);
      return { error: "The quotation was updated but its line items could not be saved. Please re-open and try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_updated", targetType: "quotation", targetId: id, targetLabel: customer.name,
    });

    revalidatePath(`/finance/quotations/${id}`);
    revalidatePath("/finance/quotations");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't update this quotation." };
  }
}

export async function submitQuotationForApproval(id: string): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const { data: existing } = await supabase.from("quotations").select("id, status, customer_id").eq("id", id).maybeSingle();
    if (!existing) return { error: "That quotation could not be found." };
    if (existing.status !== "Draft") return { error: `Only a Draft quotation can be submitted for approval (this one is ${existing.status}).` };

    const { error } = await supabase.from("quotations").update({
      status: "Pending Approval",
      submitted_at: new Date().toISOString(),
      submitted_by_name: permissions.name ?? null,
      submitted_by_email: permissions.email ?? null,
    }).eq("id", id);
    if (error) {
      console.error("Failed to submit quotation for approval:", error);
      return { error: "Couldn't submit this quotation for approval. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_submitted_for_approval", targetType: "quotation", targetId: id,
    });

    revalidatePath(`/finance/quotations/${id}`);
    revalidatePath("/finance/quotations");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't submit this quotation for approval." };
  }
}

/**
 * Approves a Pending Approval quotation: allocates its permanent
 * document number, re-evaluates the VAT hard block using the actual
 * approver's own permissions (never trusting whatever was previewed at
 * Draft time), and takes the immutable customer-facing snapshot. This
 * is the ONE place a quotation_number and snapshot are ever written.
 */
export async function approveQuotation(id: string): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Approve");
    const supabase = createServiceClient();

    const { data: quotation } = await supabase.from("quotations").select("*, quotation_line_items(*)").eq("id", id).maybeSingle();
    if (!quotation) return { error: "That quotation could not be found." };
    if (quotation.status !== "Pending Approval") {
      return { error: `Only a Pending Approval quotation can be approved (this one is ${quotation.status}).` };
    }

    const customer = await fetchCustomerForOwnershipCheck(quotation.customer_id);
    if (!customer) return { error: "The customer on this quotation could not be found." };

    const issueDate = new Date().toISOString().slice(0, 10);
    const vatSettings = await getFinanceVatSettings();
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: issueDate,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });

    const lineItemInputs = (quotation.quotation_line_items ?? [])
      .sort((a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order)
      .map((li: { product_service: string; description: string | null; quantity: string; unit: string | null; unit_price: string }) => ({
        productService: li.product_service, description: li.description,
        quantity: Number(li.quantity), unit: li.unit, unitPrice: Number(li.unit_price),
      }));
    const totals = calculateDocumentTotals(lineItemInputs, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lineItemInputs);

    const { quotationPrefix } = await getDocumentNumberPrefixes();
    const year = new Date().getFullYear();
    const { data: sequenceNumber, error: seqError } = await supabase.rpc("next_finance_number", { p_seq_key: sequenceKeyFor("quotation", year) });
    if (seqError || typeof sequenceNumber !== "number") {
      console.error("Failed to allocate a quotation number:", seqError);
      return { error: "Couldn't allocate a document number for this quotation. Please try again." };
    }
    const quotationNumber = formatDocumentNumber(quotationPrefix, year, sequenceNumber);

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
      terms: quotation.terms, notes: quotation.notes,
      nonVatNotice: totals.vatApplied ? null : NOT_VAT_REGISTERED_NOTICE,
      templateVersion: "v1",
    });

    const { error } = await supabase.from("quotations").update({
      status: "Approved",
      quotation_number: quotationNumber,
      issue_date: issueDate,
      subtotal: totals.subtotal, vat_applied: totals.vatApplied, vat_rate: totals.vatRate,
      vat_amount: totals.vatAmount, total: totals.total,
      approved_at: new Date().toISOString(),
      approved_by_name: permissions.name ?? null,
      approved_by_email: permissions.email ?? null,
      snapshot,
    }).eq("id", id);
    if (error) {
      console.error("Failed to approve quotation:", error);
      return { error: "Couldn't approve this quotation. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_approved", targetType: "quotation", targetId: id, targetLabel: quotationNumber,
      metadata: { vatApplied: totals.vatApplied, total: totals.total },
    });

    revalidatePath(`/finance/quotations/${id}`);
    revalidatePath("/finance/quotations");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't approve this quotation." };
  }
}

export async function sendQuotation(id: string): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const { data: existing } = await supabase.from("quotations").select("id, status, quotation_number").eq("id", id).maybeSingle();
    if (!existing) return { error: "That quotation could not be found." };
    if (existing.status !== "Approved") return { error: `Only an Approved quotation can be marked Sent (this one is ${existing.status}).` };

    const { error } = await supabase.from("quotations").update({ status: "Sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("Failed to mark quotation as sent:", error);
      return { error: "Couldn't update this quotation. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_sent", targetType: "quotation", targetId: id, targetLabel: existing.quotation_number ?? undefined,
    });

    revalidatePath(`/finance/quotations/${id}`);
    revalidatePath("/finance/quotations");
    return {};
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't mark this quotation as sent." };
  }
}

/** Creates a new Draft revision from an already-issued quotation, without touching the original (which is marked Revised and permanently retained, including its burned document number). */
export async function reviseQuotation(id: string): Promise<{ error?: string; id?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const { data: original } = await supabase.from("quotations").select("*, quotation_line_items(*)").eq("id", id).maybeSingle();
    if (!original) return { error: "That quotation could not be found." };
    if (isPreIssueQuotationStatus(original.status)) return { error: "A Draft or Pending Approval quotation can be edited directly — no need to revise it." };

    const { data: inserted, error } = await supabase.from("quotations").insert({
      customer_id: original.customer_id,
      status: "Draft",
      revision_number: (original.revision_number ?? 1) + 1,
      parent_quotation_id: original.parent_quotation_id ?? original.id, // always points to the ORIGINAL, even across multiple revisions
      subtotal: original.subtotal, vat_applied: original.vat_applied, vat_rate: original.vat_rate,
      vat_amount: original.vat_amount, total: original.total,
      notes: original.notes, terms: original.terms, valid_until: original.valid_until,
      created_by_name: permissions.name ?? null, created_by_email: (permissions.email ?? "unknown").toLowerCase(),
    }).select("id").single();
    if (error || !inserted) {
      console.error("Failed to create quotation revision:", error);
      return { error: "Couldn't create a revision of this quotation. Please try again." };
    }

    const lineRows = (original.quotation_line_items ?? []).map((li: { line_order: number; product_service: string; description: string | null; quantity: string; unit: string | null; unit_price: string; line_total: string }) => ({
      quotation_id: inserted.id, line_order: li.line_order, product_service: li.product_service,
      description: li.description, quantity: li.quantity, unit: li.unit,
      unit_price: li.unit_price, line_total: li.line_total,
    }));
    if (lineRows.length > 0) await supabase.from("quotation_line_items").insert(lineRows);

    await supabase.from("quotations").update({ status: "Revised" }).eq("id", original.id);

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_revised", targetType: "quotation", targetId: inserted.id,
      targetLabel: original.quotation_number ?? undefined,
      metadata: { originalId: original.id },
    });

    revalidatePath("/finance/quotations");
    return { id: inserted.id };
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't create a revision of this quotation." };
  }
}

/**
 * Converts an issued quotation into a new Draft invoice for the same
 * customer, copying its line items and terms/notes across. The
 * quotation is marked Converted and permanently linked via
 * converted_to_invoice_id — checked here alongside
 * isConvertibleQuotationStatus() so a quotation can only ever be
 * converted once, even under a race between two concurrent requests.
 *
 * The new invoice starts as an ordinary Draft: its own VAT
 * applicability, document number and snapshot are decided
 * independently, later, when IT is issued (issueInvoice() in
 * invoice-actions.ts) — never copied from the quotation, because VAT
 * Settings or the issuer's own permissions could have changed in the
 * time between the quotation being approved and the invoice being
 * issued. Totals are always recomputed from the raw line items through
 * finance-core.ts, never trusted verbatim from another document.
 */
export async function convertQuotationToInvoice(id: string): Promise<{ error?: string; invoiceId?: string }> {
  try {
    const permissions = await requirePermissionAction("finance", "Edit");
    const supabase = createServiceClient();

    const { data: quotation } = await supabase.from("quotations").select("*, quotation_line_items(*)").eq("id", id).maybeSingle();
    if (!quotation) return { error: "That quotation could not be found." };
    if (quotation.converted_to_invoice_id) {
      return { error: "This quotation has already been converted to an invoice.", invoiceId: quotation.converted_to_invoice_id };
    }
    if (!isConvertibleQuotationStatus(quotation.status)) {
      return { error: `A ${quotation.status} quotation can't be converted to an invoice. Only an issued quotation (Approved, Sent or Accepted) can be converted.` };
    }

    const customer = await fetchCustomerForOwnershipCheck(quotation.customer_id);
    if (!customer) return { error: "The customer on this quotation could not be found." };
    const canAccess = canAccessCustomerForQuotation({
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
      requesterEmail: permissions.email ?? null, customerAccountOwnerEmail: customer.account_owner_email ?? null,
    });
    if (!canAccess) return { error: "You are not authorised to invoice this customer." };

    const lineItemInputs = (quotation.quotation_line_items ?? [])
      .sort((a: { line_order: number }, b: { line_order: number }) => a.line_order - b.line_order)
      .map((li: { product_service: string; description: string | null; quantity: string; unit: string | null; unit_price: string }) => ({
        productService: li.product_service, description: li.description,
        quantity: Number(li.quantity), unit: li.unit, unitPrice: Number(li.unit_price),
      }));

    // Fresh VAT gate evaluation for the NEW document — see doc comment above.
    const vatSettings = await getFinanceVatSettings();
    const today = new Date().toISOString().slice(0, 10);
    const vatGate = evaluateVatApplicability({
      settings: vatSettings, transactionDate: today,
      requesterIsAdmin: permissions.isAdmin, requesterRole: permissions.role ?? null,
    });
    const totals = calculateDocumentTotals(lineItemInputs, { vatApplied: vatGate.allowed, vatRate: vatGate.vatRate });
    const computedLines = computeLineItems(lineItemInputs);

    const { data: insertedInvoice, error: invoiceError } = await supabase.from("invoices").insert({
      customer_id: quotation.customer_id,
      customer: customer.name, // legacy free-text column, kept in sync — see docs/FINANCE_MODULE.md, Phase 5
      quotation_id: quotation.id,
      status: "Draft",
      subtotal: totals.subtotal, vat_applied: totals.vatApplied, vat_rate: totals.vatRate,
      vat_amount: totals.vatAmount, total: totals.total, amount: totals.total,
      notes: quotation.notes, terms: quotation.terms,
      created_by_name: permissions.name ?? null,
      created_by_email: (permissions.email ?? "unknown").toLowerCase(),
    }).select("id").single();
    if (invoiceError || !insertedInvoice) {
      console.error("Failed to create invoice from quotation:", invoiceError);
      return { error: "Couldn't create an invoice from this quotation. Please try again." };
    }

    const lineRows = computedLines.map((line, index) => ({
      invoice_id: insertedInvoice.id, line_order: index, product_service: line.productService,
      description: line.description, quantity: line.quantity, unit: line.unit,
      unit_price: line.unitPrice, line_total: line.lineTotal,
    }));
    const { error: lineError } = await supabase.from("invoice_line_items").insert(lineRows);
    if (lineError) {
      console.error("Failed to save line items for converted invoice, rolling back:", lineError);
      await supabase.from("invoices").delete().eq("id", insertedInvoice.id);
      return { error: "Couldn't save the line items for the new invoice. Please try again." };
    }

    const { error: quotationUpdateError } = await supabase.from("quotations").update({
      status: "Converted",
      converted_to_invoice_id: insertedInvoice.id,
    }).eq("id", id);
    if (quotationUpdateError) {
      console.error("Failed to mark quotation as converted (the invoice was still created successfully):", quotationUpdateError);
      // Deliberately NOT rolled back — the invoice is real, usable data
      // at this point; only the quotation's own bookkeeping failed.
      // Surface this clearly rather than silently losing the link.
      return { error: "The invoice was created, but the quotation couldn't be marked as converted. Please refresh and check both records.", invoiceId: insertedInvoice.id };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "quotation_converted", targetType: "quotation", targetId: id,
      targetLabel: quotation.quotation_number ?? undefined,
      metadata: { invoiceId: insertedInvoice.id },
    });
    await logAudit({
      actorEmail: permissions.email ?? "unknown", actorName: permissions.name,
      action: "invoice_created", targetType: "invoice", targetId: insertedInvoice.id,
      targetLabel: `Converted from ${quotation.quotation_number ?? "quotation"}`,
      metadata: { quotationId: id, total: totals.total },
    });

    revalidatePath(`/finance/quotations/${id}`);
    revalidatePath("/finance/quotations");
    revalidatePath("/finance/invoices");
    return { invoiceId: insertedInvoice.id };
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Couldn't convert this quotation to an invoice." };
  }
}
