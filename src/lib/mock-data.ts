// Centralized mock data layer.
// In production, every export here would be replaced by a Supabase query
// (see /docs/BACKEND.md for the schema this data model maps to).

export const fuelPrices = [
  { product: "Diesel 50ppm", price: 25.16, change: -3.59 },
  { product: "Petrol 95 (ULP)", price: 26.10, change: -1.96 },
  { product: "Petrol 93 (ULP)", price: 25.94, change: -2.01 },
  { product: "Illuminating Paraffin", price: 22.18, change: -6.97 },
];

export const dashboardStats = {
  todaysSales: { value: 486200, label: "Today's Sales", currency: "ZAR" },
  outstandingQuotes: { value: 12, label: "Outstanding Quotes", total: 1_840_000 },
  openTenders: { value: 4, label: "Open Tenders", closingSoon: 1 },
  employees: { value: 38, label: "Employees & Interns", onLeave: 2 },
};

export const tasks = [
  { id: 1, title: "Follow up with Kgomotso Logistics on Q-0412", due: "Today", priority: "High", owner: "Thabo M." },
  { id: 2, title: "Submit compliance docs — Tshwane Metro tender", due: "Tomorrow", priority: "High", owner: "Lerato N." },
  { id: 3, title: "Review Q3 supplier invoices", due: "This week", priority: "Medium", owner: "Sipho K." },
  { id: 4, title: "Onboard new intern — Operations", due: "This week", priority: "Medium", owner: "Jane M." },
  { id: 5, title: "Renew fleet insurance — 3 vehicles", due: "12 Aug", priority: "Low", owner: "Finance Team" },
];

export const notifications = [
  { id: 1, text: "New tender published: Gauteng Dept. of Health — bulk diesel supply", time: "2h ago", type: "tender" },
  { id: 2, text: "Invoice INV-2451 marked overdue (14 days)", time: "5h ago", type: "finance" },
  { id: 3, text: "Delivery POD confirmed — Riversands Depot, Load #8821", time: "Yesterday", type: "operations" },
  { id: 4, text: "3 employees completed \"POPIA Awareness\" course", time: "Yesterday", type: "academy" },
];

export const salesTrend = [
  { month: "Feb", sales: 3.1 },
  { month: "Mar", sales: 3.6 },
  { month: "Apr", sales: 3.3 },
  { month: "May", sales: 4.0 },
  { month: "Jun", sales: 4.4 },
  { month: "Jul", sales: 4.9 },
];

// ---------- People ----------
export const employees = [
  { id: 1, name: "Thabo Mokoena", role: "Chief Operations Officer", dept: "Operations", type: "Employee", status: "Active", start: "2019-03-01" },
  { id: 2, name: "Lerato Ndlovu", role: "Tender & Compliance Manager", dept: "Tenders", type: "Employee", status: "Active", start: "2021-06-14" },
  { id: 3, name: "Sipho Khumalo", role: "Financial Manager", dept: "Finance", type: "Employee", status: "Active", start: "2020-01-20" },
  { id: 4, name: "Jane Mokoena", role: "Fleet & Logistics Supervisor", dept: "Operations", type: "Employee", status: "Active", start: "2022-09-05" },
  { id: 5, name: "Katlego Dube", role: "Sales Executive", dept: "Sales", type: "Employee", status: "Active", start: "2023-02-11" },
  { id: 6, name: "Naledi Sithole", role: "Intern — Finance", dept: "Finance", type: "Intern", status: "Active", start: "2026-07-01" },
  { id: 7, name: "Mpho Radebe", role: "Intern — Operations", dept: "Operations", type: "Intern", status: "Onboarding", start: "2026-08-01" },
  { id: 8, name: "Zanele Mahlangu", role: "Intern — Marketing", dept: "Sales", type: "Intern", status: "Active", start: "2026-06-01" },
];

// ---------- Academy ----------
export const courses = [
  { id: 1, title: "FortunIQ Onboarding", category: "Onboarding", modules: 6, duration: "2h 10m", enrolled: 38, completion: 92 },
  { id: 2, title: "POPIA Awareness", category: "Compliance", modules: 4, duration: "1h 05m", enrolled: 38, completion: 78 },
  { id: 3, title: "Health & Safety at Depots", category: "Compliance", modules: 5, duration: "1h 40m", enrolled: 22, completion: 65 },
  { id: 4, title: "Consultative Selling for Fuel Accounts", category: "Sales", modules: 8, duration: "3h 20m", enrolled: 6, completion: 40 },
  { id: 5, title: "Tender Writing Fundamentals", category: "Tenders", modules: 5, duration: "2h 00m", enrolled: 4, completion: 55 },
  { id: 6, title: "AI Tools for Everyday Work", category: "General", modules: 3, duration: "0h 50m", enrolled: 30, completion: 34 },
];

