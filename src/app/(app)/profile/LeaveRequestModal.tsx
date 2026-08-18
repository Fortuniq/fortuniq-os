"use client";

import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { requestLeaveAction } from "./leave-actions";
import { calculateWorkingDays } from "@/lib/hcm-core";

const LEAVE_TYPES = ["Annual", "Sick", "Family Responsibility", "Study", "Maternity", "Paternity", "Unpaid"];

export function LeaveRequestModal({ onClose }: { onClose: () => void }) {
  const [leaveType, setLeaveType] = useState("Annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const workingDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    return calculateWorkingDays(startDate, endDate);
  }, [startDate, endDate]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestLeaveAction(formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">Request Leave</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>
        <form action={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Leave Type</label>
            <select name="leaveType" value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Start Date</label>
              <input type="date" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">End Date</label>
              <input type="date" name="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>
          {workingDays !== null && (
            <p className="text-xs text-orange font-semibold">
              {workingDays > 0 ? `${workingDays} working day${workingDays === 1 ? "" : "s"} requested (weekends excluded)` : "End date must be on or after the start date."}
            </p>
          )}
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Reason</label>
            <textarea name="reason" rows={2} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Attachment (optional)</label>
            <input type="file" name="attachment" className="w-full text-sm" />
            <p className="text-[11px] text-light-grey mt-1">Files up to 4MB are supported.</p>
          </div>
          <button type="submit" disabled={isPending || (workingDays !== null && workingDays <= 0)} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
