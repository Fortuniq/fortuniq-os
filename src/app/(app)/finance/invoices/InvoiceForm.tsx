"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createInvoiceDraft, updateInvoiceDraft } from "./invoice-actions";
import { formatZARFull } from "@/lib/format";
import type { CustomerPickerOption } from "@/lib/invoices-data";

type LineItemDraft = { productService: string; description: string; quantity: string; unit: string; unitPrice: string };

const EMPTY_LINE: LineItemDraft = { productService: "", description: "", quantity: "", unit: "litres", unitPrice: "" };

/**
 * Client-side arithmetic here is a PREVIEW ONLY — the authoritative
 * calculation (and the VAT hard-block decision) runs server-side in
 * finance-core.ts / invoice-actions.ts when the form is submitted. See
 * docs/FINANCE_MODULE.md.
 */
function previewLineTotal(line: LineItemDraft): number {
  const qty = parseFloat(line.quantity);
  const rate = parseFloat(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(rate)) return 0;
  return Math.round(qty * rate * 100) / 100;
}

export function InvoiceForm({
  customers,
  mode,
  initial,
}: {
  customers: CustomerPickerOption[];
  mode: "create" | "edit";
  initial?: {
    id: string;
    customerId: string;
    dueDate: string | null;
    notes: string | null;
    terms: string | null;
    lineItems: { productService: string; description: string | null; quantity: number; unit: string | null; unitPrice: number }[];
  };
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [lines, setLines] = useState<LineItemDraft[]>(
    initial?.lineItems && initial.lineItems.length > 0
      ? initial.lineItems.map((li) => ({ productService: li.productService, description: li.description ?? "", quantity: String(li.quantity), unit: li.unit ?? "litres", unitPrice: String(li.unitPrice) }))
      : [{ ...EMPTY_LINE }]
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subtotal = lines.reduce((sum, line) => sum + previewLineTotal(line), 0);

  function updateLine(index: number, patch: Partial<LineItemDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) { setError("Please select a customer."); return; }

    const parsedLines = lines.map((l) => ({
      productService: l.productService.trim(),
      description: l.description.trim() || undefined,
      quantity: parseFloat(l.quantity),
      unit: l.unit.trim() || undefined,
      unitPrice: parseFloat(l.unitPrice),
    }));

    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("dueDate", dueDate);
    formData.set("notes", notes);
    formData.set("terms", terms);
    formData.set("lineItems", JSON.stringify(parsedLines));
    if (mode === "edit" && initial) formData.set("id", initial.id);

    startTransition(async () => {
      const result = mode === "edit" ? await updateInvoiceDraft(formData) : await createInvoiceDraft(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      const targetId = mode === "edit" ? initial!.id : (result as { id?: string }).id;
      router.push(targetId ? `/finance/invoices/${targetId}` : "/finance/invoices");
      router.refresh();
    });
  }

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-6 text-sm text-grey">
        You aren&apos;t authorised to create an invoice for any customer yet. If you&apos;re a Sales user, ask your manager to assign you an account in Customers, or contact Finance.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white rounded-xl border border-border p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={mode === "edit"} className="w-full text-sm px-3 py-2 rounded-lg border border-border disabled:bg-surface disabled:text-light-grey">
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customerCode ? `${c.customerCode} — ` : ""}{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Due Date (optional)</label>
          <input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-navy">Line Items</p>
          <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-orange">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>

        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[11px] font-medium text-light-grey px-1">
            <span>Product / Service</span><span>Quantity</span><span>Unit</span><span>Rate</span><span className="text-right">Line Total</span><span />
          </div>
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <input required placeholder="e.g. Diesel 50ppm" value={line.productService} onChange={(e) => updateLine(index, { productService: e.target.value })} className="text-sm px-2 py-1.5 rounded-lg border border-border" />
              <input required type="number" step="any" min="0" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="text-sm px-2 py-1.5 rounded-lg border border-border" />
              <input placeholder="litres" value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} className="text-sm px-2 py-1.5 rounded-lg border border-border" />
              <input required type="number" step="any" min="0" placeholder="Rate" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} className="text-sm px-2 py-1.5 rounded-lg border border-border" />
              <span className="text-sm text-right font-medium text-navy">{formatZARFull(previewLineTotal(line))}</span>
              <button type="button" onClick={() => removeLine(index)} className="text-grey hover:text-red-600 p-1 justify-self-end sm:justify-self-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4 pt-3 border-t border-border">
          <div className="text-right">
            <p className="text-xs text-light-grey">Grand Total (excl. VAT — FortunIQ Fuels is not VAT registered)</p>
            <p className="text-lg font-bold text-navy">{formatZARFull(subtotal)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Terms</label>
          <textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-grey block mb-1">Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
        </div>
      </div>

      <button type="submit" disabled={isPending} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
        {isPending ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Draft"}
      </button>
    </form>
  );
}