export const learningPaths = [
  { id: 1, title: "New Intern Onboarding", courses: 4, forRole: "All interns" },
  { id: 2, title: "Sales Executive Path", courses: 5, forRole: "Sales" },
  { id: 3, title: "Depot & Fleet Safety Path", courses: 3, forRole: "Operations" },
  { id: 4, title: "Manager Essentials", courses: 4, forRole: "People Managers" },
];

// ---------- Documents ----------
export const documents = [
  { id: 1, name: "Employee & Intern Handbook", category: "Policy", version: "v1.0", updated: "2026-07-26", owner: "People" },
  { id: 2, name: "Advisory Board Confidentiality Agreement", category: "Legal", version: "v2.0", updated: "2026-07-16", owner: "Legal" },
  { id: 3, name: "Brand Identity Manual", category: "Brand", version: "v1.0", updated: "2026-07-16", owner: "Marketing" },
  { id: 4, name: "B-BBEE Certificate", category: "Certificate", version: "2026", updated: "2026-02-01", owner: "Compliance" },
  { id: 5, name: "Petroleum Wholesale Licence", category: "Licence", version: "W/2026/0032", updated: "2026-01-15", owner: "Compliance" },
  { id: 6, name: "Tax Clearance Certificate", category: "Tax", version: "2026", updated: "2026-03-10", owner: "Finance" },
  { id: 7, name: "Fleet Insurance Certificate", category: "Insurance", version: "2026", updated: "2026-04-01", owner: "Operations" },
  { id: 8, name: "SOP — Bulk Fuel Loading Procedure", category: "SOP", version: "v3.1", updated: "2026-05-20", owner: "Operations" },
  { id: 9, name: "Company Profile", category: "Company Profile", version: "v4.0", updated: "2026-06-01", owner: "Marketing" },
];

// ---------- Tenders ----------
export const tenders = [
  { id: 1, ref: "GDOH-2026-114", title: "Bulk Diesel Supply — Gauteng Dept. of Health", closing: "2026-08-20", status: "Open", stage: "Drafting response", value: 4_200_000, compliance: 80 },
  { id: 2, ref: "TSHW-2026-087", title: "Fuel Supply — Tshwane Metro Fleet", closing: "2026-08-12", status: "Open", stage: "Documents review", value: 2_900_000, compliance: 95 },
  { id: 3, ref: "SANRAL-2026-033", title: "Diesel Supply — Road Maintenance Depots", closing: "2026-09-05", status: "Open", stage: "Registered", value: 6_500_000, compliance: 40 },
  { id: 4, ref: "MINE-2026-021", title: "On-Site Fuel Supply — Rustenburg Mining Group", closing: "2026-08-30", status: "Open", stage: "AI review complete", value: 8_100_000, compliance: 88 },
  { id: 5, ref: "CPT-2025-210", title: "Municipal Fleet Fuel Contract", closing: "2025-11-15", status: "Awarded", stage: "Closed — Won", value: 3_400_000, compliance: 100 },
  { id: 6, ref: "AGRI-2025-198", title: "Seasonal Diesel Supply — Agri Co-op", closing: "2025-09-01", status: "Lost", stage: "Closed — Lost", value: 1_200_000, compliance: 100 },
];

export const tenderChecklist = [
  { item: "B-BBEE Certificate (valid)", done: true },
  { item: "Tax Clearance Certificate", done: true },
  { item: "Petroleum Wholesale Licence", done: true },
  { item: "Company Registration (CIPC)", done: true },
  { item: "Audited Financial Statements (2 years)", done: true },
  { item: "Proof of Fleet / Delivery Capacity", done: false },
  { item: "References — 3 similar contracts", done: false },
  { item: "Signed Declaration of Interest", done: false },
];

// ---------- Finance ----------
export const invoices = [
  { id: "INV-2451", customer: "Kgomotso Logistics", amount: 184_200, status: "Overdue", due: "2026-07-24" },
  { id: "INV-2452", customer: "Rustenburg Mining Group", amount: 512_000, status: "Paid", due: "2026-07-15" },
  { id: "INV-2453", customer: "Tshwane Metro", amount: 298_500, status: "Sent", due: "2026-08-10" },
  { id: "INV-2454", customer: "Agri Co-op Ltd", amount: 76_300, status: "Paid", due: "2026-07-20" },
  { id: "INV-2455", customer: "Vaal Transport Group", amount: 145_900, status: "Draft", due: "2026-08-18" },
];

