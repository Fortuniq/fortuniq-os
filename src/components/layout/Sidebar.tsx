"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { NAV_ITEMS } from "@/lib/nav";
import { hasModuleAccess, type UserPermissions } from "@/lib/permissions";

export function Sidebar({ permissions }: { permissions?: UserPermissions }) {
  const pathname = usePathname();

  const visibleItems = permissions
    ? NAV_ITEMS.filter((item) => hasModuleAccess(permissions, item.key))
    : NAV_ITEMS;

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-white">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
        <Image src="/brand/logo-icon.png" alt="FortunIQ" width={26} height={24} />
        <div>
          <p className="font-display font-black text-sm text-navy leading-tight">
            FortunIQ <span className="text-orange">OS</span>
          </p>
          <p className="text-[10px] text-light-grey leading-tight tracking-wide">INTERNAL PLATFORM</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                active
                  ? "bg-navy text-white"
                  : "text-navy/80 hover:bg-surface"
              )}
            >
              <Icon
                className={clsx(
                  "w-[18px] h-[18px] shrink-0",
                  active ? "text-orange" : "text-grey group-hover:text-orange"
                )}
                strokeWidth={2}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {permissions?.isAdmin && (
        <div className="px-3 pb-2">
          <span className="text-[10px] font-semibold text-orange bg-orange/10 px-2 py-1 rounded-full">
            ADMIN
          </span>
        </div>
      )}

      <div className="p-3 border-t border-border">
        <div className="rounded-lg bg-surface p-3">
          <p className="text-[11px] font-semibold text-navy">B-BBEE Level 1 Certified</p>
          <p className="text-[10px] text-light-grey mt-0.5">FortunIQ Fuels (Pty) Ltd</p>
        </div>
      </div>
    </aside>
  );
}
