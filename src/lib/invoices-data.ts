import { createServiceClient } from "@/lib/supabase/service";
import type { UserPermissions } from "@/lib/permissions-core";
import { canAccessCustomerForQuotation } from "@/lib/finance-core";

/**
 * Data layer for Invoices — deliberately kept in its own file rather
 * than added to src/lib/data.ts, which already exports a getInvoices()
 * for the legacy Finance dashboard widget (mock/simple {id, customer,
 * amount, status, due} shape). This file is the real, full Finance
 * Module invoices feature and mirrors quotations-data.ts exactly:
 * server-side role scoping, never a UI-only filter — see
 * docs/FINANCE_MODULE.md.
 */

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string | null;
  customerName: string;
  status: string;
  total: number;
  paidAmount: number;
  vatApplied: boolean;
  createdByName: string | null;
  createdAt: string;
  issueDate: string | null;
  dueDate: string | null;
};

/**
 * Lists invoices, server-side scoped by role: Super Admin, Finance and
 * Management see everything; everyone else sees only invoices they
 * created themselves. Same access shape as getQuotations().
 */
export async function getInvoicesList(permissions: UserPermissions): Promise<InvoiceListRow[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from("invoices")
      .select("id, invoice_number, status, total, paid_amount, vat_applied, created_by_name, created_at, issue_date, due_date, customer_id, customers(name)")
      .not("customer_id", "is", null) // excludes legacy free-text-only mock rows from the old placeholder schema
      .order("created_at", { ascending: false });

    const broadAccess = permissions.isAdmin || permissions.role === "Finance" || permissions.role === "Management";
    if (!broadAccess) {
      query = query.eq("created_by_email", (permissions.email ?? "").toLowerCase());
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((i) => {
      const customer = i.customers as unknown as { name: string } | { name: string }[] | null;
      const customerName = Array.isArray(customer) ? customer[0]?.name : customer?.name;
      return {
        id: i.id,
        invoiceNumber: i.invoice_number,
        customerName: customerName ?? "—",
        status: i.status,
        total: Number(i.total ?? 0),
        paidAmount: Number(i.paid_amount ?? 0),
        vatApplied: i.vat_applied === true,
        createdByName: i.created_by_name,
        createdAt: i.created_at,
        issueDate: i.issue_date,
        dueDate: i.due_date,
      };
    });
  } catch {
    return [];
  }
}

export type InvoiceLineItemRow = {
  id: string;
  productService: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  lineTotal: number;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  revisionNumber: number;
  parentInvoiceId: string | null;
  quotationId: string | null;
  customerId: string;
  customerName: string;
  subtotal: number;
  vatApplied: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  notes: string | null;
  terms: string | null;
  dueDate: string | null;
  issueDate: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  snapshot: Record<string, unknown> | null;
  lineItems: InvoiceLineItemRow[];
};

/**
 * Fetches one invoice with its line items, enforcing the same
 * server-side access rule as getInvoicesList(). Returns null both when
 * the record doesn't exist AND when access is denied — a disallowed id
 * can't be distinguished from a nonexistent one by probing.
 */
export async function getInvoiceDetail(id: string, permissions: UserPermissions): Promise<InvoiceDetail | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("invoices")
      .select("*, customers(name), invoice_line_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || !data.customer_id) return null;

    const broadAccess = permissions.isAdmin || permissions.role === "Finance" || permissions.role === "Management";
    if (!broadAccess && data.created_by_email !== (permissions.email ?? "").toLowerCase() && data.created_by_email !== permissions.email) {
      return null;
    }

    const customer = data.customers as unknown as { name: string } | { name: string }[] | null;
    const customerName = Array.isArray(customer) ? customer[0]?.name : customer?.name;

    const lineItems = ((data.invoice_line_items ?? []) as Array<{ id: string; line_order: number; product_service: string; description: string | null; quantity: string; unit: string | null; unit_price: string; line_total: string }>)
      .sort((a, b) => a.line_order - b.line_order)
      .map((li) => ({
        id: li.id, productService: li.product_service, description: li.description,
        quantity: Number(li.quantity), unit: li.unit, unitPrice: Number(li.unit_price), lineTotal: Number(li.line_total),
      }));

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      status: data.status,
      revisionNumber: data.revision_number ?? 1,
      parentInvoiceId: data.parent_invoice_id,
      quotationId: data.quotation_id,
      customerId: data.customer_id,
      customerName: customerName ?? "—",
      subtotal: Number(data.subtotal ?? 0),
      vatApplied: data.vat_applied === true,
      vatRate: Number(data.vat_rate ?? 0),
      vatAmount: Number(data.vat_amount ?? 0),
      total: Number(data.total ?? 0),
      paidAmount: Number(data.paid_amount ?? 0),
      notes: data.notes, terms: data.terms, dueDate: data.due_date, issueDate: data.issue_date,
      createdByName: data.created_by_name, createdByEmail: data.created_by_email,
      approvedByName: data.approved_by_name, approvedAt: data.approved_at, sentAt: data.sent_at,
      snapshot: data.snapshot,
      lineItems,
    };
  } catch {
    return null;
  }
}

export type CustomerPickerOption = {
  id: string;
  customerCode: string | null;
  name: string;
  accountOwnerEmail: string | null;
};

/**
 * Customer options for the Invoice form's picker, filtered server-side
 * to the ones this user is authorised to bill — reuses the same
 * ownership rule as quotations (canAccessCustomerForQuotation covers
 * both document kinds; see finance-core.ts).
 */
export async function getAuthorizedCustomerOptionsForInvoices(permissions: UserPermissions): Promise<CustomerPickerOption[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("customers").select("id, customer_code, name, account_owner_email").order("name");
    if (error || !data) return [];
    return data
      .filter((c) => canAccessCustomerForQuotation({
        requesterIsAdmin: permissions.isAdmin,
        requesterRole: permissions.role ?? null,
        requesterEmail: permissions.email ?? null,
        customerAccountOwnerEmail: c.account_owner_email ?? null,
      }))
      .map((c) => ({ id: c.id, customerCode: c.customer_code ?? null, name: c.name, accountOwnerEmail: c.account_owner_email ?? null }));
  } catch {
    return [];
  }
}
