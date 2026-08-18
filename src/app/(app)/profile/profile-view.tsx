"use client";

import { useState, useTransition } from "react";
import { Download, ExternalLink, CheckCircle2, AlertTriangle, Loader2, User, Award, IdCard, CalendarDays, TrendingUp, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import { acknowledgeDocumentAction } from "./profile-actions";
import { cancelMyLeaveRequestAction } from "./leave-actions";
import { LeaveRequestModal } from "./LeaveRequestModal";
import { maskIdNumber } from "@/lib/hcm-core";
import type { EmployeeProfile } from "@/lib/data";
import type { EmploymentFileDocument } from "@/lib/employee-documents";
import type { ComplianceItem } from "@/lib/compliance-status-core";
import type { LeaveRequest } from "@/lib/leave";
import type { PerformanceReview } from "@/lib/performance";

export function ProfileView({
  profile, employmentFile, complianceStatus, leaveRequests, performanceReviews, showIdentity,
}: {
  profile: EmployeeProfile;
  employmentFile: EmploymentFileDocument[];
  complianceStatus: ComplianceItem[];
  leaveRequests: LeaveRequest[];
  performanceReviews: PerformanceReview[];
  showIdentity: boolean;
}) {
  return (
    <div>
      <PageHeader title="My Profile" description="Your own employment information, documents, and compliance status." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {showIdentity && <IdentityCard profile={profile} />}
          <MyInformationCard profile={profile} />
          <ContactCard profile={profile} />
          <MyEmploymentFileCard documents={employmentFile} />
          <SkillsCertificationsCard profile={profile} />
          <LeaveCard profile={profile} requests={leaveRequests} />
          <PerformanceCard reviews={performanceReviews} />
        </div>
        <div>
          <ComplianceStatusCard items={complianceStatus} />
        </div>
      </div>
    </div>
  );
}

function IdentityCard({ profile }: { profile: EmployeeProfile }) {
  const id = profile.identity;
  return (
    <Card>
      <CardHeader><CardTitle><span className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-orange" /> Identity</span></CardTitle></CardHeader>
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="South African ID Number" value={maskIdNumber(id.idNumber)} />
          <Field label="Passport Number" value={id.passportNumber ?? "—"} />
          <Field label="Date of Birth" value={id.dateOfBirth ? formatDate(id.dateOfBirth) : "—"} />
          <Field label="Nationality" value={id.nationality ?? "—"} />
          <Field label="Gender" value={id.gender ?? "—"} />
          <Field label="Driver's Licence" value={id.driversLicence ?? "—"} />
          <Field label="Work Permit" value={id.workPermit ?? "—"} />
          <Field label="Home Address" value={id.homeAddress ?? "—"} />
        </dl>
        <p className="text-[11px] text-light-grey mt-3">Sensitive fields are shown masked. Contact HR to update this information.</p>
      </CardBody>
    </Card>
  );
}

function MyInformationCard({ profile }: { profile: EmployeeProfile }) {
  return (
    <Card>
      <CardHeader><CardTitle>My Information</CardTitle></CardHeader>
      <CardBody>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-surface overflow-hidden shrink-0 flex items-center justify-center">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-7 h-7 text-light-grey" />
            )}
          </div>
          <div>
            <p className="font-display text-lg font-black text-navy">{profile.preferredName || profile.name}</p>
            {profile.employeeNumber && <p className="text-xs font-mono text-light-grey">{profile.employeeNumber}</p>}
            <p className="text-sm text-grey">{profile.role} · {profile.dept}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Manager" value={profile.managerName ?? "—"} />
          <Field label="Work Location" value={profile.officeLocation ?? "—"} />
          <Field label="Employment Status" value={<Badge tone={profile.status === "Active" ? "success" : "warning"}>{profile.status}</Badge>} />
          <Field label="Employment Type" value={profile.employmentType ?? "—"} />
          <Field label="Start Date" value={formatDate(profile.startDate)} />
          <Field label="Probation Status" value={profile.probationStatus ?? "—"} />
          <Field label="Contract Type" value={profile.employmentExtra.contractType ?? "—"} />
          <Field label="Notice Period" value={profile.employmentExtra.noticePeriod ?? "—"} />
          <Field label="Probation End Date" value={profile.employmentExtra.probationEndDate ? formatDate(profile.employmentExtra.probationEndDate) : "—"} />
          <Field label="Payroll Cycle" value={profile.employmentExtra.payrollCycle ?? "—"} />
          <Field label="Shift Pattern" value={profile.employmentExtra.shiftPattern ?? "—"} />
        </dl>
      </CardBody>
    </Card>
  );
}

