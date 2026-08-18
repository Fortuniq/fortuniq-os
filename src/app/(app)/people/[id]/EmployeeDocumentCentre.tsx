"use client";

import { useState, useTransition } from "react";
import { FileText, Plus, X, Paperclip } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { uploadEmployeeDocument, setEmployeeDocumentVisibility } from "../employee-actions";
import { DocumentLinkModal } from "../../documents/DocumentLinkModal";
import { VersionHistoryModal } from "../../documents/VersionHistoryModal";

type EmployeeDoc = {
  id: string;
  name: string;
  category: string;
  version: string;
  status: string;
  visibility: string;
  acknowledgementRequired: boolean;
  sharepointItemId: string | null;
  sharepointWebUrl: string | null;
  updated: string;
};

const CATEGORIES = [
  "Employment Contract", "Employee Handbook", "NDA", "POPIA Acknowledgement", "Code of Conduct",
  "Offer Letter", "Promotion Letter", "Salary Adjustment Letter", "Performance Review",
  "Training Certificate", "Qualification", "Other",
];

const VISIBILITY_OPTIONS = ["Employee Visible", "Manager Visible", "HR Restricted", "Finance Restricted", "Super Admin Only"];

export function EmployeeDocumentCentre({ employeeId, documents }: { employeeId: string; documents: EmployeeDoc[] }) {
  const [showUpload, setShowUpload] = useState(false);
  const [linkModalDoc, setLinkModalDoc] = useState<EmployeeDoc | null>(null);
  const [versionsDoc, setVersionsDoc] = useState<EmployeeDoc | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Centre</CardTitle>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Upload Document
        </button>
      </CardHeader>
      <CardBody className="space-y-1">
        {documents.length === 0 && <p className="text-sm text-light-grey py-2">No documents on file yet.</p>}
        {documents.map((d) => (
          <DocRow
            key={d.id}
            doc={d}
            onManageLink={() => setLinkModalDoc(d)}
            onViewVersions={() => setVersionsDoc(d)}
          />
        ))}
      </CardBody>

      {showUpload && <UploadDocumentModal employeeId={employeeId} onClose={() => setShowUpload(false)} />}

      {linkModalDoc && (
        <DocumentLinkModal
          doc={linkModalDoc}
          onClose={() => setLinkModalDoc(null)}
          onOpenVersions={() => { setVersionsDoc(linkModalDoc); setLinkModalDoc(null); }}
        />
      )}

      {versionsDoc && (
        <VersionHistoryModal
          documentId={versionsDoc.id}
          docName={versionsDoc.name}
          canRestore
          onClose={() => setVersionsDoc(null)}
        />
      )}
    </Card>
  );
}

function DocRow({ doc, onManageLink, onViewVersions }: { doc: EmployeeDoc; onManageLink: () => void; onViewVersions: () => void }) {
  const [visibility, setVisibility] = useState(doc.visibility);
  const [ackRequired, setAckRequired] = useState(doc.acknowledgementRequired);
  const [isPending, startTransition] = useTransition();

  function save(nextVisibility: string, nextAck: boolean) {
    startTransition(async () => {
      const result = await setEmployeeDocumentVisibility(doc.id, nextVisibility as never, nextAck);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-orange shrink-0" />
          <span className="text-sm font-medium text-navy truncate">{doc.name}</span>
          <Badge tone="neutral">{doc.category}</Badge>
        </div>
        <button onClick={doc.sharepointItemId ? onManageLink : undefined} className="text-xs text-grey hover:text-orange flex items-center gap-1 shrink-0">
          <Paperclip className="w-3.5 h-3.5" /> {doc.version}
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={visibility}
          onChange={(e) => { setVisibility(e.target.value); save(e.target.value, ackRequired); }}
          disabled={isPending}
          className="text-xs border border-border rounded px-1.5 py-1"
        >
          {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-grey">
          <input
            type="checkbox" checked={ackRequired} disabled={isPending}
            onChange={(e) => { setAckRequired(e.target.checked); save(visibility, e.target.checked); }}
            className="w-3.5 h-3.5 accent-orange"
          />
          Acknowledgement Required
        </label>
        <span className="text-xs text-light-grey">Updated {formatDate(doc.updated)}</span>
        <button onClick={onViewVersions} className="text-xs text-grey hover:text-orange">History</button>
      </div>
    </div>
  );
}

function UploadDocumentModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [visibility, setVisibility] = useState("HR Restricted");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("employeeId", employeeId);
    formData.set("category", category);
    formData.set("visibility", visibility);
    if (!formData.get("name")) formData.set("name", category);
    startTransition(async () => {
      const result = await uploadEmployeeDocument(formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">Upload Document</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>
        <form action={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Document Name</label>
            <input
              name="name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={category}
              className="w-full text-sm px-3 py-2 rounded-lg border border-border"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
              {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <p className="text-[11px] text-light-grey mt-1">Only "Employee Visible" documents appear in the employee's own My Employment File.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" name="acknowledgementRequired" className="w-4 h-4 accent-orange" />
            Require employee acknowledgement
          </label>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">File</label>
            <input type="file" name="file" required className="w-full text-sm" />
            <p className="text-[11px] text-light-grey mt-1">Files up to 4MB are supported.</p>
          </div>
          <button type="submit" disabled={isPending} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>
    </div>
  );
}
