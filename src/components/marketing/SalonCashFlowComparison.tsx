import React from "react";

type Row = {
  label: string;
  amount: number;
  muted?: boolean;
  accent?: "red" | "green" | "default";
};

function money(n: number) {
  return `$${n}`;
}

function RowLine({ row }: { row: Row }) {
  const amountClass =
    row.accent === "red"
      ? "text-red-600"
      : row.accent === "green"
      ? "text-green-700"
      : "text-neutral-900";

  const labelClass = row.muted
    ? "text-neutral-400 line-through"
    : row.accent === "red"
      ? "text-red-600"
      : "text-neutral-900";

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4 py-1.5 text-[15px] leading-6">
      <div className={labelClass}>{row.label}</div>
      <div className={`font-medium tabular-nums ${amountClass}`}>{money(row.amount)}</div>
    </div>
  );
}

function Section({
  title,
  rows,
  subtotal,
}: {
  title: string;
  rows: Row[];
  subtotal: number;
}) {
  return (
    <div className="mt-6">
      <h4 className="text-[17px] font-semibold text-neutral-900">{title}</h4>

      <div className="mt-3">
        {rows.map((row) => (
          <RowLine key={`${title}-${row.label}`} row={row} />
        ))}
      </div>

      <div className="mt-3 border-t border-dashed border-neutral-400 pt-3">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-[15px]">
          <div className="font-medium text-neutral-900">Subtotal</div>
          <div className="font-semibold tabular-nums text-neutral-900">{money(subtotal)}</div>
        </div>
      </div>
    </div>
  );
}

function CashFlowCard({
  title,
  sessionAmount,
  salesTax,
  coMarketing,
  variableRows,
  variableSubtotal,
  fixedRows,
  fixedSubtotal,
  netRevenue,
  netSessionRevenue,
  highlight = false,
}: {
  title: string;
  sessionAmount: number;
  salesTax: number;
  coMarketing?: number;
  variableRows: Row[];
  variableSubtotal: number;
  fixedRows: Row[];
  fixedSubtotal: number;
  netRevenue: number;
  netSessionRevenue: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${
        highlight
          ? "border-emerald-300 bg-emerald-50/60"
          : "border-neutral-300 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[24px] font-bold tracking-tight text-neutral-950">{title}</h3>
        <div className="text-right">
          <div className="text-[14px] text-neutral-500">Session</div>
          <div className="text-[28px] font-bold tabular-nums text-neutral-950">
            {money(sessionAmount)}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-[15px]">
          <div className="text-neutral-900">Sales Tax</div>
          <div className="font-medium tabular-nums text-neutral-900">{money(salesTax)}</div>
        </div>

        {typeof coMarketing === "number" && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-[15px]">
            <div className="font-medium text-red-600">VMB Co-Marketing</div>
            <div className="font-semibold tabular-nums text-red-600">{money(coMarketing)}</div>
          </div>
        )}

        <div className="border-t border-dashed border-neutral-400 pt-3">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-[18px]">
            <div className="font-semibold text-neutral-950">Net Revenue</div>
            <div className="font-bold tabular-nums text-neutral-950">{money(netRevenue)}</div>
          </div>
        </div>
      </div>

      <Section
        title="Variable Expenses"
        rows={variableRows}
        subtotal={variableSubtotal}
      />

      <Section title="Fixed Expenses" rows={fixedRows} subtotal={fixedSubtotal} />

      <div className="mt-8 border-t border-neutral-300 pt-5">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="text-[22px] font-bold tracking-tight text-neutral-950">
            Net Session Revenue
          </div>
          <div
            className={`text-[30px] font-bold tabular-nums ${
              highlight ? "text-emerald-700" : "text-neutral-950"
            }`}
          >
            {money(netSessionRevenue)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalonCashFlowComparison() {
  return (
    <section className="rounded-[28px] border border-neutral-300 bg-neutral-50 p-6 md:p-8">
      <div className="max-w-3xl">
        <h2 className="text-[34px] font-bold tracking-tight text-neutral-950">
          Where the Money Goes
        </h2>
        <p className="mt-3 text-[17px] leading-7 text-neutral-700">
          A typical <span className="font-semibold">$100 salon session</span> looks very
          different when marketing dollars are redirected toward clients instead of wasted on
          ads. VMB keeps more value inside the salon relationship.
        </p>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <CashFlowCard
          title="Traditional Salon Cash Flow"
          sessionAmount={100}
          salesTax={8}
          netRevenue={92}
          variableRows={[
            { label: "Web / Apps / Payment Processing", amount: 8 },
            { label: "Products / Supplies", amount: 7 },
            { label: "Utilities / Laundry / Misc.", amount: 10 },
            { label: "Marketing / Ads / Social Media", amount: 10 },
          ]}
          variableSubtotal={35}
          fixedRows={[
            { label: "Rent", amount: 8 },
            { label: "Insurance", amount: 1 },
            { label: "Income Taxes", amount: 3 },
          ]}
          fixedSubtotal={12}
          netSessionRevenue={44}
        />

        <CashFlowCard
          title="VMB Salon Cash Flow"
          sessionAmount={100}
          salesTax={8}
          coMarketing={5}
          netRevenue={87}
          variableRows={[
            { label: "Web / Apps / Payment Processing", amount: 6 },
            { label: "Products / Supplies", amount: 7 },
            { label: "Utilities / Laundry / Misc.", amount: 10 },
            { label: "Marketing / Ads / Social Media", amount: 10, muted: true },
          ]}
          variableSubtotal={25}
          fixedRows={[
            { label: "Rent", amount: 8 },
            { label: "Insurance", amount: 1 },
            { label: "Income Taxes", amount: 3 },
          ]}
          fixedSubtotal={12}
          netSessionRevenue={49}
          highlight
        />
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="text-[16px] leading-7 text-neutral-800">
          <span className="font-semibold">Bottom line:</span> instead of burning money on ads,
          VMB redirects part of the marketing budget into co-marketing that benefits{" "}
          <span className="font-semibold">salons and clients</span> - increasing retention,
          referrals, and net session revenue.
        </p>
      </div>
    </section>
  );
}

