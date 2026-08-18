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
  Clock,
  UserCircle,
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
  // "dashboard" as the key deliberately, not "people" — My Profile is
  // available to every signed-in employee with dashboard access, same
  // as Dashboard itself, regardless of whether they have People/Employee
  // Hub module access. See docs/EMPLOYEE_SELF_SERVICE.md.
  { label: "My Profile", href: "/profile", key: "dashboard", icon: UserCircle, description: "Your own employment information & documents" },
  { label: "Employee Hub", href: "/people", key: "people", icon: Users, description: "Directory, profiles & personnel records" },
  { label: "Academy", href: "/academy", key: "academy", icon: GraduationCap, description: "Training & onboarding" },
  { label: "Documents", href: "/documents", key: "documents", icon: FolderOpen, description: "Policies, SOPs & licences" },
  { label: "Tenders", href: "/tenders", key: "tenders", icon: ClipboardList, description: "Tender register & compliance" },
  { label: "Finance", href: "/finance", key: "finance", icon: Wallet, description: "Invoices, expenses & budgets" },
  { label: "Operations", href: "/operations", key: "operations", icon: Truck, description: "Fuel orders & fleet" },
  { label: "Customers", href: "/customers", key: "customers", icon: UserSquare2, description: "Client accounts" },
  { label: "Sales", href: "/sales", key: "sales", icon: TrendingUp, description: "Pipeline, quotes & follow-ups" },
  { label: "Reports", href: "/reports", key: "reports", icon: BarChart3, description: "Analytics across the business" },
  { label: "FortunIQ Intelligence", href: "/ai", key: "ai", icon: Sparkles, description: "Ask FortunIQ Intelligence anything" },
  { label: "Audit Logs", href: "/audit", key: "audit", icon: ShieldCheck, description: "Who did what, and when" },
  { label: "Attendance", href: "/attendance", key: "attendance", icon: Clock, description: "Clock-in register, corrections & reporting" },
  { label: "Settings", href: "/settings", key: "settings", icon: Settings, description: "Org, users & integrations" },
];
