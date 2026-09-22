/**
 * Pure logic for the customizable Employee Dashboard ("My Workspace" —
 * Project ORION Phase 1). Zero DB/Next dependencies, mirrors the
 * pure-logic-first pattern used elsewhere (e.g. finance-core.ts).
 *
 * DELIBERATELY EXCLUDED from this system: the Clock In / Attendance
 * widget and the "My Calendar / Upcoming" preview next to it. The
 * brief is explicit that Attendance "must remain exactly where it is
 * ... do not move it ... do not redesign its position", and Calendar is
 * getting a full interactive redesign in a later ORION phase anyway —
 * wiring today's throwaway preview card into a general-purpose
 * customization framework would be wasted work. Both stay hand-coded,
 * untouched, at the top of dashboard-view.tsx, outside everything
 * below. Only the "personal productivity" widgets underneath them
 * (Tasks, Workflow, Attendance History, Document Expiry, HCM Reminders,
 * Tender Tasks, Fuel Prices for non-broad-visibility users) are
 * customizable — matching the brief's own framing that customisation is
 * about "personal productivity," not organisation-wide reporting
 * (module cards / Organisation Overview also stay outside this system
 * for the same reason).
 */

export type DashboardWidgetKey =
  | "myTasks"
  | "myWorkflow"
  | "attendanceHistory"
  | "documentExpiry"
  | "hcmReminders"
  | "myTenderTasks"
  | "fuelPrices"
  | "marketNews";

export const ALL_DASHBOARD_WIDGET_KEYS: DashboardWidgetKey[] = [
  "myTasks", "myWorkflow", "attendanceHistory", "documentExpiry", "hcmReminders", "myTenderTasks", "fuelPrices", "marketNews",
];

function isDashboardWidgetKey(value: unknown): value is DashboardWidgetKey {
  return typeof value === "string" && (ALL_DASHBOARD_WIDGET_KEYS as string[]).includes(value);
}

/**
 * "compact" spans 1 of 3 columns at the widest breakpoint, "standard"
 * spans 1 of 2 (roughly half-width), "wide" always spans the full row.
 * Rendered by the view layer — this file only carries the decision.
 */
export type DashboardWidgetSize = "compact" | "standard" | "wide";

const VALID_SIZES: DashboardWidgetSize[] = ["compact", "standard", "wide"];

function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return typeof value === "string" && (VALID_SIZES as string[]).includes(value);
}

export interface DashboardWidgetDefinition {
  key: DashboardWidgetKey;
  label: string;
  defaultVisible: boolean;
  defaultSize: DashboardWidgetSize;
  /** Registry order — the fallback ordering for a layout that hasn't been customized, and for a widget the person's saved layout doesn't mention yet (a newly added widget, or one that just became available to them). */
  defaultOrder: number;
}

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetDefinition[] = [
  { key: "myTasks", label: "My Tasks", defaultVisible: true, defaultSize: "standard", defaultOrder: 0 },
  { key: "myWorkflow", label: "My Workflow", defaultVisible: true, defaultSize: "standard", defaultOrder: 1 },
  { key: "attendanceHistory", label: "My Attendance", defaultVisible: true, defaultSize: "standard", defaultOrder: 2 },
  { key: "documentExpiry", label: "Document Expiry", defaultVisible: true, defaultSize: "standard", defaultOrder: 3 },
  { key: "hcmReminders", label: "Reminders", defaultVisible: true, defaultSize: "standard", defaultOrder: 4 },
  { key: "myTenderTasks", label: "My Tender Tasks", defaultVisible: true, defaultSize: "standard", defaultOrder: 5 },
  { key: "fuelPrices", label: "Live Fuel Prices", defaultVisible: true, defaultSize: "standard", defaultOrder: 6 },
  // "wide" by default — news cards read better at full width, and this
  // is the widget most likely to carry the daily SA petroleum briefing
  // everyone's expected to actually read (Project ORION Phase 2).
  { key: "marketNews", label: "Market News", defaultVisible: true, defaultSize: "wide", defaultOrder: 7 },
];

const REGISTRY_BY_KEY = new Map(DASHBOARD_WIDGET_REGISTRY.map((w) => [w.key, w]));

