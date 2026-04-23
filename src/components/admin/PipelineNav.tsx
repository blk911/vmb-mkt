"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/admin" },
  { label: "Build", href: "/admin/build" },
  { label: "Review Queue", href: "/admin/validate" },
  { label: "Target", href: "/admin/target" },
  { label: "Activate", href: "/admin/activate" },
  { label: "Data", href: "/admin/data" },
];

export default function PipelineNav() {
  const path = usePathname();

  return (
    <div className="border-b bg-white p-4">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
        {items.map((item) => {
          const active = item.href === "/admin" ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                active ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
