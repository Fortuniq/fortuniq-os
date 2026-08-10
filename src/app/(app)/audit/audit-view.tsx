"use client";

import { ShieldCheck, LogIn, UserCog, UserPlus, UserMinus, FileEdit, FileText, Eye, Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatDate } from "@/lib/format";

type AuditEntry = {
  id: string;
  created_at: string;
  actor_email: string;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  metadata: Record<string, unknown> | null;
};

type AILogEntry = {
  id: string;
  created_at: string;
  actor_email: string;
  actor_name: string | null;
  ai_module: string;
  data_sources_accessed: { id: string; name: string }[] | null;
  execution_outcome: string;
};

const ACTION_META: Record<string, { label: string; icon: typeof LogIn; tone: string }> = {
  sign_in: { label: "Signed in", icon: LogIn, tone: "text-blue-600 bg-blue-50" },
  role_changed: { label: "Changed someone's role", icon: UserCog, tone: "text-orange bg-orange/10" },
  team_member_added: { label: "Added a team member", icon: UserPlus, tone: "text-emerald-600 bg-emerald-50" },
  team_member_removed: { label: "Removed a team member", icon: UserMinus, tone: "text-red-600 bg-red-50" },
  team_member_modules_changed: { label: "Fine-tuned someone's access", icon: UserCog, tone: "text-orange bg-orange/10" },
  document_status_changed: { label: "Changed a document's status", icon: FileEdit, tone: "text-amber-600 bg-amber-50" },
  document_catalogued: { label: "Added a document from SharePoint", icon: FileText, tone: "text-emerald-600 bg-emerald-50" },
  document_previewed: { label: "Viewed a document", icon: Eye, tone: "text-grey bg-surface" },
};

function describeEntry(entry: AuditEntry): string {
  const meta = entry.metadata;
  if (entry.action === "role_changed" && meta) {
    return `${entry.target_label} — ${meta.before ?? "no role"} → ${meta.after}`;
  }
  if (entry.action === "document_status_changed" && meta) {
    return `${entry.target_label} — ${meta.before} → ${meta.after}`;
  }
  return entry.target_label ?? "";
}

export function AuditView({
  entries,
  aiLogs,
  roleCounts,
}: {
  entries: AuditEntry[];
  aiLogs: AILogEntry[];
  roleCounts: { signIns: number; permissionChanges: number; documentViews: number; aiQueries: number };
}) {
  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="A record of sign-ins, permission changes, document activity, and AI Assistant use across FortunIQ OS."
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Sign-ins (all time)" value={String(roleCounts.signIns)} icon={LogIn} />
        <StatCard label="Permission Changes" value={String(roleCounts.permissionChanges)} icon={UserCog} />
        <StatCard label="Document Views" value={String(roleCounts.documentViews)} icon={Eye} />
        <StatCard label="AI Assistant Queries" value={String(roleCounts.aiQueries)} icon={Sparkles} />
      </div>

      <Card>
        <CardBody className="pt-5">
          {entries.length === 0 ? (
            <p className="text-sm text-grey py-8 text-center">No audit activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">When</th>
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Who</th>
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Action</th>
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: ShieldCheck, tone: "text-grey bg-surface" };
                    const Icon = meta.icon;
                    return (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4 text-xs text-light-grey whitespace-nowrap">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-navy font-medium">{entry.actor_name || entry.actor_email}</p>
                          <p className="text-xs text-light-grey">{entry.actor_email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${meta.tone}`}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-navy text-xs">{describeEntry(entry)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange" /> AI Security Log
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          {aiLogs.length === 0 ? (
            <p className="text-sm text-grey py-8 text-center">No AI Assistant activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">When</th>
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Who</th>
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Outcome</th>
                    <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-grey">Documents in scope</th>
                  </tr>
                </thead>
                <tbody>
                  {aiLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-xs text-light-grey whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="py-3 pr-4">
                        <p className="text-navy font-medium">{log.actor_name || log.actor_email}</p>
                        <p className="text-xs text-light-grey">{log.actor_email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
                            log.execution_outcome === "answered" ? "text-emerald-600 bg-emerald-50"
                            : log.execution_outcome === "denied" ? "text-red-600 bg-red-50"
                            : log.execution_outcome === "rate_limited" ? "text-amber-600 bg-amber-50"
                            : "text-grey bg-surface"
                          }`}
                        >
                          {log.execution_outcome}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-navy text-xs">
                        {log.data_sources_accessed && log.data_sources_accessed.length > 0
                          ? log.data_sources_accessed.map((d) => d.name).join(", ")
                          : "— none —"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-[11px] text-light-grey mt-4">
        Visible only to Super Admin and HR/Admin roles. Deliberately never shows the actual prompt text or
        document content — only which documents were available to the AI when it answered. See
        docs/AUDIT_LOGS.md and docs/AI_SECURITY.md for exactly what is and isn&apos;t
        currently recorded.
      </p>
    </div>
  );
}
