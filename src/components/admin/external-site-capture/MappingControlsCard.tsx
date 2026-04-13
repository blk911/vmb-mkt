"use client";

import type { MappingControlState } from "@/lib/external-site-capture/types";

type MappingControlsCardProps = {
  controls: MappingControlState;
  onChange: (key: keyof MappingControlState, value: boolean) => void;
};

const CONTROL_LABELS: Array<{ key: keyof MappingControlState; label: string }> = [
  { key: "buildHero", label: "Build Hero" },
  { key: "buildServiceCards", label: "Build Service Cards" },
  { key: "buildFavoriteCards", label: "Build Favorite Cards" },
  { key: "buildReferralBlock", label: "Build Referral Block" },
  { key: "buildGiftBlock", label: "Build Gift Block" },
  { key: "buildPortfolioGrid", label: "Build Portfolio Grid" },
];

export function MappingControlsCard({ controls, onChange }: MappingControlsCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-neutral-900">Mapping Controls</h2>
        <p className="text-sm text-neutral-600">V1 keeps these defaults on, but the toggles are wired for later mapping control.</p>
      </div>
      <div className="grid gap-3">
        {CONTROL_LABELS.map((control) => (
          <label key={control.key} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            <span className="font-medium text-neutral-800">{control.label}</span>
            <input
              type="checkbox"
              checked={controls[control.key]}
              onChange={(event) => onChange(control.key, event.target.checked)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
