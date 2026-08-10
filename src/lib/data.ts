import { createServiceClient } from "@/lib/supabase/service";
import * as mock from "@/lib/mock-data";

/**
 * Data access layer for FortunIQ OS.
 *
 * Every function tries Supabase first. If Supabase isn't configured yet
 * (no NEXT_PUBLIC_SUPABASE_URL in .env.local) or the query fails, it falls
 * back to the mock data in mock-data.ts — so the app keeps working while
 * you're setting up the database, and pages don't need to change once
 * real data is connected.
 */

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function getEmployees() {
  if (!supabaseConfigured) return mock.employees;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("employees").select("*").order("start_date");
    if (error || !data || data.length === 0) return mock.employees;
    return data.map((e) => ({ id: e.id, name: e.name, role: e.role, dept: e.dept, type: e.type, status: e.status, start: e.start_date }));
  } catch {
    return mock.employees;
  }
}

// ---------- EMPLOYEE HUB ----------
export type EmployeeDirectoryEntry = {
  id: string;
  employeeNumber: string | null;
  name: string;
  preferredName: string | null;
  photoUrl: string | null;
  role: string;
  dept: string;
  officeLocation: string | null;
  managerName: string | null;
  status: string;
  employmentType: string | null;
  email: string | null;
};

function mockEmployeeDirectory(): EmployeeDirectoryEntry[] {
  return mock.employees.map((e) => ({
    id: String(e.id), employeeNumber: `EMP-${String(e.id).padStart(4, "0")}`, name: e.name,
    preferredName: null, photoUrl: null, role: e.role, dept: e.dept, officeLocation: null,
    managerName: null, status: e.status, employmentType: e.type === "Intern" ? "Intern" : "Full-Time", email: null,
  }));
}

export async function getEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  if (!supabaseConfigured) return mockEmployeeDirectory();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("employees").select("*").order("name");
    if (error || !data || data.length === 0) return mockEmployeeDirectory();
    const byId = new Map(data.map((e) => [e.id, e]));
    return data.map((e) => ({
      id: e.id,
      employeeNumber: e.employee_number,
      name: e.name,
      preferredName: e.preferred_name,
      photoUrl: e.photo_url,
      role: e.role,
      dept: e.dept,
      officeLocation: e.office_location,
      managerName: e.manager_id ? (byId.get(e.manager_id)?.name ?? null) : null,
      status: e.status,
      employmentType: e.employment_type,
      email: e.email,
    }));
  } catch {
    return mockEmployeeDirectory();
  }
}

export type EmployeeProfile = {
  id: string;
  employeeNumber: string | null;
  name: string;
  preferredName: string | null;
  photoUrl: string | null;
  role: string;
  dept: string;
  managerName: string | null;
  officeLocation: string | null;
  status: string;
  employmentType: string | null;
  startDate: string;
  probationStatus: string | null;
  email: string | null;
  phone: string | null;
  emergencyContact: { name?: string; relationship?: string; phone?: string } | null;
  nextOfKin: { name?: string; relationship?: string; phone?: string } | null;
  bankingDetails: { bank?: string; accountNumber?: string; branchCode?: string; accountType?: string } | null;
  taxNumber: string | null;
  skills: string[];
  performanceRating: string | null;
  leaveBalance: Record<string, number> | null;
  archived: boolean;
  equipment: { id: string; item: string; serialNumber: string | null; issuedDate: string; returnedDate: string | null; status: string }[];
  certifications: { id: string; name: string; issuedDate: string | null; expiryDate: string | null }[];
};

