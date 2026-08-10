"use client";

import Link from "next/link";
import {
  ArrowLeft, MapPin, Briefcase, Users2, Calendar, Shield, Phone, Mail,
  Lock, Award, Laptop, TrendingUp, Sparkles, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import type { EmployeeProfile } from "@/lib/data";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
      <span className="text-grey">{label}</span>
      <span className="text-navy font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

function RestrictedRow({ label, value, canView }: { label: string; value: string | null; canView: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
      <span className="text-grey">{label}</span>
      {canView ? (
        <span className="text-navy font-medium text-right">{value || "Not yet provided"}</span>
      ) : (
        <span className="flex items-center gap-1 text-light-grey text-xs">
          <Lock className="w-3 h-3" /> Restricted
        </span>
      )}
    </div>
  );
}

export function EmployeeProfileView({
  profile,
  canViewRestricted,
  isOwnProfile,
}: {
  profile: EmployeeProfile;
  canViewRestricted: boolean;
  isOwnProfile: boolean;
}) {
  return (
    <div>
      <Link href="/people" className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Employee Hub
      </Link>

      {/* Header */}
      <Card className="p-6 mb-4">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-navy text-white text-2xl font-bold flex items-center justify-center shrink-0 overflow-hidden">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              initials(profile.name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl font-black text-navy">{profile.preferredName || profile.name}</h1>
              <Badge tone={statusTone(profile.status)}>{profile.status}</Badge>
              {isOwnProfile && <Badge tone="orange">Your Profile</Badge>}
            </div>
            {profile.preferredName && <p className="text-sm text-grey">{profile.name}</p>}
            <p className="text-sm text-grey mt-1">{profile.role} · {profile.dept}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-light-grey">
              {profile.employeeNumber && <span className="font-mono">{profile.employeeNumber}</span>}
              {profile.officeLocation && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {profile.officeLocation}</span>
              )}
              {profile.managerName && (
                <span className="flex items-center gap-1"><Users2 className="w-3 h-3" /> Reports to {profile.managerName}</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Employment details */}
        <Card>
          <CardHeader><CardTitle><span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-orange" /> Employment</span></CardTitle></CardHeader>
          <CardBody>
            <InfoRow label="Employment Type" value={profile.employmentType} />
            <InfoRow label="Start Date" value={formatDate(profile.startDate)} />
            <InfoRow label="Probation Status" value={profile.probationStatus} />
            <InfoRow label="Status" value={profile.status} />
          </CardBody>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader><CardTitle><span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-orange" /> Contact</span></CardTitle></CardHeader>
          <CardBody>
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Phone" value={profile.phone} />
            <InfoRow label="Emergency Contact" value={profile.emergencyContact?.name ? `${profile.emergencyContact.name} (${profile.emergencyContact.relationship ?? "—"})` : null} />
            <InfoRow label="Next of Kin" value={profile.nextOfKin?.name ?? null} />
          </CardBody>
        </Card>

        {/* Restricted: banking & tax */}
        <Card>
          <CardHeader>
            <CardTitle><span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-orange" /> Financial (Restricted)</span></CardTitle>
          </CardHeader>
          <CardBody>
            <RestrictedRow label="Bank" value={profile.bankingDetails?.bank ?? null} canView={canViewRestricted} />
            <RestrictedRow label="Account Number" value={profile.bankingDetails?.accountNumber ?? null} canView={canViewRestricted} />
            <RestrictedRow label="Tax Number" value={profile.taxNumber} canView={canViewRestricted} />
            {!canViewRestricted && (
              <p className="text-[11px] text-light-grey mt-2">
                Visible only to this employee, HR/Admin, Finance, and Super Admin.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader><CardTitle><span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-orange" /> Skills & Certifications</span></CardTitle></CardHeader>
          <CardBody>
            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {profile.skills.map((s) => (
                  <span key={s} className="text-xs font-medium text-navy bg-surface px-2 py-1 rounded-full">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-grey mb-3">No skills recorded yet.</p>
            )}
            {profile.certifications.length > 0 ? (
              profile.certifications.map((c) => (
                <div key={c.id} className="flex justify-between py-1.5 border-t border-border text-sm">
                  <span className="text-navy">{c.name}</span>
                  <span className="text-xs text-light-grey">{c.expiryDate ? `Expires ${formatDate(c.expiryDate)}` : "No expiry"}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-light-grey">No certifications on file.</p>
            )}
          </CardBody>
        </Card>

        {/* Equipment */}
        <Card>
          <CardHeader><CardTitle><span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-orange" /> Equipment Issued</span></CardTitle></CardHeader>
          <CardBody>
            {profile.equipment.length > 0 ? (
              profile.equipment.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div>
                    <p className="text-navy font-medium">{eq.item}</p>
                    {eq.serialNumber && <p className="text-xs text-light-grey">{eq.serialNumber}</p>}
                  </div>
                  {eq.status === "Issued" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Issued</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-grey"><XCircle className="w-3.5 h-3.5" /> Returned</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-grey">No equipment currently issued.</p>
            )}
          </CardBody>
        </Card>

        {/* Performance & Leave */}
        <Card>
          <CardHeader><CardTitle><span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-orange" /> Performance & Leave</span></CardTitle></CardHeader>
          <CardBody>
            <InfoRow label="Performance Rating" value={profile.performanceRating} />
            <InfoRow label="Annual Leave Balance" value={profile.leaveBalance?.annual !== undefined ? `${profile.leaveBalance.annual} days` : null} />
            <InfoRow label="Sick Leave Balance" value={profile.leaveBalance?.sick !== undefined ? `${profile.leaveBalance.sick} days` : null} />
            <InfoRow label="Family Responsibility" value={profile.leaveBalance?.family_responsibility !== undefined ? `${profile.leaveBalance.family_responsibility} days` : null} />
          </CardBody>
        </Card>

        {/* System Access */}
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle><span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-orange" /> System Access</span></CardTitle></CardHeader>
          <CardBody className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-grey" />
              <span className="text-sm text-navy">{profile.email ?? "No Microsoft account linked"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-grey" />
              <span className="text-sm text-grey">
                Role and module access are managed in Settings → Team Management.
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <p className="text-[11px] text-light-grey mt-4">
        This profile is this employee&apos;s digital personnel file. Document Centre (contracts, ID documents,
        performance reviews, and more) is coming in the next phase of the Employee Hub — see docs/EMPLOYEE_HUB.md.
      </p>
    </div>
  );
}
