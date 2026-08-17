export function formatZAR(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Full-precision Rand formatting — always shows cents (two decimal
 * places) with thousands separators, e.g. R387,958.00 / R458.65 /
 * R125,000,000.50. Used anywhere the exact stored tender/quotation value
 * matters (form previews, detail pages, financial reporting) — never
 * rounds or truncates. See docs/TENDER_VALUE.md.
 */
export function formatZARFull(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatZARCompact(value: number): string {
  if (value >= 1_000_000) return `R${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R${(value / 1_000).toFixed(0)}K`;
  return formatZAR(value);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