export async function getEmployeeProfile(id: string): Promise<EmployeeProfile | null> {
  if (!supabaseConfigured) {
    const mockEmp = mock.employees.find((e) => String(e.id) === id);
    if (!mockEmp) return null;
    return {
      id: String(mockEmp.id), employeeNumber: `EMP-${String(mockEmp.id).padStart(4, "0")}`,
      name: mockEmp.name, preferredName: null, photoUrl: null, role: mockEmp.role, dept: mockEmp.dept,
      managerName: null, officeLocation: "Head Office, Pretoria North", status: mockEmp.status,
      employmentType: mockEmp.type === "Intern" ? "Intern" : "Full-Time", startDate: mockEmp.start,
      probationStatus: mockEmp.status === "Onboarding" ? "In Probation" : "Confirmed",
      email: `${mockEmp.name.toLowerCase().replace(" ", ".")}@iqfuels.co.za`, phone: null,
      emergencyContact: null, nextOfKin: null, bankingDetails: null, taxNumber: null,
      skills: [], performanceRating: null,
      leaveBalance: { annual: 15, sick: 10, family_responsibility: 3 },
      archived: false, equipment: [], certifications: [],
    };
  }
  try {
    const supabase = createServiceClient();
    const { data: e, error } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("getEmployeeProfile: error fetching employee row:", error.message, error.details, error.hint);
      return null;
    }
    if (!e) {
      console.error("getEmployeeProfile: no employee found for id", id);
      return null;
    }

    let managerName: string | null = null;
    if (e.manager_id) {
      const { data: mgr } = await supabase.from("employees").select("name").eq("id", e.manager_id).maybeSingle();
      managerName = mgr?.name ?? null;
    }

    // Equipment and certifications are supplementary — if either query
    // fails (e.g. a table genuinely missing), the whole profile should
    // still load rather than disappearing entirely. Logged either way so
    // a real problem is still visible in Netlify's function logs.
    const [equipmentResult, certificationsResult] = await Promise.all([
      supabase.from("employee_equipment").select("*").eq("employee_id", id).order("issued_date", { ascending: false }),
      supabase.from("employee_certifications").select("*").eq("employee_id", id).order("issued_date", { ascending: false }),
    ]);
    if (equipmentResult.error) console.error("getEmployeeProfile: employee_equipment query error:", equipmentResult.error.message);
    if (certificationsResult.error) console.error("getEmployeeProfile: employee_certifications query error:", certificationsResult.error.message);
    const equipment = equipmentResult.data ?? [];
    const certifications = certificationsResult.data ?? [];

    return {
      id: e.id,
      employeeNumber: e.employee_number,
      name: e.name,
      preferredName: e.preferred_name,
      photoUrl: e.photo_url,
      role: e.role,
      dept: e.dept,
      managerName,
      officeLocation: e.office_location,
      status: e.status,
      employmentType: e.employment_type,
      startDate: e.start_date,
      probationStatus: e.probation_status,
      email: e.email,
      phone: e.phone,
      emergencyContact: e.emergency_contact,
      nextOfKin: e.next_of_kin,
      bankingDetails: e.banking_details,
      taxNumber: e.tax_number,
      skills: e.skills ?? [],
      performanceRating: e.performance_rating,
      leaveBalance: e.leave_balance,
      archived: !!e.archived,
      equipment: (equipment ?? []).map((eq) => ({
        id: eq.id, item: eq.item, serialNumber: eq.serial_number,
        issuedDate: eq.issued_date, returnedDate: eq.returned_date, status: eq.status,
      })),
      certifications: (certifications ?? []).map((c) => ({
        id: c.id, name: c.name, issuedDate: c.issued_date, expiryDate: c.expiry_date,
      })),
    };
  } catch (err) {
    console.error("getEmployeeProfile: unexpected error:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getCourses() {
  if (!supabaseConfigured) return mock.courses;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("courses").select("*");
    if (error || !data || data.length === 0) return mock.courses;
    return data.map((c, i) => ({ id: i + 1, title: c.title, category: c.category, modules: c.modules, duration: c.duration, enrolled: c.enrolled, completion: c.completion }));
  } catch {
    return mock.courses;
  }
}

