"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { formatCustomerCode } from "@/lib/finance-core";

/**
 * Every server action here returns { error?: string } instead of
 * throwing — Next.js Server Actions redact thrown error messages to a
 * generic digest in production, so a thrown error becomes useless for
 * the person using the app. See docs/FINANCE_MODULE.md.
 */

export async function addCustomer(formData: FormData): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("customers", "Create");
    const supabase = createServiceClient();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Customer name is required." };

    const industry = String(formData.get("industry") ?? "").trim() || null;
    const contact = String(formData.get("contact") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const status = String(formData.get("status") ?? "Active").trim() || "Active";
    const accountValueRaw = String(formData.get("accountValue") ?? "0").replace(/[^0-9.-]/g, "");
    const accountValue = accountValueRaw ? Number(accountValueRaw) : 0;
    if (!Number.isFinite(accountValue) || accountValue < 0) {
      return { error: "Account value must be a non-negative number." };
    }

    // Atomically reserve a stable customer code (e.g. CUST-0007) — same
    // race-safe mechanism used for quotation/invoice numbering, so two
    // customers created at the same moment never collide.
    const { data: seqResult, error: seqError } = await supabase.rpc("next_finance_number", { p_seq_key: "customer" });
    if (seqError) {
      console.error("Failed to reserve a customer code:", seqError);
      return { error: "Couldn't assign a customer code. Please try again." };
    }
    const customerCode = formatCustomerCode(seqResult as number);

    const { data: inserted, error } = await supabase
      .from("customers")
      .insert({
        customer_code: customerCode,
        name, industry, contact, email, phone,
        billing_address: billingAddress, notes, status,
        account_value: accountValue,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("Failed to create customer:", error);
      return { error: "Couldn't create this customer. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown",
      actorName: permissions.name,
      action: "customer_created",
      targetType: "customer",
      targetId: inserted.id,
      targetLabel: `${customerCode} — ${name}`,
    });

    revalidatePath("/customers");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't create this customer." };
  }
}

export async function updateCustomer(formData: FormData): Promise<{ error?: string }> {
  try {
    const permissions = await requirePermissionAction("customers", "Edit");
    const supabase = createServiceClient();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Missing customer id." };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Customer name is required." };

    const industry = String(formData.get("industry") ?? "").trim() || null;
    const contact = String(formData.get("contact") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const status = String(formData.get("status") ?? "Active").trim() || "Active";
    const accountValueRaw = String(formData.get("accountValue") ?? "0").replace(/[^0-9.-]/g, "");
    const accountValue = accountValueRaw ? Number(accountValueRaw) : 0;
    if (!Number.isFinite(accountValue) || accountValue < 0) {
      return { error: "Account value must be a non-negative number." };
    }

    const { error } = await supabase
      .from("customers")
      .update({
        name, industry, contact, email, phone,
        billing_address: billingAddress, notes, status,
        account_value: accountValue,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to update customer:", error);
      return { error: "Couldn't update this customer. Please try again." };
    }

    await logAudit({
      actorEmail: permissions.email ?? "unknown",
      actorName: permissions.name,
      action: "customer_updated",
      targetType: "customer",
      targetId: id,
      targetLabel: name,
    });

    revalidatePath("/customers");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't update this customer." };
  }
}
