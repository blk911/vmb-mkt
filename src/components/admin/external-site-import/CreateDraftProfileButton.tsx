"use client";

type CreateDraftProfileButtonProps = {
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
};

export function CreateDraftProfileButton({ disabled, busy, onClick }: CreateDraftProfileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Creating..." : "Create Draft Profile"}
    </button>
  );
}