export async function getLearningPaths() {
  if (!supabaseConfigured) return mock.learningPaths;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("learning_paths").select("*");
    if (error || !data || data.length === 0) return mock.learningPaths;
    return data.map((p, i) => ({ id: i + 1, title: p.title, courses: p.course_count, forRole: p.for_role }));
  } catch {
    return mock.learningPaths;
  }
}

export async function getDocuments() {
  const mockFallback = () => mock.documents.map((d) => ({
    ...d, status: "Approved", sharepointItemId: null, sharepointWebUrl: null,
    classification: "Internal" as const, authorizedRoles: [] as string[], authorizedEmails: [] as string[], aiExcluded: false,
  }));
  if (!supabaseConfigured) return mockFallback();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("documents").select("*").order("updated_at", { ascending: false });
    if (error || !data || data.length === 0) return mockFallback();
    return data.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      version: d.version,
      updated: d.updated_at,
      owner: d.owner,
      status: d.status ?? "Draft",
      sharepointItemId: d.sharepoint_item_id,
      sharepointWebUrl: d.sharepoint_web_url,
      classification: (d.classification ?? "Internal") as "General" | "Internal" | "Confidential" | "Highly Confidential",
      authorizedRoles: (d.authorized_roles ?? []) as string[],
      authorizedEmails: (d.authorized_emails ?? []) as string[],
      aiExcluded: !!d.ai_excluded,
    }));
  } catch {
    return mockFallback();
  }
}

export async function getTenders() {
  if (!supabaseConfigured) return mock.tenders;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("tenders").select("*").order("closing_date");
    if (error || !data || data.length === 0) return mock.tenders;
    return data.map((t, i) => ({ id: i + 1, ref: t.ref, title: t.title, closing: t.closing_date, status: t.status, stage: t.stage, value: Number(t.value), compliance: t.compliance }));
  } catch {
    return mock.tenders;
  }
}

export async function getTenderChecklist(tenderRef = "GDOH-2026-114") {
  if (!supabaseConfigured) return mock.tenderChecklist;
  try {
    const supabase = createServiceClient();
    const { data: tender } = await supabase.from("tenders").select("id").eq("ref", tenderRef).single();
    if (!tender) return mock.tenderChecklist;
    const { data, error } = await supabase.from("tender_checklist_items").select("*").eq("tender_id", tender.id);
    if (error || !data || data.length === 0) return mock.tenderChecklist;
    return data.map((c) => ({ item: c.item, done: c.done }));
  } catch {
    return mock.tenderChecklist;
  }
}

export async function getDashboardData() {
  if (!supabaseConfigured) {
    return {
      fuelPrices: mock.fuelPrices,
      tasks: mock.tasks,
      notifications: mock.notifications,
      salesTrend: mock.salesTrend,
      stats: mock.dashboardStats,
    };
  }
  try {
    const supabase = createServiceClient();
    const [fuelPricesRes, tasksRes, notifsRes] = await Promise.all([
      supabase.from("fuel_prices").select("*"),
      supabase.from("tasks").select("*").eq("done", false).order("created_at", { ascending: false }).limit(5),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    return {
      fuelPrices: fuelPricesRes.data && fuelPricesRes.data.length > 0
        ? fuelPricesRes.data.map((f) => ({ product: f.product, price: Number(f.price), change: Number(f.change) }))
        : mock.fuelPrices,
      tasks: tasksRes.data && tasksRes.data.length > 0
        ? tasksRes.data.map((t) => ({ id: t.id, title: t.title, due: t.due_label, priority: t.priority, owner: t.owner }))
        : mock.tasks,
      notifications: notifsRes.data && notifsRes.data.length > 0
        ? notifsRes.data.map((n) => ({ id: n.id, text: n.text, time: "Recently", type: n.type }))
        : mock.notifications,
      salesTrend: mock.salesTrend, // computed/aggregated data — wire to a view once real invoices exist
      stats: mock.dashboardStats, // computed from live tables once volume warrants materialized views
    };
  } catch {
    return {
      fuelPrices: mock.fuelPrices,
      tasks: mock.tasks,
      notifications: mock.notifications,
      salesTrend: mock.salesTrend,
      stats: mock.dashboardStats,
    };
  }
}

export const isSupabaseConfigured = supabaseConfigured;

// ---------- FINANCE ----------
export async function getInvoices() {
  if (!supabaseConfigured) return mock.invoices;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("invoices").select("*").order("due_date");
    if (error || !data || data.length === 0) return mock.invoices;
    return data.map((i) => ({ id: i.invoice_number, customer: i.customer, amount: Number(i.amount), status: i.status, due: i.due_date }));
  } catch {
    return mock.invoices;
  }
}

export async function getExpenses() {
  if (!supabaseConfigured) return mock.expenses;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (error || !data || data.length === 0) return mock.expenses;
    return data.map((e, i) => ({ id: i + 1, category: e.category, amount: Number(e.amount), date: e.expense_date }));
  } catch {
    return mock.expenses;
  }
}

