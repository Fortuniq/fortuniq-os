"use client";

import { Search, Bell, ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { notifications } from "@/lib/mock-data";
import { signOutAction } from "@/app/actions";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | undefined;

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TopBar({ user }: { user?: SessionUser }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="h-16 border-b border-border bg-white/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6 gap-4">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-light-grey absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customers, tenders, invoices…"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-sm text-navy placeholder:text-light-grey focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowNotifs((s) => !s)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface transition-colors"
          >
            <Bell className="w-[18px] h-[18px] text-grey" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange" />
          </button>
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-border rounded-xl shadow-lg py-2 z-30">
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-grey">Notifications</p>
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-2.5 hover:bg-surface/60 transition-colors">
                  <p className="text-sm text-navy leading-snug">{n.text}</p>
                  <p className="text-xs text-light-grey mt-0.5">{n.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="relative">
          <button
            onClick={() => setShowMenu((s) => !s)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-surface transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold overflow-hidden">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={user.name ?? "User"} className="w-full h-full object-cover" />
              ) : (
                initials(user?.name)
              )}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-navy leading-tight">{user?.name ?? "Not signed in"}</p>
              <p className="text-[10px] text-light-grey leading-tight">
                {user ? "Signed in via Microsoft" : ""}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-light-grey" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-lg py-2 z-30">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-sm font-semibold text-navy truncate">{user?.name}</p>
                <p className="text-xs text-light-grey truncate">{user?.email}</p>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy hover:bg-surface/60 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-grey" /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
