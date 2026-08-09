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
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  if (!supabaseConfigured) return mock.documents;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("documents").select("*").order("updated_at", { ascending: false });
    if (error || !data || data.length === 0) return mock.documents;
    return data.map((d, i) => ({ id: i + 1, name: d.name, category: d.category, version: d.version, updated: d.updated_at, owner: d.owner }));
  } catch {
    return mock.documents;
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