export async function getSuppliers() {
  if (!supabaseConfigured) return mock.suppliers;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("suppliers").select("*");
    if (error || !data || data.length === 0) return mock.suppliers;
    return data.map((s, i) => ({ id: i + 1, name: s.name, category: s.category, terms: s.terms, status: s.status }));
  } catch {
    return mock.suppliers;
  }
}

// ---------- OPERATIONS ----------
export async function getFuelOrders() {
  if (!supabaseConfigured) return mock.fuelOrders;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("fuel_orders").select("*").order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return mock.fuelOrders;
    return data.map((o) => ({ id: o.order_number, customer: o.customer, product: o.product, volume: o.volume, status: o.status, eta: o.eta }));
  } catch {
    return mock.fuelOrders;
  }
}

export async function getFleet() {
  if (!supabaseConfigured) return mock.fleet;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("fleet").select("*");
    if (error || !data || data.length === 0) return mock.fleet;
    return data.map((f) => ({ id: f.vehicle_code, vehicle: f.vehicle, capacity: f.capacity, driver: f.driver ?? "—", status: f.status }));
  } catch {
    return mock.fleet;
  }
}

// ---------- CUSTOMERS ----------
export async function getCustomers() {
  if (!supabaseConfigured) return mock.customers;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("customers").select("*").order("account_value", { ascending: false });
    if (error || !data || data.length === 0) return mock.customers;
    return data.map((c, i) => ({ id: i + 1, name: c.name, industry: c.industry, accountValue: Number(c.account_value), status: c.status, contact: c.contact }));
  } catch {
    return mock.customers;
  }
}

// ---------- SALES ----------
export async function getQuotes() {
  if (!supabaseConfigured) return mock.quotes;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return mock.quotes;
    return data.map((q) => ({ id: q.quote_number, customer: q.customer, value: Number(q.value), stage: q.stage, owner: q.owner }));
  } catch {
    return mock.quotes;
  }
}

export async function getPipeline() {
  if (!supabaseConfigured) return mock.pipeline;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("pipeline_stages").select("*").order("stage_order");
    if (error || !data || data.length === 0) return mock.pipeline;
    return data.map((p) => ({ stage: p.stage, count: p.deal_count, value: Number(p.total_value) }));
  } catch {
    return mock.pipeline;
  }
}

// ---------- REPORTS ----------
export async function getRevenueByProduct() {
  if (!supabaseConfigured) return mock.revenueByProduct;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("fuel_orders").select("product, volume");
    if (error || !data || data.length === 0) return mock.revenueByProduct;
    // Rough revenue estimate from order volumes until real invoicing-by-product exists
    const totals: Record<string, number> = {};
    for (const row of data) {
      totals[row.product] = (totals[row.product] ?? 0) + Number(row.volume);
    }
    const entries = Object.entries(totals);
    if (entries.length === 0) return mock.revenueByProduct;
    return entries.map(([product, volume]) => ({ product, revenue: Math.round((volume / 1000) * 10) / 10 }));
  } catch {
    return mock.revenueByProduct;
  }
}
