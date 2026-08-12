"use client";

import { useState, useEffect, useTransition } from "react";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { ALL_RBAC_MODULES, ALL_PERMISSION_ACTIONS, ALL_ROLE_TEMPLATES, type PermissionAction, type RbacModuleKey, type EmployeePermissionSet, type RoleTemplateKey } from "@/lib/rbac-core";
import { applyRoleTemplate, updateModulePermissions, fetchEmployeePermissionSet } from "../rbac-actions";

export function SystemAccessPermissions({ employeeEmail, employeeName }: { employeeEmail: string; employeeName: string }) {
  const [permissionSet, setPermissionSet] = useState<EmployeePermissionSet | null>(null);
  const [isPending, startTransition] = useTransition();
  const [templateToApply, setTemplateToApply] = useState<RoleTemplateKey | "">("");

  async function reload() {
    const set = await fetchEmployeePermissionSet(employeeEmail);
    setPermissionSet(set);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeEmail]);

  function toggleAction(moduleKey: RbacModuleKey, action: PermissionAction) {
    if (!permissionSet) return;
    const current = permissionSet[moduleKey] ?? [];
    const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
    startTransition(async () => {
      await updateModulePermissions(employeeEmail, moduleKey, next);
      await reload();
    });
  }

  function handleApplyTemplate() {
    if (!templateToApply) return;
    if (!confirm(`Apply the "${templateToApply}" template? This replaces ${employeeName}'s current permissions entirely.`)) return;
    startTransition(async () => {
      await applyRoleTemplate(employeeEmail, templateToApply);
      setTemplateToApply("");
      await reload();
    });
  }

  if (!permissionSet) {
    return (
      <Card>
        <CardHeader><CardTitle><span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-orange" /> System Access & Permissions</span></CardTitle></CardHeader>
        <CardBody><p className="text-xs text-light-grey py-3">Loading…</p></CardBody>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <CardTitle><span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-orange" /> System Access & Permissions</span></CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={templateToApply}
                onChange={(e) => setTemplateToApply(e.target.value as RoleTemplateKey | "")}
                className="text-xs font-medium rounded-lg border border-border px-2.5 py-1.5 pr-7 appearance-none bg-white"
              >
                <option value="">Apply a Role Template…</option>
                {ALL_ROLE_TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-grey" />
            </div>
            <button
              onClick={handleApplyTemplate}
              disabled={!templateToApply || isPending}
              className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-semibold uppercase tracking-wide text-grey">Module</th>
                {ALL_PERMISSION_ACTIONS.map((a) => (
                  <th key={a} className="py-2 px-1.5 font-semibold uppercase tracking-wide text-grey text-center">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_RBAC_MODULES.map((m) => {
                const actions = permissionSet[m.key] ?? [];
                const hasManage = actions.includes("Manage");
                return (
                  <tr key={m.key} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-navy font-medium whitespace-nowrap">
                      {m.label}
                      {actions.length === 0 && <span className="ml-2 text-[10px] text-light-grey font-normal">No Access</span>}
                    </td>
                    {ALL_PERMISSION_ACTIONS.map((a) => (
                      <td key={a} className="py-2 px-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={actions.includes(a) || (hasManage && a !== "Manage")}
                          disabled={isPending || (hasManage && a !== "Manage")}
                          onChange={() => toggleAction(m.key, a)}
                          className="w-3.5 h-3.5 accent-orange"
                          title={hasManage && a !== "Manage" ? "Included automatically by Manage" : undefined}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-light-grey mt-3">
          Unticked modules mean this person has no access at all, at this granular level. &ldquo;Manage&rdquo;
          automatically includes every other action for that module. Changes save immediately per checkbox — no
          separate Save button needed. See docs/RBAC.md for how this relates to their overall role.
        </p>
      </CardBody>
    </Card>
  );
}
