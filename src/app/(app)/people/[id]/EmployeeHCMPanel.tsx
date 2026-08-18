"use client";

import { useState, useTransition } from "react";
import { IdCard, Wallet, CalendarDays, TrendingUp, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatZARFull } from "@/lib/format";
import { maskIdNumber } from "@/lib/hcm-core";
import { updateIdentity, updateEmploymentExtra, updatePayroll } from "../employee-actions";
import { createPerformanceReviewAction, updateCareerDevelopmentAction } from "../performance-actions";
import { reviewLeaveRequestAction } from "../../profile/leave-actions";
import type { EmployeeProfile } from "@/lib/data";
import type { LeaveRequest } from "@/lib/leave";
import type { PerformanceReview } from "@/lib/performance";

export function EmployeeHCMPanel({
  profile, leaveRequests, performanceReviews, canEditIdentity, canEditPayroll, canManageThisEmployee, isHR,
}: {
  profile: EmployeeProfile;
  leaveRequests: LeaveRequest[];
  performanceReviews: PerformanceReview[];
  canEditIdentity: boolean;
  canEditPayroll: boolean;
  canManageThisEmployee: boolean;
  isHR: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {canEditIdentity && <IdentitySection profile={profile} />}
      {canEditIdentity && <EmploymentExtraSection profile={profile} />}
      {canEditPayroll && <PayrollSection profile={profile} />}
      {(isHR || canManageThisEmployee) && <LeaveSection employeeId={profile.id} requests={leaveRequests} canReview={isHR || canManageThisEmployee} />}
      {(isHR || canManageThisEmployee) && <PerformanceSection profile={profile} reviews={performanceReviews} canCreate={isHR || canManageThisEmployee} canEditCareerDev={isHR} />}
    </div>
  );
}

