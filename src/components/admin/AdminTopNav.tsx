"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_TOP_NAV, getAdminActiveSection } from "@/lib/admin/admin-nav";

// Some admin pages keep a domain-specific second-row nav, but this component
// establishes the shared global shell so operators always know the current admin section.
export function AdminTopNav() {
  const pathname = usePathname();
  const activeSection = getAdminActiveSection(pathname || "/admin");

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-6 py-4">
        {ADMIN_TOP_NAV.map((item) => {
          const active = item.key === "home" ? pathname === "/admin" : activeSection === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
