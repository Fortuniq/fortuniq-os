"use client";

import { useState, useTransition } from "react";
import { Download, ExternalLink, CheckCircle2, AlertTriangle, Loader2, User, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import { acknowledgeDocumentAction } from "./profile-actions";
import type { EmployeeProfile } from "@/lib/data";
import type { EmploymentFileDocument } from "@/lib/employee-documents";
import type { ComplianceItem } from "@/lib/compliance-status-core";

export function ProfileView({
  profile, employmentFile, complianceStatus,
}: { profile: EmployeeProfile; employmentFile: EmploymentFileDocument[]; complianceStatus: ComplianceItem[] }) {
  return (
    <div>
      <PageHeader title="My Profile" description="Your own employment information, documents, and compliance status." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <MyInformationCard profile={profile} />
          <ContactCard profile={profile} />
          <MyEmploymentFileCard documents={employmentFile} />
          <SkillsCertificationsCard profile={profile} />
        </div>
        <div>
          <ComplianceStatusCard items={complianceStatus} />
        </div>
      </div>
    </div>
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
