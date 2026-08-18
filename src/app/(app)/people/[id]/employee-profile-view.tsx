"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Briefcase, Users2, Calendar, Shield, Phone, Mail,
  Lock, Award, Laptop, TrendingUp, Sparkles, CheckCircle2, XCircle, Pencil, Plus, ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import type { EmployeeProfile } from "@/lib/data";
import { EmployeeFormModal } from "../EmployeeFormModal";
import { SystemAccessPermissions } from "./SystemAccessPermissions";
import { addEquipment, addCertification } from "../employee-actions";
import { EmployeeDocumentCentre } from "./EmployeeDocumentCentre";
import { EmployeeHCMPanel } from "./EmployeeHCMPanel";
import type { LeaveRequest } from "@/lib/leave";
import type { PerformanceReview } from "@/lib/performance";

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
  isAdmin,
  isSuperAdmin,
  isHR,
  canEditIdentity,
  canEditPayroll,
  canManageThisEmployee,
  documents,
  leaveRequests,
  performanceReviews,
  managers,
}: {
  profile: EmployeeProfile;
  canViewRestricted: boolean;
  isOwnProfile: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isHR: boolean;
  canEditIdentity: boolean;
  canEditPayroll: boolean;
  canManageThisEmployee: boolean;
  documents: { id: string; name: string; category: string; version: string; status: string; visibility: string; acknowledgementRequired: boolean; sharepointItemId: string | null; sharepointWebUrl: string | null; updated: string }[];
  leaveRequests: LeaveRequest[];
  performanceReviews: PerformanceReview[];
  managers: { id: string; name: string }[];
}) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);

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
          {isAdmin && (
            <button
              onClick={() => setShowEditForm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-navy bg-surface px-3 py-2 rounded-lg hover:bg-orange hover:text-white transition-colors shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
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
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle><span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-orange" /> Skills & Certifications</span></CardTitle>
              {isAdmin && (
                <button onClick={() => setShowAddCert((s) => !s)} className="text-grey hover:text-orange transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {showAddCert && (
              <form
                action={async (fd) => { await addCertification(profile.id, fd); setShowAddCert(false); }}
                className="bg-surface rounded-lg p-3 mb-3 space-y-2"
              >
                <input name="name" placeholder="Certification name" required className="w-full text-sm px-3 py-1.5 rounded-lg border border-border" />
                <div className="flex gap-2">
                  <input name="issuedDate" type="date" className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border" placeholder="Issued" />
                  <input name="expiryDate" type="date" className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border" placeholder="Expires" />
                </div>
                <button type="submit" className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">Add</button>
              </form>
            )}
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
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle><span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-orange" /> Equipment Issued</span></CardTitle>
              {isAdmin && (
                <button onClick={() => setShowAddEquipment((s) => !s)} className="text-grey hover:text-orange transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {showAddEquipment && (
              <form
                action={async (fd) => { await addEquipment(profile.id, fd); setShowAddEquipment(false); }}
                className="bg-surface rounded-lg p-3 mb-3 space-y-2"
              >
                <input name="item" placeholder="Item (e.g. Laptop — Dell Latitude)" required className="w-full text-sm px-3 py-1.5 rounded-lg border border-border" />
                <div className="flex gap-2">
                  <input name="serialNumber" placeholder="Serial number" className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border" />
                  <input name="issuedDate" type="date" className="text-sm px-3 py-1.5 rounded-lg border border-border" />
                </div>
                <button type="submit" className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">Add</button>
              </form>
            )}
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
                Overall role is managed in Settings → Team Management. Granular module permissions below.
              </span>
            </div>
          </CardBody>
        </Card>

        {isSuperAdmin && (
          profile.email ? (
            <SystemAccessPermissions employeeEmail={profile.email} employeeName={profile.preferredName || profile.name} />
          ) : (
            <Card className="lg:col-span-3 border-amber-200 bg-amber-50">
              <CardBody className="flex items-center gap-3 py-4">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">System Access & Permissions needs an email address</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {profile.name} doesn&apos;t have an email on file yet — permissions are matched to a person&apos;s
                    Microsoft sign-in, so there&apos;s nothing to attach them to until one&apos;s added. Click
                    <strong> Edit</strong> above and add their email address to unlock this section.
                  </p>
                </div>
              </CardBody>
            </Card>
          )
        )}
      </div>

      {isHR && (
        <div className="mt-4">
          <EmployeeDocumentCentre employeeId={profile.id} documents={documents} />
        </div>
      )}

      {(isHR || canManageThisEmployee || canEditPayroll) && (
        <div className="mt-4">
          <EmployeeHCMPanel
            profile={profile}
            leaveRequests={leaveRequests}
            performanceReviews={performanceReviews}
            canEditIdentity={canEditIdentity}
            canEditPayroll={canEditPayroll}
            canManageThisEmployee={canManageThisEmployee}
            isHR={isHR}
          />
        </div>
      )}

      <p className="text-[11px] text-light-grey mt-4">
        This profile is this employee&apos;s digital personnel file. Documents uploaded here, marked &ldquo;Employee
        Visible,&rdquo; automatically appear in this employee&apos;s own My Profile → My Employment File.
      </p>

      {showEditForm && (
        <EmployeeFormModal employee={profile} managers={managers} onClose={() => setShowEditForm(false)} />
      )}
    </div>
  );
}
