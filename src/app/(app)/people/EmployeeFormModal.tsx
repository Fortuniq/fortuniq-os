"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { addEmployee, updateEmployee } from "./employee-actions";
import type { EmployeeProfile } from "@/lib/data";

type ManagerOption = { id: string; name: string };

export function EmployeeFormModal({
  employee, managers, onClose,
}: {
  employee?: EmployeeProfile;
  managers: ManagerOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (employee) {
          await updateEmployee(employee.id, formData);
        } else {
          await addEmployee(formData);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const banking = employee?.bankingDetails;
  const emergency = employee?.emergencyContact;
  const kin = employee?.nextOfKin;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white">
          <p className="font-semibold text-navy">{employee ? `Edit ${employee.name}` : "Add Employee"}</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <form action={handleSubmit} className="p-4 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          <Section title="Basic Info">
            <Field label="Full Name" name="name" defaultValue={employee?.name} required />
            <Field label="Preferred Name" name="preferredName" defaultValue={employee?.preferredName ?? ""} />
            <Field label="Photo URL" name="photoUrl" defaultValue={employee?.photoUrl ?? ""} placeholder="https://…" />
          </Section>

          <Section title="Employment">
            <Field label="Position" name="role" defaultValue={employee?.role} required />
            <Field label="Department" name="dept" defaultValue={employee?.dept} required />
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Manager</label>
              <select name="managerId" defaultValue="" className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                <option value="">— None —</option>
                {managers.filter((m) => m.id !== employee?.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <Field label="Office Location" name="officeLocation" defaultValue={employee?.officeLocation ?? ""} />
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Employment Type</label>
              <select name="employmentType" defaultValue={employee?.employmentType ?? ""} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                <option value="">— Select —</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Status</label>
              <select name="status" defaultValue={employee?.status ?? "Onboarding"} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                {["Onboarding", "Active", "On Leave", "Suspended", "Archived"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Start Date" name="startDate" type="date" defaultValue={employee?.startDate ?? ""} />
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Probation Status</label>
              <select name="probationStatus" defaultValue={employee?.probationStatus ?? "Not Applicable"} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                {["In Probation", "Confirmed", "Not Applicable"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </Section>

          <Section title="Contact">
            <Field label="Email (their Microsoft sign-in — required)" name="email" type="email" defaultValue={employee?.email ?? ""} required />
            <Field label="Phone" name="phone" defaultValue={employee?.phone ?? ""} />
          </Section>

          <Section title="Emergency Contact">
            <Field label="Name" name="emergencyName" defaultValue={emergency?.name ?? ""} />
            <Field label="Relationship" name="emergencyRelationship" defaultValue={emergency?.relationship ?? ""} />
            <Field label="Phone" name="emergencyPhone" defaultValue={emergency?.phone ?? ""} />
          </Section>

          <Section title="Next of Kin">
            <Field label="Name" name="kinName" defaultValue={kin?.name ?? ""} />
            <Field label="Relationship" name="kinRelationship" defaultValue={kin?.relationship ?? ""} />
            <Field label="Phone" name="kinPhone" defaultValue={kin?.phone ?? ""} />
          </Section>

          <Section title="Financial (Restricted — only you, HR/Admin, Finance, and this employee can see this)">
            <Field label="Bank" name="bankName" defaultValue={banking?.bank ?? ""} />
            <Field label="Account Number" name="bankAccountNumber" defaultValue={banking?.accountNumber ?? ""} />
            <Field label="Branch Code" name="bankBranchCode" defaultValue={banking?.branchCode ?? ""} />
            <Field label="Account Type" name="bankAccountType" defaultValue={banking?.accountType ?? ""} />
            <Field label="Tax Number" name="taxNumber" defaultValue={employee?.taxNumber ?? ""} />
          </Section>

          <Section title="Skills & Performance">
            <Field label="Skills (comma-separated)" name="skills" defaultValue={(employee?.skills ?? []).join(", ")} />
            <Field label="Performance Rating" name="performanceRating" defaultValue={employee?.performanceRating ?? ""} />
          </Section>

          <div className="flex justify-end gap-2 pt-2 pb-2 border-t border-border">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-grey mb-2">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, name, defaultValue, required, type = "text", placeholder }: {
  label: string; name: string; defaultValue?: string; required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-grey block mb-1">{label}</label>
      <input
        name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-orange/40"
      />
    </div>
  );
}
