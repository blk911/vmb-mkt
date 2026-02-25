export type TechMini = {
  licenseId: string;
  name: string;
  licenseType: string;
  status: string;
  expireDate: string | null;
  renewBy: string | null;
  addressId: string;
  city?: string;
  state?: string;
  zip?: string;
};

export async function loadTechRoster() {
  // serve these via Next route (recommended) to avoid direct FS in client
  const [byIdRes, byAddrRes] = await Promise.all([
    fetch("/api/admin/dora/derived/tech_by_id", { cache: "no-store" }).then(r => r.json()),
    fetch("/api/admin/dora/derived/tech_ids_by_address", { cache: "no-store" }).then(r => r.json()),
  ]);

  return {
    techById: (byIdRes.techById || {}) as Record<string, TechMini>,
    techIdsByAddress: (byAddrRes.techIdsByAddress || {}) as Record<string, string[]>,
  };
}
