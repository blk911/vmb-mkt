export type AdminCategory =
  | "corp_owned"
  | "corp_franchise"
  | "indie"
  | "solo_at_salon"
  | "solo_at_solo";

export type SizeBand = "0-6" | "6-15" | "15+";

export type AdminQueryState = {
  category: AdminCategory;

  // left nav selection (node)
  // PATCH 2B: Added franchise_brand kind
  node?: { kind: "corp" | "brand" | "facility" | "address" | "franchisee" | "owner" | "bucket" | "franchise_brand"; id: string };

  // top filters
  geo?: { state?: string; city?: string; zip?: string };
  sizeBand?: SizeBand;
  services?: string[]; // nails, barber, etc.
  search?: string;

  sort?: { key: "name" | "city" | "size" | "techCount" | "renewSoon"; dir: "asc" | "desc" };
};

export function stableKeyFromState(state: AdminQueryState): string {
  const parts: string[] = [state.category];
  if (state.node) parts.push(`${state.node.kind}:${state.node.id}`);
  if (state.geo?.state) parts.push(`state:${state.geo.state}`);
  if (state.geo?.city) parts.push(`city:${state.geo.city}`);
  if (state.geo?.zip) parts.push(`zip:${state.geo.zip}`);
  if (state.sizeBand) parts.push(`size:${state.sizeBand}`);
  if (state.services?.length) parts.push(`services:${state.services.sort().join(",")}`);
  if (state.search) parts.push(`search:${state.search}`);
  if (state.sort) parts.push(`sort:${state.sort.key}:${state.sort.dir}`);
  return parts.join("|");
}

export function applyFilters<T extends Record<string, any>>(
  rows: T[],
  state: AdminQueryState
): T[] {
  let filtered = [...rows];

  if (state.geo?.state) {
    filtered = filtered.filter((r) => String(r.state || "").toLowerCase() === state.geo!.state!.toLowerCase());
  }
  if (state.geo?.city) {
    filtered = filtered.filter((r) => String(r.city || "").toLowerCase().includes(state.geo!.city!.toLowerCase()));
  }
  if (state.geo?.zip) {
    filtered = filtered.filter((r) => String(r.zip || r.zip5 || "").includes(state.geo!.zip!));
  }
  if (state.sizeBand) {
    // Map sizeBand to actual size values - adjust based on your data model
    filtered = filtered.filter((r) => {
      const size = r.sizeBand || r.size;
      return size === state.sizeBand;
    });
  }
  if (state.services?.length) {
    filtered = filtered.filter((r) => {
      const services = r.services || r.primaryVertical || "";
      return state.services!.some((s) => String(services).toLowerCase().includes(s.toLowerCase()));
    });
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    filtered = filtered.filter((r) => {
      const hay = [
        r.name || r.businessName || r.formattedName,
        r.city,
        r.addressKey || r.rollupKey,
        r.licenseNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return filtered;
}

export function applySort<T extends Record<string, any>>(
  rows: T[],
  state: AdminQueryState
): T[] {
  const sorted = [...rows];
  const sort = state.sort || { key: "name", dir: "asc" };
  const dirMul = sort.dir === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let cmp = 0;

    switch (sort.key) {
      case "name":
        cmp = String(a.name || a.businessName || a.formattedName || "").localeCompare(
          String(b.name || b.businessName || b.formattedName || "")
        );
        break;
      case "city":
        cmp = String(a.city || "").localeCompare(String(b.city || ""));
        break;
      case "size":
        cmp = (Number(a.sizeBand || a.size || 0) - Number(b.sizeBand || b.size || 0));
        break;
      case "techCount":
        cmp = (Number(a.attachedTechCount || a.techCount || 0) - Number(b.attachedTechCount || b.techCount || 0));
        break;
      case "renewSoon":
        // Stub - implement based on your renewal date logic
        cmp = 0;
        break;
    }

    if (cmp !== 0) return cmp * dirMul;

    // Stable tie-breaker
    const ak = String(a.id || a.addressKey || a.licenseNumber || "").toLowerCase();
    const bk = String(b.id || b.addressKey || b.licenseNumber || "").toLowerCase();
    return ak.localeCompare(bk);
  });

  return sorted;
}
