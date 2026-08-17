"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { addTender, updateTender } from "./tender-actions";
import { formatZARFull } from "@/lib/format";

type Tender = {
  id: string | number;
  ref: string;
  title: string;
  closing: string;
  status: string;
  stage: string;
  value: number;
  compliance: number;
};

export function TenderFormModal({ tender, onClose }: { tender?: Tender; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [folderWarning, setFolderWarning] = useState<string | null>(null);
  // Raw, unformatted while editing — matches how the value is actually
  // typed (458.65, 387958, 4200000). Only ever formatted for display,
  // never for what gets submitted or stored. See docs/TENDER_VALUE.md.
  const [valueInput, setValueInput] = useState<string>(tender?.value != null ? String(tender.value) : "");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (tender) {
          await updateTender(String(tender.id), formData);
          onClose();
        } else {
          const result = await addTender(formData);
          if (result?.folderWarning) {
            // The tender itself was created successfully — don't close
            // the modal silently. Show the warning and let the person
            // dismiss it themselves, so a SharePoint folder problem is
            // never invisible.
            setFolderWarning(result.folderWarning);
          } else {
            onClose();
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (folderWarning) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
        <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <p className="font-semibold text-navy">Tender Created</p>
            <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
          </div>
          <div className="p-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2.5">
              {folderWarning}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={onClose} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">{tender ? "Edit Tender" : "Add Tender"}</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <form action={handleSubmit} className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Reference No.</label>
              <input name="ref" defaultValue={tender?.ref} required placeholder="GDOH-2026-114" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Closing Date</label>
              <input name="closingDate" type="date" defaultValue={tender?.closing} required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Title</label>
            <input name="title" defaultValue={tender?.title} required placeholder="Bulk Diesel Supply — Gauteng Dept. of Health" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Status</label>
              <select name="status" defaultValue={tender?.status ?? "Open"} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                <option value="Open">Open</option>
                <option value="Awarded">Awarded</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Stage</label>
              <input name="stage" defaultValue={tender?.stage} placeholder="Drafting response" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Value (ZAR)</label>
              <input
                name="value"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                placeholder="4200000"
                className="w-full text-sm px-3 py-2 rounded-lg border border-border"
              />
              {valueInput !== "" && !isNaN(Number(valueInput)) && Number(valueInput) >= 0 && (
                <p className="text-xs text-light-grey mt-1">{formatZARFull(Number(valueInput))}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Compliance %</label>
              <input name="compliance" type="number" min={0} max={100} defaultValue={tender?.compliance} placeholder="80" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-grey px-4 py-2 rounded-lg hover:bg-surface transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
