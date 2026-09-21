"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Send, CheckCircle2, FileEdit, Copy } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatZARFull, formatDate } from "@/lib/format";
import type { QuotationDetail } from "@/lib/quotations-data";
import { submitQuotationForApproval, approveQuotation, sendQuotation, reviseQuotation } from "../quotation-actions";

export function QuotationDetailView({
  quotation,
  canEdit,
  canApprove,
}: {
  quotation: QuotationDetail;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPreIssue = quotation.status === "Draft" || quotation.status === "Pending Approval";

  function run(action: () => Promise<{ error?: string; id?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) { setError(result.error); return; }
      if (result?.id) { router.push(`/finance/quotations/${result.id}`); }
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title={quotation.quotationNumber ?? "Draft Quotation"}
        description={`${quotation.customerName} — Revision ${quotation.revisionNumber}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(quotation.status)}>{quotation.status}</Badge>
          </div>
        }
      />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        {isPreIssue && canEdit && (
          <Link href={`/finance/quotations/${quotation.id}/edit`} className="flex items-center gap-1.5 text-sm font-semibold text-navy bg-white border border-border px-3.5 py-2 rounded-lg hover:bg-surface">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
        )}
        {quotation.status === "Draft" && canEdit && (
          <button disabled={isPending} onClick={() => run(() => submitQuotationForApproval(quotation.id))} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy px-3.5 py-2 rounded-lg hover:bg-orange disabled:opacity-50">
            <FileEdit className="w-4 h-4" /> Submit for Approval
          </button>
        )}
        {quotation.status === "Pending Approval" && canApprove && (
          <button disabled={isPending} onClick={() => run(() => approveQuotation(quotation.id))} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 px-3.5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> Approve &amp; Issue Number
          </button>
        )}
        {quotation.status === "Approved" && canEdit && (
          <button disabled={isPending} onClick={() => run(() => sendQuotation(quotation.id))} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy px-3.5 py-2 rounded-lg hover:bg-orange disabled:opacity-50">
            <Send className="w-4 h-4" /> Mark as Sent
          </button>
        )}
        {!isPreIssue && quotation.status !== "Revised" && canEdit && (
          <button disabled={isPending} onClick={() => run(() => reviseQuotation(quotation.id))} className="flex items-center gap-1.5 text-sm font-semibold text-navy bg-white border border-border px-3.5 py-2 rounded-lg hover:bg-surface">
            <Copy className="w-4 h-4" /> Create Revision
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardBody className="pt-5">
              <p className="text-sm font-semibold text-navy mb-3">Line Items</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-medium text-light-grey border-b border-border">
                      <th className="pb-2 pr-2">Product / Service</th>
                      <th className="pb-2 pr-2">Quantity</th>
                      <th className="pb-2 pr-2">Unit</th>
                      <th className="pb-2 pr-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.lineItems.map((li) => (
                      <tr key={li.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-navy">{li.productService}</p>
                          {li.description && <p className="text-xs text-grey">{li.description}</p>}
                        </td>
                        <td className="py-2 pr-2">{li.quantity.toLocaleString("en-ZA")}</td>
                        <td className="py-2 pr-2">{li.unit ?? "—"}</td>
                        <td className="py-2 pr-2 text-right">{formatZARFull(li.unitPrice)}</td>
                        <td className="py-2 text-right font-medium">{formatZARFull(li.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <div className="w-full max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-grey">Subtotal</span><span>{formatZARFull(quotation.subtotal)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-grey">VAT{quotation.vatApplied ? ` (${quotation.vatRate}%)` : ""}</span>
                    <span>{quotation.vatApplied ? formatZARFull(quotation.vatAmount) : "Not Applicable"}</span>
                  </div>
                  <div className="flex justify-between font-bold text-navy text-base pt-1 border-t border-border"><span>Grand Total</span><span>{formatZARFull(quotation.total)}</span></div>
                </div>
              </div>

              {!quotation.vatApplied && (
                <p className="text-[11px] text-light-grey mt-3 border-t border-border pt-3">
                  FortunIQ Fuels (Pty) Ltd is currently not registered as a Value-Added Tax (VAT) vendor. Accordingly, no VAT has been charged or included in this quotation.
                </p>
              )}
            </CardBody>
          </Card>

          {(quotation.terms || quotation.notes) && (
            <Card>
              <CardBody className="pt-5 space-y-3">
                {quotation.terms && <div><p className="text-xs font-medium text-grey mb-1">Terms</p><p className="text-sm">{quotation.terms}</p></div>}
                {quotation.notes && <div><p className="text-xs font-medium text-grey mb-1">Notes</p><p className="text-sm">{quotation.notes}</p></div>}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="pt-5 space-y-2 text-sm">
              <p className="text-sm font-semibold text-navy mb-1">Summary</p>
              <SummaryRow label="Customer" value={quotation.customerName} />
              <SummaryRow label="Created By" value={quotation.createdByName ?? "—"} />
              <SummaryRow label="Issue Date" value={quotation.issueDate ? formatDate(quotation.issueDate) : "Not yet issued"} />
              <SummaryRow label="Valid Until" value={quotation.validUntil ? formatDate(quotation.validUntil) : "—"} />
              {quotation.approvedByName && <SummaryRow label="Approved By" value={quotation.approvedByName} />}
              {quotation.sentAt && <SummaryRow label="Sent On" value={formatDate(quotation.sentAt)} />}
              {quotation.parentQuotationId && (
                <div className="pt-2 border-t border-border">
                  <Link href={`/finance/quotations/${quotation.parentQuotationId}`} className="text-xs text-navy hover:underline">View original quotation</Link>
                </div>
              )}
            </CardBody>
          </Card>

          {isPreIssue && (
            <Card>
              <CardBody className="pt-5">
                <p className="text-xs text-light-grey">
                  This quotation is still {quotation.status.toLowerCase()} — it uses live customer/company data and has no document number yet. A permanent FQ-YYYY-XXXX number and an immutable record of everything shown here are created the moment it&apos;s Approved.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-grey">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
