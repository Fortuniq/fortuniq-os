/**
 * FortunIQ Fuels' own legal/registration/contact/banking/brand facts —
 * the "Company" half of every quotation/invoice snapshot (the other
 * half being the Customer). Static for now; VAT-related fields live
 * separately in Finance Settings (finance-settings.ts) because those
 * need to be editable by Super Admin/Finance without a code change —
 * see docs/FINANCE_MODULE.md, "Company Settings" section of the brief.
 *
 * KNOWN GAPS (flagged, not silently guessed): no logo IMAGE file is on
 * hand yet (only these text/colour facts) — PDF generation (Phase 4)
 * will use a text/colour treatment until a logo is supplied. Full
 * banking account number and branch code are not on file — only the
 * bank name, account type and account holder name below.
 */
export const COMPANY_INFO = {
  legalName: "FortunIQ Fuels (Pty) Ltd",
  tradingName: "FortunIQ Fuels",
  tagline: "Fortune in Every Drop.",
  registrationNumber: "2016/324403/07",
  petroleumWholesaleLicenceNumber: "W/2026/0032",
  sarsIncomeTaxReferenceNumber: "9718705164",
  csdNumber: "MAAA1683427",
  website: "www.iqfuels.co.za",
  email: "info@iqfuels.co.za",
  phone: "+27 12 004 8709",
  phoneAlt: "+27 87 265 1523",
  addresses: {
    registered: "1260 Block XX, Soshanguve East, Pretoria, 0152",
    riversands: "Riversands Incubation Hub, 8 Incubation Drive, Riverside View Ext 15, Fourways, Gauteng",
    pretoriaNorth: "570 Zelda Park Building, Gerrit Maritz Rd, Pretoria North, Gauteng",
  },
  banking: {
    bank: "ABSA Bank",
    accountType: "Current Account",
    accountHolder: "FORTUNIQ",
    // Not on file yet — Phase 4 PDF must omit these lines until supplied, never fabricate a placeholder number.
    accountNumber: null as string | null,
    branchCode: null as string | null,
  },
  brand: {
    ink: "#1C1B1C",
    orange: "#F05A28",
    bodyGrey: "#6E6E70",
    mutedGrey: "#9A9A9C",
    lightCard: "#F5F4F3",
    headlineFont: "Poppins",
    bodyFont: "Inter",
    hasLogoAsset: false, // flips to true once an actual logo image file is supplied and wired into the PDF template
  },
} as const;

export type CompanyInfo = typeof COMPANY_INFO;