function ContactCard({ profile }: { profile: EmployeeProfile }) {
  const emergency = profile.emergencyContact;
  const kin = profile.nextOfKin;
  return (
    <Card>
      <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Work Email" value={profile.email ?? "—"} />
          <Field label="Company Phone" value={profile.phone ?? "—"} />
          <Field label="Emergency Contact" value={emergency?.name ? `${emergency.name}${emergency.phone ? ` — ${emergency.phone}` : ""}` : "Not captured"} />
          <Field label="Next of Kin" value={kin?.name ? `${kin.name}${kin.phone ? ` — ${kin.phone}` : ""}` : "Not captured"} />
        </dl>
      </CardBody>
    </Card>
  );
}

function SkillsCertificationsCard({ profile }: { profile: EmployeeProfile }) {
  if (profile.skills.length === 0 && profile.certifications.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-orange" /> Skills & Certifications</span></CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}
          </div>
        )}
        {profile.certifications.length > 0 && (
          <div className="space-y-1">
            {profile.certifications.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-sm text-navy">{c.name}</span>
                <span className="text-xs text-light-grey">{c.expiryDate ? `Expires ${formatDate(c.expiryDate)}` : c.issuedDate ? `Issued ${formatDate(c.issuedDate)}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-light-grey">{label}</dt>
      <dd className="text-navy font-medium">{value}</dd>
    </div>
  );
}

function MyEmploymentFileCard({ documents }: { documents: EmploymentFileDocument[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [ackTarget, setAckTarget] = useState<EmploymentFileDocument | null>(null);

  async function openPreview(itemId: string, name: string) {
    setLoadingId(itemId);
    try {
      const res = await fetch("/api/sharepoint/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, name }),
      });
      const data = await res.json();
      if (res.ok) setPreviewUrl(data.previewUrl);
      else alert(data.error);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Employment File</CardTitle>
        <span className="text-xs text-light-grey">{documents.length} document{documents.length === 1 ? "" : "s"}</span>
      </CardHeader>
      <CardBody className="space-y-1">
        {documents.length === 0 && <p className="text-sm text-light-grey py-2">No documents have been shared with you yet.</p>}
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">{d.name}</p>
              <p className="text-xs text-light-grey">
                {d.category} · {d.version} · Updated {formatDate(d.updated)}{d.modifiedBy ? ` by ${d.modifiedBy}` : ""}
              </p>
              {d.acknowledgementRequired && (
                d.acknowledged ? (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged{d.acknowledgedAt ? ` on ${formatDate(d.acknowledgedAt)}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Acknowledgement Required
                  </p>
                )
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {d.sharepointItemId && (
                <button
                  onClick={() => openPreview(d.sharepointItemId!, d.name)}
                  disabled={loadingId === d.sharepointItemId}
                  className="text-xs font-medium text-grey hover:text-orange transition-colors"
                >
                  {loadingId === d.sharepointItemId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preview"}
                </button>
              )}
              {d.sharepointWebUrl && (
                <a href={d.sharepointWebUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-grey hover:text-orange transition-colors flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              )}
              {d.acknowledgementRequired && !d.acknowledged && (
                <button
                  onClick={() => setAckTarget(d)}
                  className="text-xs font-semibold text-orange hover:underline"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        ))}
      </CardBody>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <p className="font-semibold text-navy">Document Preview</p>
              <button onClick={() => setPreviewUrl(null)}><ExternalLink className="w-4 h-4 text-grey" /></button>
            </div>
            <iframe src={previewUrl} className="flex-1 rounded-b-xl" title="Document preview" />
          </div>
        </div>
      )}

      {ackTarget && (
        <AcknowledgeConfirmDialog
          doc={ackTarget}
          onClose={() => setAckTarget(null)}
        />
      )}
    </Card>
  );
}

