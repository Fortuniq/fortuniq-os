import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FolderOpen,
  ClipboardList,
  Wallet,
  Truck,
  UserSquare2,
  TrendingUp,
  BarChart3,
  Sparkles,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  key: ModuleKey;
  icon: LucideIcon;
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", key: "dashboard", icon: LayoutDashboard, description: "Company-wide overview" },
  { label: "People", href: "/people", key: "people", icon: Users, description: "Employees & interns" },
  { label: "Academy", href: "/academy", key: "academy", icon: GraduationCap, description: "Training & onboarding" },
  { label: "Documents", href: "/documents", key: "documents", icon: FolderOpen, description: "Policies, SOPs & licences" },
  { label: "Tenders", href: "/tenders", key: "tenders", icon: ClipboardList, description: "Tender register & compliance" },
  { label: "Finance", href: "/finance", key: "finance", icon: Wallet, description: "Invoices, expenses & budgets" },
  { label: "Operations", href: "/operations", key: "operations", icon: Truck, description: "Fuel orders & fleet" },
  { label: "Customers", href: "/customers", key: "customers", icon: UserSquare2, description: "Client accounts" },
  { label: "Sales", href: "/sales", key: "sales", icon: TrendingUp, description: "Pipeline, quotes & follow-ups" },
  { label: "Reports", href: "/reports", key: "reports", icon: BarChart3, description: "Analytics across the business" },
  { label: "AI Assistant", href: "/ai", key: "ai", icon: Sparkles, description: "Ask FortunIQ AI anything" },
  { label: "Audit Logs", href: "/audit", key: "audit", icon: ShieldCheck, description: "Who did what, and when" },
  { label: "Settings", href: "/settings", key: "settings", icon: Settings, description: "Org, users & integrations" },
];
