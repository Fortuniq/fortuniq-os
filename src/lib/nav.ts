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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Company-wide overview" },
  { label: "People", href: "/people", icon: Users, description: "Employees & interns" },
  { label: "Academy", href: "/academy", icon: GraduationCap, description: "Training & onboarding" },
  { label: "Documents", href: "/documents", icon: FolderOpen, description: "Policies, SOPs & licences" },
  { label: "Tenders", href: "/tenders", icon: ClipboardList, description: "Tender register & compliance" },
  { label: "Finance", href: "/finance", icon: Wallet, description: "Invoices, expenses & budgets" },
  { label: "Operations", href: "/operations", icon: Truck, description: "Fuel orders & fleet" },
  { label: "Customers", href: "/customers", icon: UserSquare2, description: "Client accounts" },
  { label: "Sales", href: "/sales", icon: TrendingUp, description: "Pipeline, quotes & follow-ups" },
  { label: "Reports", href: "/reports", icon: BarChart3, description: "Analytics across the business" },
  { label: "AI Assistant", href: "/ai", icon: Sparkles, description: "Ask FortunIQ AI anything" },
  { label: "Settings", href: "/settings", icon: Settings, description: "Org, users & integrations" },
];
