type Props = {
  label: string;
  title?: string;
  variant?: "default" | "primary";
};

export default function ZoneBadge({ label, title, variant = "default" }: Props) {
  const cls =
    variant === "primary"
      ? "border-indigo-400 bg-indigo-50 text-indigo-950"
      : "border-neutral-300 bg-neutral-100 text-neutral-800";
  return (
    <span
      title={title ?? label}
      className={`inline-block max-w-[10rem] truncate rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-tight ${cls}`}
    >
      {label}
    </span>
  );
}