function AcknowledgeConfirmDialog({ doc, onClose }: { doc: EmploymentFileDocument; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeDocumentAction(doc.id);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-navy mb-3">{doc.name} — {doc.version}</p>
        <p className="text-sm text-grey mb-4">
          I confirm that I have read and understood this document. I understand that this acknowledgement will
          be permanently recorded within FortunIQ OS.
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-grey px-4 py-2 rounded-lg hover:bg-surface transition-colors">Cancel</button>
          <button
            onClick={confirm}
            disabled={isPending}
            className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
          >
            {isPending ? "Recording…" : "Confirm Acknowledgement"}
          </button>
        </div>
      </div>
    </div>
  );
}

const LEAVE_BALANCE_LABELS: Record<string, string> = {
  annual: "Annual Leave", sick: "Sick Leave", family_responsibility: "Family Responsibility Leave", study: "Study Leave",
};

function LeaveCard({ profile, requests }: { profile: EmployeeProfile; requests: LeaveRequest[] }) {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const balance = profile.leaveBalance ?? {};

  function handleCancel(id: string) {
    setCancellingId(id);
    startTransition(async () => {
      const result = await cancelMyLeaveRequestAction(id);
      setCancellingId(null);
      if (result?.error) alert(result.error);
    });
  }

  const LEAVE_STATUS_TONE: Record<string, "success" | "danger" | "neutral" | "warning"> = {
    Approved: "success", Rejected: "danger", Cancelled: "neutral", Pending: "warning",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-orange" /> Leave</span></CardTitle>
        <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">
          <Plus className="w-3.5 h-3.5" /> Request Leave
        </button>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(LEAVE_BALANCE_LABELS).map(([key, label]) => {
            const value = Number(balance[key] ?? 0);
            const max = key === "annual" ? 15 : key === "sick" ? 10 : key === "family_responsibility" ? 3 : 6;
            const pct = Math.min(100, Math.max(0, (value / max) * 100));
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-grey">{label}</span>
                  <span className="font-semibold text-navy">{value} days</span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-orange rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {requests.length === 0 && <p className="text-sm text-light-grey py-1">No leave requests yet.</p>}
        {requests.slice(0, 6).map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="min-w-0">
              <p className="text-sm text-navy">{r.leaveType} — {formatDate(r.startDate)} to {formatDate(r.endDate)}</p>
              <p className="text-xs text-light-grey">{r.workingDays} working day{r.workingDays === 1 ? "" : "s"} · requested {formatDate(r.requestedAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={LEAVE_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
              {r.status === "Pending" && (
                <button
                  onClick={() => handleCancel(r.id)}
                  disabled={isPending && cancellingId === r.id}
                  className="text-xs text-grey hover:text-red-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </CardBody>

      {showRequestModal && <LeaveRequestModal onClose={() => setShowRequestModal(false)} />}
    </Card>
  );
}

function PerformanceCard({ reviews }: { reviews: PerformanceReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle><span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-orange" /> Performance</span></CardTitle></CardHeader>
      <CardBody className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="py-2 border-b border-border last:border-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-navy">{r.reviewPeriod}</p>
              {r.overallRating && <Badge tone="info">{r.overallRating}</Badge>}
            </div>
            {r.managerFeedback && <p className="text-xs text-grey">{r.managerFeedback}</p>}
            <p className="text-xs text-light-grey mt-1">Reviewed by {r.reviewerName ?? r.reviewerEmail} · {formatDate(r.createdAt)}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function ComplianceStatusCard({ items }: { items: ComplianceItem[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Compliance Status</CardTitle></CardHeader>
      <CardBody className="space-y-2">
        {items.length === 0 && <p className="text-sm text-light-grey">Nothing tracked yet.</p>}
        {items.map((item) => (
          <p key={item.label} className="text-sm flex items-center gap-2">
            <span>{item.complete ? "🟢" : "🟡"}</span>
            <span className={item.complete ? "text-navy" : "text-amber-700"}>{item.label}</span>
          </p>
        ))}
      </CardBody>
    </Card>
  );
}
