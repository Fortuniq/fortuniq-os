"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, CheckCircle2, XCircle, Download } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatZARFull, formatDate } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/invoices-data";
import { issueInvoice, cancelInvoice } from "../invoice-actions";

export function InvoiceDetailView({
  invoice,
  canEdit,
  canIssue,
}: {
  invoice: InvoiceDetail;
  canEdit: boolean;
  canIssue: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPreIssue = invoice.status === "Draft";
  const outstanding = Math.max(0, invoice.total - invoice.paidAmount);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) { setError(result.error); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber ?? "Draft Invoice"}
        description={`${invoice.customerName} — Revision ${invoice.revisionNumber}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
          </div>
        }
      />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        <a
          href={`/api/finance/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-semibold text-navy bg-white border border-border px-3.5 py-2 rounded-lg hover:bg-surface"
        >
          <Download className="w-4 h-4" /> {isPreIssue ? "Preview PDF" : "Download PDF"}
        </a>
        {isPreIssue && canEdit && (
          <Link href={`/finance/invoices/${invoice.id}/edit`} className="flex items-center gap-1.5 text-sm font-semibold text-navy bg-white border border-border px-3.5 py-2 rounded-lg hover:bg-surface">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
        )}
        {invoice.status === "Draft" && canIssue && (
          <button disabled={isPending} onClick={() => run(() => issueInvoice(invoice.id))} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 px-3.5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> Issue &amp; Send
          </button>
        )}
        {invoice.status !== "Cancelled" && invoice.paidAmount === 0 && canEdit && (
          <button disabled={isPending} onClick={() => run(() => cancelInvoice(invoice.id))} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-white border border-border px-3.5 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50">
            <XCircle className="w-4 h-4" /> Cancel Invoice
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
                    {invoice.lineItems.map((li) => (
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
                  <div className="flex justify-between"><span className="text-grey">Subtotal</span><span>{formatZARFull(invoice.subtotal)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-grey">VAT{invoice.vatApplied ? ` (${invoice.vatRate}%)` : ""}</span>
                    <span>{invoice.vatApplied ? formatZARFull(invoice.vatAmount) : "Not Applicable"}</span>
                  </div>
                  <div className="flex justify-between font-bold text-navy text-base pt-1 border-t border-border"><span>Grand Total</span><span>{formatZARFull(invoice.total)}</span></div>
                  {!isPreIssue && (
                    <>
                      <div className="flex justify-between pt-1"><span className="text-grey">Paid</span><span>{formatZARFull(invoice.paidAmount)}</span></div>
                      <div className="flex justify-between font-semibold"><span className="text-grey">Balance Due</span><span className={outstanding > 0 ? "text-orange" : "text-emerald-600"}>{formatZARFull(outstanding)}</span></div>
                    </>
                  )}
                </div>
              </div>

              {!invoice.vatApplied && (
                <p className="text-[11px] text-light-grey mt-3 border-t border-border pt-3">
                  FortunIQ Fuels (Pty) Ltd is currently not registered as a Value-Added Tax (VAT) vendor. Accordingly, no VAT has been charged or included in this invoice.
                </p>
              )}
            </CardBody>
          </Card>

          {(invoice.terms || invoice.notes) && (
            <Card>
              <CardBody className="pt-5 space-y-3">
                {invoice.terms && <div><p className="text-xs font-medium text-grey mb-1">Terms</p><p className="text-sm">{invoice.terms}</p></div>}
                {invoice.notes && <div><p className="text-xs font-medium text-grey mb-1">Notes</p><p className="text-sm">{invoice.notes}</p></div>}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="pt-5 space-y-2 text-sm">
              <p className="text-sm font-semibold text-navy mb-1">Summary</p>
              <SummaryRow label="Customer" value={invoice.customerName} />
              <SummaryRow label="Created By" value={invoice.createdByName ?? "—"} />
              <SummaryRow label="Issue Date" value={invoice.issueDate ? formatDate(invoice.issueDate) : "Not yet issued"} />
              <SummaryRow label="Due Date" value={invoice.dueDate ? formatDate(invoice.dueDate) : "—"} />
              {invoice.approvedByName && <SummaryRow label="Issued By" value={invoice.approvedByName} />}
              {invoice.parentInvoiceId && (
                <div className="pt-2 border-t border-border">
                  <Link href={`/finance/invoices/${invoice.parentInvoiceId}`} className="text-xs text-navy hover:underline">View original invoice</Link>
                </div>
              )}
            </CardBody>
          </Card>

          {isPreIssue && (
            <Card>
              <CardBody className="pt-5">
                <p className="text-xs text-light-grey">
                  This invoice is still a draft — it uses live customer/company data and has no document number yet. A permanent INV-YYYY-XXXX number and an immutable record of everything shown here are created the moment it&apos;s issued.
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
