import { createClient } from "@/lib/supabase/server";
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