function IdentitySection({ profile }: { profile: EmployeeProfile }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const id = profile.identity;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateIdentity(profile.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-orange" /> Identity</span></CardTitle>
        {!editing && <button onClick={() => setEditing(true)} className="text-xs text-grey hover:text-orange flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
      </CardHeader>
      <CardBody>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!editing ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="SA ID Number" value={maskIdNumber(id.idNumber)} />
            <Field label="Passport Number" value={id.passportNumber ?? "—"} />
            <Field label="Date of Birth" value={id.dateOfBirth ? formatDate(id.dateOfBirth) : "—"} />
            <Field label="Nationality" value={id.nationality ?? "—"} />
            <Field label="Gender" value={id.gender ?? "—"} />
            <Field label="Driver's Licence" value={id.driversLicence ?? "—"} />
            <Field label="Work Permit" value={id.workPermit ?? "—"} />
            <Field label="Home Address" value={id.homeAddress ?? "—"} />
          </dl>
        ) : (
          <form action={handleSubmit} className="space-y-2">
            <TextInput name="idNumber" label="SA ID Number" defaultValue={id.idNumber} />
            <TextInput name="passportNumber" label="Passport Number" defaultValue={id.passportNumber} />
            <TextInput name="dateOfBirth" label="Date of Birth" type="date" defaultValue={id.dateOfBirth} />
            <TextInput name="nationality" label="Nationality" defaultValue={id.nationality} />
            <TextInput name="gender" label="Gender" defaultValue={id.gender} />
            <TextInput name="driversLicence" label="Driver's Licence" defaultValue={id.driversLicence} />
            <TextInput name="workPermit" label="Work Permit" defaultValue={id.workPermit} />
            <TextInput name="homeAddress" label="Home Address" defaultValue={id.homeAddress} />
            <FormButtons isPending={isPending} onCancel={() => setEditing(false)} />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function PayrollSection({ profile }: { profile: EmployeeProfile }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const p = profile.payroll;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePayroll(profile.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber-600" /> Payroll (Restricted)</span></CardTitle>
        {!editing && <button onClick={() => setEditing(true)} className="text-xs text-grey hover:text-orange flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
      </CardHeader>
      <CardBody>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!editing ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Salary" value={p.salary != null ? formatZARFull(p.salary) : "—"} />
            <Field label="Payroll Number" value={p.payrollNumber ?? "—"} />
            <Field label="UIF" value={p.uif ?? "—"} />
            <Field label="PAYE" value={p.paye ?? "—"} />
            <Field label="Medical Aid" value={p.medicalAid ?? "—"} />
            <Field label="Pension" value={p.pension ?? "—"} />
            <Field label="Bonus Eligibility" value={p.bonusEligibility ? "Eligible" : "Not eligible"} />
            <Field label="Leave Encashment" value={p.leaveEncashment != null ? formatZARFull(p.leaveEncashment) : "—"} />
            <Field label="Payroll Status" value={<Badge tone={p.payrollStatus === "Active" ? "success" : "warning"}>{p.payrollStatus ?? "—"}</Badge>} />
          </dl>
        ) : (
          <form action={handleSubmit} className="space-y-2">
            <TextInput name="salary" label="Salary (ZAR)" type="number" defaultValue={p.salary != null ? String(p.salary) : null} />
            <TextInput name="payrollNumber" label="Payroll Number" defaultValue={p.payrollNumber} />
            <TextInput name="uif" label="UIF" defaultValue={p.uif} />
            <TextInput name="paye" label="PAYE" defaultValue={p.paye} />
            <TextInput name="medicalAid" label="Medical Aid" defaultValue={p.medicalAid} />
            <TextInput name="pension" label="Pension" defaultValue={p.pension} />
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="bonusEligibility" defaultChecked={p.bonusEligibility} className="w-4 h-4 accent-orange" /> Bonus Eligibility
            </label>
            <TextInput name="leaveEncashment" label="Leave Encashment (ZAR)" type="number" defaultValue={p.leaveEncashment != null ? String(p.leaveEncashment) : null} />
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Payroll Status</label>
              <select name="payrollStatus" defaultValue={p.payrollStatus ?? "Active"} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Final Pay Processed">Final Pay Processed</option>
              </select>
            </div>
            <FormButtons isPending={isPending} onCancel={() => setEditing(false)} />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function EmploymentExtraSection({ profile }: { profile: EmployeeProfile }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ex = profile.employmentExtra;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateEmploymentExtra(profile.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment (Extra)</CardTitle>
        {!editing && <button onClick={() => setEditing(true)} className="text-xs text-grey hover:text-orange flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
      </CardHeader>
      <CardBody>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!editing ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Contract Type" value={ex.contractType ?? "—"} />
            <Field label="Notice Period" value={ex.noticePeriod ?? "—"} />
            <Field label="Probation End Date" value={ex.probationEndDate ? formatDate(ex.probationEndDate) : "—"} />
            <Field label="Payroll Cycle" value={ex.payrollCycle ?? "—"} />
            <Field label="Shift Pattern" value={ex.shiftPattern ?? "—"} />
          </dl>
        ) : (
          <form action={handleSubmit} className="space-y-2">
            <TextInput name="contractType" label="Contract Type" defaultValue={ex.contractType} />
            <TextInput name="noticePeriod" label="Notice Period" defaultValue={ex.noticePeriod} />
            <TextInput name="probationEndDate" label="Probation End Date" type="date" defaultValue={ex.probationEndDate} />
            <TextInput name="payrollCycle" label="Payroll Cycle" defaultValue={ex.payrollCycle} />
            <TextInput name="shiftPattern" label="Shift Pattern" defaultValue={ex.shiftPattern} />
            <FormButtons isPending={isPending} onCancel={() => setEditing(false)} />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

const LEAVE_STATUS_TONE: Record<string, "success" | "danger" | "neutral" | "warning"> = {
  Approved: "success", Rejected: "danger", Cancelled: "neutral", Pending: "warning",
};

function LeaveSection({ employeeId, requests, canReview }: { employeeId: string; requests: LeaveRequest[]; canReview: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);

  function act(requestId: string, decision: "Approved" | "Rejected") {
    setActingId(requestId);
    startTransition(async () => {
      const result = await reviewLeaveRequestAction(requestId, decision);
      setActingId(null);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle><span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-orange" /> Leave</span></CardTitle></CardHeader>
      <CardBody className="space-y-1">
        {requests.length === 0 && <p className="text-sm text-light-grey py-2">No leave requests on record.</p>}
        {requests.slice(0, 8).map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="min-w-0">
              <p className="text-sm text-navy">{r.leaveType} — {formatDate(r.startDate)} to {formatDate(r.endDate)}</p>
              <p className="text-xs text-light-grey">{r.workingDays} day{r.workingDays === 1 ? "" : "s"} · requested {formatDate(r.requestedAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={LEAVE_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
              {canReview && r.status === "Pending" && (
                <>
                  <button onClick={() => act(r.id, "Approved")} disabled={isPending && actingId === r.id} className="text-emerald-600 hover:text-emerald-800" title="Approve">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => act(r.id, "Rejected")} disabled={isPending && actingId === r.id} className="text-red-600 hover:text-red-800" title="Reject">
                    <XCircle className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function PerformanceSection({
  profile, reviews, canCreate, canEditCareerDev,
}: { profile: EmployeeProfile; reviews: PerformanceReview[]; canCreate: boolean; canEditCareerDev: boolean }) {
  const [showNewReview, setShowNewReview] = useState(false);
  const [editingCareer, setEditingCareer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const career = profile.careerDevelopment;

  function submitReview(formData: FormData) {
    setError(null);
    formData.set("employeeId", profile.id);
    startTransition(async () => {
      const result = await createPerformanceReviewAction(formData);
      if (result?.error) setError(result.error);
      else setShowNewReview(false);
    });
  }

  function submitCareer(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateCareerDevelopmentAction(profile.id, formData);
      if (result?.error) setError(result.error);
      else setEditingCareer(false);
    });
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-orange" /> Performance</span></CardTitle>
        {canCreate && <button onClick={() => setShowNewReview(true)} className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">New Review</button>}
      </CardHeader>
      <CardBody>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {showNewReview && (
          <form action={submitReview} className="border border-border rounded-lg p-3 mb-4 space-y-2">
            <TextInput name="reviewPeriod" label="Review Period (e.g. Q3 2026)" required />
            <TextInput name="overallRating" label="Overall Rating" />
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Manager Feedback</label>
              <textarea name="managerFeedback" rows={2} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="publish" className="w-4 h-4 accent-orange" /> Publish immediately (visible to employee)
            </label>
            <FormButtons isPending={isPending} onCancel={() => setShowNewReview(false)} submitLabel="Save Review" />
          </form>
        )}

        {reviews.length === 0 && <p className="text-sm text-light-grey py-1">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm text-navy font-medium">{r.reviewPeriod} {r.overallRating && `— ${r.overallRating}`}</p>
              <p className="text-xs text-light-grey">by {r.reviewerName ?? r.reviewerEmail} · {formatDate(r.createdAt)}</p>
            </div>
            <Badge tone={r.status === "Published" ? "success" : "neutral"}>{r.status}</Badge>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-navy">Career Development</p>
            {canEditCareerDev && !editingCareer && <button onClick={() => setEditingCareer(true)} className="text-xs text-grey hover:text-orange flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
          </div>
          {!editingCareer ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Training Goals" value={career?.trainingGoals?.join(", ") || "—"} />
              <Field label="Development Plans" value={career?.developmentPlans || "—"} />
              <Field label="Completed Programmes" value={career?.completedProgrammes?.join(", ") || "—"} />
              <Field label="Future Career Path" value={career?.futureCareerPath || "—"} />
              <Field label="Promotion Recommendations" value={career?.promotionRecommendations || "—"} />
            </dl>
          ) : (
            <form action={submitCareer} className="space-y-2">
              <TextInput name="trainingGoals" label="Training Goals (comma-separated)" defaultValue={career?.trainingGoals?.join(", ") ?? null} />
              <TextInput name="developmentPlans" label="Development Plans" defaultValue={career?.developmentPlans ?? null} />
              <TextInput name="completedProgrammes" label="Completed Programmes (comma-separated)" defaultValue={career?.completedProgrammes?.join(", ") ?? null} />
              <TextInput name="futureCareerPath" label="Future Career Path" defaultValue={career?.futureCareerPath ?? null} />
              <TextInput name="promotionRecommendations" label="Promotion Recommendations" defaultValue={career?.promotionRecommendations ?? null} />
              <FormButtons isPending={isPending} onCancel={() => setEditingCareer(false)} />
            </form>
          )}
        </div>
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

function TextInput({ name, label, defaultValue, type = "text", required }: { name: string; label: string; defaultValue?: string | null; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-grey block mb-1">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
    </div>
  );
}

function FormButtons({ isPending, onCancel, submitLabel = "Save" }: { isPending: boolean; onCancel: () => void; submitLabel?: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="text-sm text-grey px-3 py-1.5 rounded-lg hover:bg-surface transition-colors">Cancel</button>
      <button type="submit" disabled={isPending} className="text-sm font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
        {isPending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
