"use client";

import { useState, useTransition } from "react";
import { UserPlus, Shield, Trash2, X } from "lucide-react";
import { ALL_MODULES, ALL_ROLES, type ModuleKey, type RoleKey } from "@/lib/permissions";
import { addTeamMember, updateTeamMemberModules, setTeamMemberRole, removeTeamMember } from "./team-actions";

type TeamMember = {
  email: string;
  name: string | null;
  is_admin: boolean;
  role: RoleKey | null;
  allowed_modules: ModuleKey[];
};

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  "Super Admin": "Everything, including Team Management and Audit Logs.",
  "Management": "Broad visibility across the business, not including Team Management.",
  "HR/Admin": "People, Academy, Documents, and Audit Logs. Not Finance or Sales figures.",
  "Finance": "Finance, Reports, Documents. Not People/HR records.",
  "Sales/Marketing": "Customers, Sales, Reports, Documents. Not Finance.",
  "Employee": "Dashboard, Academy, Documents, AI Assistant. The default, most restrictive role.",
};

export function TeamManagement({ members, currentUserEmail }: { members: TeamMember[]; currentUserEmail?: string }) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  function handleRoleChange(member: TeamMember, role: RoleKey) {
    startTransition(async () => {
      try {
        await setTeamMemberRole(member.email, role);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleModuleToggle(member: TeamMember, moduleKey: ModuleKey) {
    if (member.role === "Super Admin") return; // Super Admins always have everything
    const next = member.allowed_modules.includes(moduleKey)
      ? member.allowed_modules.filter((m) => m !== moduleKey)
      : [...member.allowed_modules, moduleKey];
    startTransition(async () => {
      try {
        await updateTeamMemberModules(member.email, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleRemove(member: TeamMember) {
    if (!confirm(`Remove ${member.name || member.email}? They'll lose access immediately.`)) return;
    startTransition(async () => {
      try {
        await removeTeamMember(member.email);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addTeamMember(formData);
        setShowAddForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-light-grey">
          {members.length} {members.length === 1 ? "person" : "people"} provisioned
        </p>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Add Person
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showAddForm && (
        <form action={handleAdd} className="bg-surface rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="name@iqfuels.co.za"
              className="text-sm px-3 py-2 rounded-lg border border-border w-56 focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Name (optional)</label>
            <input
              name="name"
              type="text"
              placeholder="Full name"
              className="text-sm px-3 py-2 rounded-lg border border-border w-44 focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="text-sm font-semibold text-white bg-orange px-4 py-2 rounded-lg hover:brightness-95 transition disabled:opacity-50"
          >
            Add
          </button>
          <p className="text-xs text-light-grey w-full">
            New people start as <strong>Employee</strong> — the most restrictive role — until you assign them
            something else below. They can sign in as soon as they use their Microsoft account.
          </p>
        </form>
      )}

      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.email} className="border border-border rounded-lg">
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy text-sm">{member.name || member.email}</p>
                <p className="text-xs text-light-grey">{member.email}</p>
              </div>

              <select
                value={member.role ?? "Employee"}
                onChange={(e) => handleRoleChange(member, e.target.value as RoleKey)}
                disabled={isPending || member.email === currentUserEmail}
                title={member.email === currentUserEmail ? "You can't change your own role" : "Change role"}
                className="text-xs font-semibold rounded-lg border border-border px-2 py-1.5 disabled:opacity-40"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {member.role === "Super Admin" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-orange shrink-0">
                  <Shield className="w-3.5 h-3.5 fill-orange/20" />
                </span>
              )}

              <button
                onClick={() => setExpandedEmail(expandedEmail === member.email ? null : member.email)}
                className="text-xs text-grey hover:text-navy transition-colors shrink-0"
              >
                {expandedEmail === member.email ? "Hide modules" : "Fine-tune"}
              </button>

              <button
                onClick={() => handleRemove(member)}
                disabled={isPending || member.email === currentUserEmail}
                className="text-grey hover:text-red-600 transition-colors disabled:opacity-30 shrink-0"
                title={member.email === currentUserEmail ? "You can't remove yourself" : "Remove access"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-light-grey px-3 pb-2">
              {ROLE_DESCRIPTIONS[member.role ?? "Employee"]}
            </p>

            {expandedEmail === member.email && (
              <div className="border-t border-border bg-surface p-3 flex flex-wrap gap-3">
                {ALL_MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-1.5 text-xs text-navy">
                    <input
                      type="checkbox"
                      checked={member.role === "Super Admin" || member.allowed_modules.includes(m.key)}
                      disabled={
                        isPending ||
                        member.role === "Super Admin" ||
                        m.key === "dashboard" ||
                        m.key === "settings"
                      }
                      onChange={() => handleModuleToggle(member, m.key)}
                      className="w-3.5 h-3.5 accent-orange"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-light-grey mt-4">
        Choosing a role sets that role&apos;s documented default modules immediately — use &ldquo;Fine-tune&rdquo;
        if one specific person genuinely needs an exception. Dashboard and Settings are always available to
        anyone provisioned, so nobody gets locked out entirely. See docs/ROLES_AND_PERMISSIONS.md for the full
        reasoning behind each role.
      </p>
    </div>
  );
}
