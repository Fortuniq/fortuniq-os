"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { addCustomer, updateCustomer } from "./customer-actions";

export type CustomerFormValue = {
  id?: string | number;
  name: string;
  industry?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  notes?: string | null;
  status?: string | null;
  accountValue?: number | null;
  accountOwnerEmail?: string | null;
};

const STATUSES = ["Active", "Prospect", "Inactive"];

export function CustomerModal({ customer, onClose }: { customer?: CustomerFormValue; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(customer?.id);

  function handleSubmit(formData: FormData) {
    setError(null);
    if (isEdit && customer?.id) formData.set("id", String(customer.id));
    startTransition(async () => {
      const result = isEdit ? await updateCustomer(formData) : await addCustomer(formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">{isEdit ? "Edit Customer" : "Add Customer"}</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <form action={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Customer / Account Name</label>
            <input name="name" required defaultValue={customer?.name ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Industry</label>
              <input name="industry" defaultValue={customer?.industry ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Status</label>
              <select name="status" defaultValue={customer?.status ?? "Active"} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Primary Contact</label>
              <input name="contact" defaultValue={customer?.contact ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Account Value (R)</label>
              <input name="accountValue" type="number" step="0.01" min="0" defaultValue={customer?.accountValue ?? 0} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Email</label>
              <input name="email" type="email" defaultValue={customer?.email ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Phone</label>
              <input name="phone" defaultValue={customer?.phone ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Billing Address</label>
            <textarea name="billingAddress" rows={2} defaultValue={customer?.billingAddress ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Account Owner (Sales rep email, optional)</label>
            <input name="accountOwnerEmail" type="email" placeholder="Leave blank to keep this account open to any Sales user" defaultValue={customer?.accountOwnerEmail ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            <p className="text-[11px] text-light-grey mt-1">Only the assigned Sales rep (plus Finance/Management/Super Admin) can draft quotations for this customer once set.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={customer?.notes ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>

          <p className="text-[11px] text-light-grey">
            This customer record is shared by Quotations, Invoices and Sales — it is not duplicated per module.
          </p>

          <button type="submit" disabled={isPending} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
          </button>
        </form>
      </div>
    </div>
  );
}
