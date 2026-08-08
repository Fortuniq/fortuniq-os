"use client";

import { FileText, Download, History, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/format";

type Doc = {
  id: string | number;
  name: string;
  category: string;
  version: string;
  owner: string;
  updated: string;
};

const categoryTone: Record<string, "orange" | "info" | "success" | "warning" | "neutral"> = {
  Policy: "info",
  Legal: "neutral",
  Brand: "orange",
  Certificate: "success",
  Licence: "success",
  Tax: "warning",
  Insurance: "warning",
  SOP: "info",
  "Company Profile": "neutral",
};

const columns: Column<Doc>[] = [
  {
    key: "name",
    header: "Document",
    render: (r) => (
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-orange shrink-0" />
        <span className="font-medium">{r.name}</span>
      </div>
    ),
  },
  { key: "category", header: "Category", render: (r) => <Badge tone={categoryTone[r.category] ?? "neutral"}>{r.category}</Badge> },
  { key: "version", header: "Version" },
  { key: "owner", header: "Owner" },
  { key: "updated", header: "Last Updated", render: (r) => formatDate(r.updated) },
  {
    key: "actions",
    header: "",
    align: "right",
    render: () => (
      <div className="flex items-center gap-2 justify-end">
        <button className="p-1.5 rounded hover:bg-surface text-grey hover:text-orange transition-colors" title="Version history">
          <History className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-surface text-grey hover:text-orange transition-colors" title="Download">
          <Download className="w-4 h-4" />
        </button>
      </div>
    ),
  },
];

const categories = ["All", "Policy", "SOP", "Legal", "Brand", "Certificate", "Licence", "Tax", "Insurance"];

export function DocumentsView({ documents }: { documents: Doc[] }) {
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Policies, SOPs, templates, certificates, licences and company records — all version-controlled."
        action={
          <div className="relative">
            <Search className="w-4 h-4 text-light-grey absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search documents…"
              className="pl-9 pr-4 py-2 rounded-lg bg-white border border-border text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((c) => (
          <button
            key={c}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              c === "All" ? "bg-navy text-white border-navy" : "border-border text-grey hover:border-orange hover:text-orange"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="pt-5">
          <DataTable columns={columns} data={documents} />
        </CardBody>
      </Card>
    </div>
  );
}
