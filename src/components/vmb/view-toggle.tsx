export type ViewMode = "shops" | "techs" | "raw";

export default function ViewToggle({
  mode,
  setMode,
}: {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {(["shops", "techs", "raw"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setMode(v)}
          className={`rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold transition ${
            mode === v ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white text-neutral-800 hover:bg-neutral-50"
          }`}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
