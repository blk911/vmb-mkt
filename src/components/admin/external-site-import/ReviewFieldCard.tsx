import type { ReactNode } from "react";

type ReviewFieldCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ReviewFieldCard({ title, description, children }: ReviewFieldCardProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-neutral-500">{description}</p> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
