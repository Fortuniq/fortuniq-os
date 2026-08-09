"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { UserPermissions } from "@/lib/permissions";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | undefined;

export function AppShell({
  children,
  user,
  permissions,
}: {
  children: React.ReactNode;
  user?: SessionUser;
  permissions?: UserPermissions;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar permissions={permissions} />
      <div className="flex-1 min-w-0">
        <TopBar user={user} />
        <main className="p-6 max-w-[1400px] mx-auto">{children}</main>
      </div>

      <Link
        href="/ai"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-navy text-white shadow-lg hover:bg-orange transition-colors flex items-center justify-center z-30"
        title="Ask FortunIQ AI"
      >
        <Sparkles className="w-6 h-6" />
      </Link>
    </div>
  );
}
