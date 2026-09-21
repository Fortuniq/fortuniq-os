import { createServiceClient } from "@/lib/supabase/service";
import type { UserPermissions } from "@/lib/permissions-core";
import { canAccessCustomerForQuotation } from "@/lib/finance-core";

export type QuotationListRow = {
  id: string;
  quotationNumber: string | null;
  customerName: string;
  status: string;
  total: number;
  vatApplied: boolean;
  createdByName: string | null;
  createdAt: string;
  issueDate: string | null;
  validUntil: string | null;
};

/**
 * Lists quotations, server-side scoped by role: Super Admin, Finance and
 * Management see everything; everyone else (Sales) sees only quotations
 * they created themselves. This is a real query-level restriction, not
 * a UI filter — see docs/FINANCE_MODULE.md.
 */
export async function getQuotations(permissions: UserPermissions): Promise<QuotationListRow[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from("quotations")
      .select("id, quotation_number, status, total, vat_applied, created_by_name, created_at, issue_date, valid_until, customers(name)")
      .order("created_at", { ascending: false });

    const broadAccess = permissions.isAdmin || permissions.role === "Finance" || permissions.role === "Management";
    if (!broadAccess) {
      query = query.eq("created_by_email", (permissions.email ?? "").toLowerCase());
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((q) => {
      const customer = q.customers as unknown as { name: string } | { name: string }[] | null;
      const customerName = Array.isArray(customer) ? customer[0]?.name : customer?.name;
      return {
        id: q.id,
        quotationNumber: q.quotation_number,
        customerName: customerName ?? "—",
        status: q.status,
        total: Number(q.total ?? 0),
        vatApplied: q.vat_applied === true,
        createdByName: q.created_by_name,
        createdAt: q.created_at,
        issueDate: q.issue_date,
        validUntil: q.valid_until,
      };
    });
  } catch {
    return [];
  }
}

export type QuotationLineItemRow = {
  id: string;
  productService: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  lineTotal: number;
};

export type QuotationDetail = {
  id: string;
  quotationNumber: string | null;
  status: string;
  revisionNumber: number;
  parentQuotationId: string | null;
  customerId: string;
  customerName: string;
  subtotal: number;
  vatApplied: boolean;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  validUntil: string | null;
  issueDate: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  snapshot: Record<string, unknown> | null;
  lineItems: QuotationLineItemRow[];
};

/**
 * Fetches one quotation with its line items, enforcing the same
 * server-side access rule as getQuotations(): a non-privileged user
 * may only open a quotation they created. Returns null both when the
 * record doesn't exist AND when access is denied — deliberately the
 * same response either way, so a disallowed id can't be distinguished
 * from a nonexistent one by probing.
 */
export async function getQuotationDetail(id: string, permissions: UserPermissions): Promise<QuotationDetail | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("quotations")
      .select("*, customers(name), quotation_line_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;

    const broadAccess = permissions.isAdmin || permissions.role === "Finance" || permissions.role === "Management";
    if (!broadAccess && data.created_by_email !== (permissions.email ?? "").toLowerCase() && data.created_by_email !== permissions.email) {
      return null;
    }

    const customer = data.customers as unknown as { name: string } | { name: string }[] | null;
    const customerName = Array.isArray(customer) ? customer[0]?.name : customer?.name;

    const lineItems = ((data.quotation_line_items ?? []) as Array<{ id: string; line_order: number; product_service: string; description: string | null; quantity: string; unit: string | null; unit_price: string; line_total: string }>)
      .sort((a, b) => a.line_order - b.line_order)
      .map((li) => ({
        id: li.id, productService: li.product_service, description: li.description,
        quantity: Number(li.quantity), unit: li.unit, unitPrice: Number(li.unit_price), lineTotal: Number(li.line_total),
      }));

    return {
      id: data.id,
      quotationNumber: data.quotation_number,
      status: data.status,
      revisionNumber: data.revision_number ?? 1,
      parentQuotationId: data.parent_quotation_id,
      customerId: data.customer_id,
      customerName: customerName ?? "—",
      subtotal: Number(data.subtotal ?? 0),
      vatApplied: data.vat_applied === true,
      vatRate: Number(data.vat_rate ?? 0),
      vatAmount: Number(data.vat_amount ?? 0),
      total: Number(data.total ?? 0),
      notes: data.notes, terms: data.terms, validUntil: data.valid_until, issueDate: data.issue_date,
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
 * Customer options for the Quotation form's picker, already filtered
 * server-side to the ones this specific user is authorised to draft a
 * quotation for (see canAccessCustomerForQuotation in finance-core.ts).
 * The client never receives customers it isn't allowed to select — this
 * is a real data restriction, not just a disabled option in a dropdown.
 */
export async function getAuthorizedCustomerOptions(permissions: UserPermissions): Promise<CustomerPickerOption[]> {
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
