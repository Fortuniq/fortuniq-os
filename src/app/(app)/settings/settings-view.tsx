"use client";

import { CheckCircle2, XCircle, User, Building2, Palette, Users2, Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamManagement } from "./TeamManagement";
import { ALL_MODULES, type UserPermissions, type ModuleKey } from "@/lib/permissions";

type SessionUser = { name?: string | null; email?: string | null; image?: string | null } | undefined;
type TeamMember = { email: string; name: string | null; is_admin: boolean; allowed_modules: ModuleKey[] };

function StatusRow({ label, connected, detail }: { label: string; connected: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-navy">{label}</p>
        <p className="text-xs text-light-grey">{detail}</p>
      </div>
      {connected ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4" /> Connected
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <XCircle className="w-4 h-4" /> Not connected
        </span>
      )}
    </div>
  );
}

export function SettingsView({
  user,
  supabaseConfigured,
  aiConfigured,
  permissions,
  teamMembers,
}: {
  user?: SessionUser;
  supabaseConfigured: boolean;
  aiConfigured: boolean;
  permissions: UserPermissions;
  teamMembers: TeamMember[];
}) {
  return (
    <div>
      <PageHeader title="Settings" description="Organisation, users and integrations." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange" /> Your Profile
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold overflow-hidden">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.slice(0, 2).toUpperCase() ?? "?"
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">{user?.name ?? "Not signed in"}</p>
                <p className="text-xs text-light-grey">{user?.email}</p>
              </div>
            </div>
            {permissions.isAdmin && (
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-orange bg-orange/10 px-2 py-1 rounded-full">
                Administrator
              </p>
            )}
            <p className="text-xs text-light-grey pt-2">
              Signed in via Microsoft 365. Profile details are managed centrally in your organisation&apos;s
              Microsoft admin centre, not here.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-orange" /> Organisation
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-grey">Company</span>
              <span className="text-navy font-medium">FortunIQ Fuels (Pty) Ltd</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-grey">Registration No.</span>
              <span className="text-navy font-medium">2016/324403/07</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-grey">Wholesale Licence</span>
              <span className="text-navy font-medium">W/2026/0032</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-grey">B-BBEE Status</span>
              <span className="text-navy font-medium">Level 1</span>
            </div>
          </CardBody>
        </Card>

        {permissions.isAdmin ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5 text-orange" /> Team Management
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <TeamManagement members={teamMembers} currentUserEmail={permissions.email} />
            </CardBody>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange" /> Your Access
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-grey mb-3">You currently have access to:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_MODULES.filter((m) => permissions.allowedModules.includes(m.key)).map((m) => (
                  <span key={m.key} className="text-xs font-medium text-navy bg-surface px-2.5 py-1 rounded-full">
                    {m.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-light-grey mt-4">
                Need access to something else? Ask a FortunIQ OS administrator.
              </p>
            </CardBody>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardBody>
            <StatusRow
              label="Database (Supabase)"
              connected={supabaseConfigured}
              detail={supabaseConfigured ? "Live data connected" : "Running on placeholder data — see supabase/SETUP.md"}
            />
            <StatusRow
              label="Microsoft Login"
              connected={!!user}
              detail={user ? "Restricted to your organisation's Microsoft 365 accounts" : "Not signed in"}
            />
            <StatusRow
              label="AI Assistant (Claude)"
              connected={aiConfigured}
              detail={aiConfigured ? "Connected and answering" : "Add ANTHROPIC_API_KEY — see docs/AI_ASSISTANT_SETUP.md"}
            />
            <StatusRow
              label="SharePoint (document storage)"
              connected={false}
              detail="Not yet connected — Documents currently stores metadata only"
            />
            <StatusRow
              label="Power BI / Metabase"
              connected={false}
              detail="Not yet connected — connect directly to your Supabase Postgres database"
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-orange" /> Brand
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-navy" />
              <span className="text-xs text-grey">#1c1b1c</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange" />
              <span className="text-xs text-grey">#F05A28</span>
            </div>
            <p className="text-xs text-light-grey ml-auto">Montserrat (display) · Inter (body)</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
