"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdminWorkspacePath, workspaceSection } from "@/lib/admin/workspace-nav";

export default function PipelineNav({ member = false }: { member?: boolean }) {
  const path = usePathname() || "";
  if (!member && !isAdminWorkspacePath(path) && !path.startsWith("/dashboard")) return null;
  if (path.endsWith("/print")) return null;
  const activeSection = workspaceSection(path);
  const items = member ? [
    { section: "prospects", label: "Prospects", href: "/dashboard/targets" },
    { section: "lists", label: "My lists", href: "/dashboard/lists" },
  ] : [
    { section: "prospects", label: "Prospects", href: "/admin/prospects" },
    { section: "lists", label: "My lists", href: "/admin/lists" },
    { section: "sources", label: "Sources", href: "/admin/sources" },
  ];

  return (
    <nav aria-label={member ? "Prospect workspace" : "Admin workspace"} className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={activeSection === item.section ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${activeSection === item.section ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
            {item.label}
          </Link>
        ))}
        {!member ? (
          <Link href="/admin/tools" aria-current={activeSection === "tools" ? "page" : undefined}
            className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium ${activeSection === "tools" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
            Admin tools
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
