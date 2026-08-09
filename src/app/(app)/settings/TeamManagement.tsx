"use client";

import { useState, useTransition } from "react";
import { UserPlus, Shield, Trash2, X } from "lucide-react";
import { ALL_MODULES, type ModuleKey } from "@/lib/permissions";
import { addTeamMember, updateTeamMemberModules, setTeamMemberAdmin, removeTeamMember } from "./team-actions";

type TeamMember = {
  email: string;
  name: string | null;
  is_admin: boolean;
  allowed_modules: ModuleKey[];
};

export function TeamManagement({ members, currentUserEmail }: { members: TeamMember[]; currentUserEmail?: string }) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleModuleToggle(member: TeamMember, moduleKey: ModuleKey) {
    if (member.is_admin) return; // admins always have everything
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

  function handleAdminToggle(member: TeamMember) {
    startTransition(async () => {
      try {
        await setTeamMemberAdmin(member.email, !member.is_admin);
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
            New people start with just Dashboard and Settings access — grant more modules below once added.
            They'll be able to sign in as soon as they use their Microsoft account.
          </p>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Person</th>
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Admin</th>
              {ALL_MODULES.map((m) => (
                <th key={m.key} className="py-2 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-grey text-center" title={m.label}>
                  {m.label.slice(0, 3)}
                </th>
              ))}
              <th className="py-2 pl-4"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.email} className="border-b border-border last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-medium text-navy">{member.name || member.email}</p>
                  <p className="text-xs text-light-grey">{member.email}</p>
                </td>
                <td className="py-3 pr-4">
                  <button
                    onClick={() => handleAdminToggle(member)}
                    disabled={isPending || member.email === currentUserEmail}
                    title={member.email === currentUserEmail ? "You can't change your own admin status" : ""}
                    className="disabled:opacity-40"
                  >
                    {member.is_admin ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-orange">
                        <Shield className="w-3.5 h-3.5 fill-orange/20" /> Admin
                      </span>
                    ) : (
                      <span className="text-xs text-light-grey hover:text-navy transition-colors">Make admin</span>
                    )}
                  </button>
                </td>
                {ALL_MODULES.map((m) => (
                  <td key={m.key} className="py-3 px-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={member.is_admin || member.allowed_modules.includes(m.key)}
                      disabled={isPending || member.is_admin || (m.key === "dashboard" || m.key === "settings")}
                      onChange={() => handleModuleToggle(member, m.key)}
                      className="w-4 h-4 accent-orange"
                    />
                  </td>
                ))}
                <td className="py-3 pl-4 text-right">
                  <button
                    onClick={() => handleRemove(member)}
                    disabled={isPending || member.email === currentUserEmail}
                    className="text-grey hover:text-red-600 transition-colors disabled:opacity-30"
                    title={member.email === currentUserEmail ? "You can't remove yourself" : "Remove access"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-light-grey mt-4">
        Dashboard and Settings are always available to anyone provisioned, so nobody gets locked out entirely.
        Admins automatically have every module — individual checkboxes only apply to non-admins.
      </p>
    </div>
  );
}
