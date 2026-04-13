"use client";

type SolaContainerSeedButtonProps = {
  busy?: boolean;
  onSeed: () => void;
};

export function SolaContainerSeedButton({ busy, onSeed }: SolaContainerSeedButtonProps) {
  return (
    <button
      type="button"
      onClick={onSeed}
      disabled={busy}
      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Seeding..." : "Seed Denver Sola"}
    </button>
  );
}
