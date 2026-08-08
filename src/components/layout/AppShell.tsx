"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <TopBar />
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
