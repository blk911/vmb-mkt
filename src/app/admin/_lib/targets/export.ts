import type { TargetList } from "./types";

export function toCsv(list: TargetList): string {
  const headers = ["refId", "kind", "label", "city", "zip", "sizeBand", "tags", "addedAt"];
  const rows = list.items.map((item) => [
    item.refId,
    item.kind,
    item.label,
    item.city || "",
    item.zip || "",
    item.sizeBand || "",
    (item.tags || []).join(";"),
    item.addedAt,
  ]);

  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ];

  return lines.join("\n");
}

export function toJson(list: TargetList): string {
  return JSON.stringify(list, null, 2);
}