export interface DashboardWidgetLayoutEntry {
  key: DashboardWidgetKey;
  visible: boolean;
  size: DashboardWidgetSize;
  order: number;
}

/** Shape of one entry as it might arrive from the client (a save request) or from a stored jsonb column — never trusted as-is. */
export type RawLayoutEntry = { key?: unknown; visible?: unknown; size?: unknown; order?: unknown };

/**
 * The single source of truth for turning (a) what's actually available
 * to render this widget for THIS user, right now, and (b) whatever they
 * last saved (if anything) into the ordered, sanitized layout the view
 * renders. Used both when reading a saved layout for display AND when
 * sanitizing a save request server-side — the same function, so display
 * and persistence can never drift apart.
 *
 * Guarantees, regardless of what `saved` contains:
 * - Only keys in `availableKeys` are returned (a widget with nothing to
 *   show, or one this user's role/module access doesn't extend to
 *   right now, never appears — see the "available" computation in
 *   dashboard-view.tsx for why a widget might not be available).
 * - Every available key appears exactly once (no duplicates, nothing
 *   silently dropped just because it wasn't in a stale saved layout —
 *   a newly available widget is appended at the end).
 * - `order` is always a clean, gapless 0..n-1 sequence.
 * - An invalid/missing `size` or `visible` falls back to that widget's
 *   registry default rather than being dropped.
 */
export function mergeDashboardLayout(
  availableKeys: DashboardWidgetKey[],
  saved: RawLayoutEntry[] | null | undefined
): DashboardWidgetLayoutEntry[] {
  const availableSet = new Set(availableKeys);
  const savedByKey = new Map<DashboardWidgetKey, RawLayoutEntry>();
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      if (isDashboardWidgetKey(entry?.key) && availableSet.has(entry.key) && !savedByKey.has(entry.key)) {
        savedByKey.set(entry.key, entry);
      }
    }
  }

  // Keys the person has a saved position for, in their saved order;
  // then any newly-available keys they've never seen, in registry order.
  const savedOrderedKeys = [...savedByKey.keys()].sort((a, b) => {
    const orderA = typeof savedByKey.get(a)?.order === "number" ? (savedByKey.get(a)!.order as number) : 0;
    const orderB = typeof savedByKey.get(b)?.order === "number" ? (savedByKey.get(b)!.order as number) : 0;
    return orderA - orderB;
  });
  const newKeys = availableKeys
    .filter((k) => !savedByKey.has(k))
    .sort((a, b) => (REGISTRY_BY_KEY.get(a)?.defaultOrder ?? 0) - (REGISTRY_BY_KEY.get(b)?.defaultOrder ?? 0));

  const finalKeyOrder = [...savedOrderedKeys, ...newKeys];

  return finalKeyOrder.map((key, index) => {
    const def = REGISTRY_BY_KEY.get(key)!;
    const savedEntry = savedByKey.get(key);
    const visible = typeof savedEntry?.visible === "boolean" ? savedEntry.visible : def.defaultVisible;
    const size = isDashboardWidgetSize(savedEntry?.size) ? savedEntry.size : def.defaultSize;
    return { key, visible, size, order: index };
  });
}

/**
 * Sanitizes a layout the client is asking to SAVE — same rules as
 * mergeDashboardLayout (it IS mergeDashboardLayout; a save is just "the
 * client's proposed layout" treated as the saved layout, filtered down
 * to what's actually available to them). Never trusts the client for
 * widget keys, sizes, visibility, or order beyond what's valid.
 */
export function sanitizeDashboardLayoutForSave(
  availableKeys: DashboardWidgetKey[],
  proposed: unknown
): DashboardWidgetLayoutEntry[] {
  const proposedArray = Array.isArray(proposed) ? (proposed as RawLayoutEntry[]) : [];
  return mergeDashboardLayout(availableKeys, proposedArray);
}

/** The default layout for someone who has never customized anything — registry order, registry defaults. */
export function defaultDashboardLayout(availableKeys: DashboardWidgetKey[]): DashboardWidgetLayoutEntry[] {
  return mergeDashboardLayout(availableKeys, null);
}
