import { createServiceClient } from "@/lib/supabase/service";
import type { VatSettingsSnapshot } from "@/lib/finance-core";

const KEYS = {
  vatRegistered: "finance_vat_registered",
  vatRate: "finance_vat_rate",
  vatRegistrationNumber: "finance_vat_registration_number",
  vatEffectiveDate: "finance_vat_effective_date",
  nonVatNotice: "finance_non_vat_notice",
  quotationPrefix: "finance_quotation_number_prefix",
  invoicePrefix: "finance_invoice_number_prefix",
} as const;

/**
 * Reads FortunIQ Fuels' own Finance Settings — the ONLY source
 * evaluateVatApplicability() (the VAT hard block, finance-core.ts) is
 * allowed to be checked against. Never reads anything from a customer
 * row; a customer's own VAT registration/number is a completely
 * separate, display-only concern (see docs/FINANCE_MODULE.md).
 *
 * Defaults to the safe "not VAT registered" state if settings haven't
 * been seeded yet or the database isn't reachable — never fails open.
 */
export async function getFinanceVatSettings(): Promise<VatSettingsSnapshot> {
  const fallback: VatSettingsSnapshot = {
    companyVatRegistered: false,
    vatRegistrationNumber: null,
    vatEffectiveDate: null,
    vatRate: 15,
  };
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [KEYS.vatRegistered, KEYS.vatRate, KEYS.vatRegistrationNumber, KEYS.vatEffectiveDate]);
    if (error || !data) return fallback;
    const byKey = Object.fromEntries(data.map((row) => [row.key, row.value]));
    return {
      companyVatRegistered: byKey[KEYS.vatRegistered] === true,
      vatRegistrationNumber: typeof byKey[KEYS.vatRegistrationNumber] === "string" && byKey[KEYS.vatRegistrationNumber] ? byKey[KEYS.vatRegistrationNumber] : null,
      vatEffectiveDate: typeof byKey[KEYS.vatEffectiveDate] === "string" && byKey[KEYS.vatEffectiveDate] ? byKey[KEYS.vatEffectiveDate] : null,
      vatRate: typeof byKey[KEYS.vatRate] === "number" ? byKey[KEYS.vatRate] : 15,
    };
  } catch {
    return fallback; // never fail open — an unreachable settings store must never accidentally allow VAT
  }
}

export async function getNonVatNotice(): Promise<string> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", KEYS.nonVatNotice).maybeSingle();
    if (typeof data?.value === "string" && data.value) return data.value;
  } catch {
    // fall through to default
  }
  const { NOT_VAT_REGISTERED_NOTICE } = await import("@/lib/finance-core");
  return NOT_VAT_REGISTERED_NOTICE;
}

export async function getDocumentNumberPrefixes(): Promise<{ quotationPrefix: string; invoicePrefix: string }> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("app_settings").select("key, value").in("key", [KEYS.quotationPrefix, KEYS.invoicePrefix]);
    const byKey = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return {
      quotationPrefix: typeof byKey[KEYS.quotationPrefix] === "string" ? byKey[KEYS.quotationPrefix] : "FQ",
      invoicePrefix: typeof byKey[KEYS.invoicePrefix] === "string" ? byKey[KEYS.invoicePrefix] : "INV",
    };
  } catch {
    return { quotationPrefix: "FQ", invoicePrefix: "INV" };
  }
}

/** Super Admin/Finance-only update of Finance Settings. Permission check happens in the caller (server action), not here. */
export async function updateFinanceVatSettings(update: {
  vatRegistered?: boolean;
  vatRate?: number;
  vatRegistrationNumber?: string | null;
  vatEffectiveDate?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const rows: { key: string; value: unknown; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (update.vatRegistered !== undefined) rows.push({ key: KEYS.vatRegistered, value: update.vatRegistered, updated_at: now });
  if (update.vatRate !== undefined) rows.push({ key: KEYS.vatRate, value: update.vatRate, updated_at: now });
  if (update.vatRegistrationNumber !== undefined) rows.push({ key: KEYS.vatRegistrationNumber, value: update.vatRegistrationNumber, updated_at: now });
  if (update.vatEffectiveDate !== undefined) rows.push({ key: KEYS.vatEffectiveDate, value: update.vatEffectiveDate, updated_at: now });
  if (rows.length === 0) return;
  await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
}
