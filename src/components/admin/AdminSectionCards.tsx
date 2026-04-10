import Link from "next/link";
import type { AdminNavGroup } from "@/lib/admin/admin-nav";

type AdminSectionCardsProps = {
  groups: AdminNavGroup[];
};

export function AdminSectionCards({ groups }: AdminSectionCardsProps) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">{group.label}</h2>
            <p className="mt-1 text-sm text-neutral-600">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-neutral-900">{item.label} →</div>
                  {item.isBeta ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      beta
                    </span>
                  ) : null}
                </div>
                {item.description ? (
                  <div className="mt-2 text-sm text-neutral-500">{item.description}</div>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