export const expenses = [
  { id: 1, category: "Fleet Maintenance", amount: 62_400, date: "2026-07-28" },
  { id: 2, category: "Depot Rent — Fourways", amount: 48_000, date: "2026-07-01" },
  { id: 3, category: "Fuel Testing & Compliance", amount: 12_800, date: "2026-07-15" },
  { id: 4, category: "IT & Software Licences", amount: 9_600, date: "2026-07-05" },
];

export const suppliers = [
  { id: 1, name: "Sasol", category: "Refinery", terms: "30 days", status: "Active" },
  { id: 2, name: "Puma Energy", category: "Refinery", terms: "30 days", status: "Active" },
  { id: 3, name: "Engen", category: "Refinery", terms: "45 days", status: "Active" },
  { id: 4, name: "Volvo Trucks SA", category: "Fleet", terms: "60 days", status: "Active" },
];

// ---------- Operations ----------
export const fuelOrders = [
  { id: "FO-3301", customer: "Rustenburg Mining Group", product: "Diesel 50ppm", volume: 40_000, status: "Loading", eta: "Today, 14:00" },
  { id: "FO-3302", customer: "Tshwane Metro", product: "Diesel 50ppm", volume: 25_000, status: "In Transit", eta: "Today, 16:30" },
  { id: "FO-3303", customer: "Kgomotso Logistics", product: "ULP 95", volume: 10_000, status: "Delivered", eta: "Completed" },
  { id: "FO-3304", customer: "Agri Co-op Ltd", product: "Diesel 50ppm", volume: 18_000, status: "Scheduled", eta: "Tomorrow, 08:00" },
];

export const fleet = [
  { id: "FL-01", vehicle: "Volvo FH — Tanker A", capacity: "40,000L", driver: "S. Nkosi", status: "On Route" },
  { id: "FL-02", vehicle: "Volvo FH — Tanker B", capacity: "40,000L", driver: "P. Mahlangu", status: "Loading" },
  { id: "FL-03", vehicle: "Scania — Tanker C", capacity: "30,000L", driver: "T. Zulu", status: "Available" },
  { id: "FL-04", vehicle: "Scania — Tanker D", capacity: "30,000L", driver: "—", status: "Maintenance" },
];

// ---------- Customers ----------
export const customers = [
  { id: 1, name: "Rustenburg Mining Group", industry: "Mining", accountValue: 8_100_000, status: "Active", contact: "M. van der Merwe" },
  { id: 2, name: "Tshwane Metro", industry: "Government", accountValue: 2_900_000, status: "Active", contact: "N. Mokgatle" },
  { id: 3, name: "Kgomotso Logistics", industry: "Logistics", accountValue: 1_840_000, status: "Active", contact: "K. Sebeko" },
  { id: 4, name: "Agri Co-op Ltd", industry: "Agriculture", accountValue: 620_000, status: "Active", contact: "J. Botha" },
  { id: 5, name: "Vaal Transport Group", industry: "Logistics", accountValue: 410_000, status: "Prospect", contact: "R. Naidoo" },
];

// ---------- Sales ----------
export const quotes = [
  { id: "Q-0410", customer: "Vaal Transport Group", value: 410_000, stage: "Sent", owner: "Katlego D." },
  { id: "Q-0411", customer: "Rustenburg Mining Group", value: 1_200_000, stage: "Negotiation", owner: "Katlego D." },
  { id: "Q-0412", customer: "Kgomotso Logistics", value: 230_000, stage: "Sent", owner: "Thabo M." },
  { id: "Q-0413", customer: "New Prospect — Free State Grain", value: 890_000, stage: "Draft", owner: "Katlego D." },
];

export const pipeline = [
  { stage: "Lead", count: 8, value: 3_100_000 },
  { stage: "Qualified", count: 5, value: 2_400_000 },
  { stage: "Proposal", count: 4, value: 2_730_000 },
  { stage: "Negotiation", count: 2, value: 1_600_000 },
  { stage: "Won", count: 3, value: 4_540_000 },
];

// ---------- Reports ----------
export const revenueByProduct = [
  { product: "Diesel 50ppm", revenue: 18.4 },
  { product: "ULP 95", revenue: 6.2 },
  { product: "ULP 93", revenue: 5.1 },
  { product: "Paraffin", revenue: 1.8 },
];
