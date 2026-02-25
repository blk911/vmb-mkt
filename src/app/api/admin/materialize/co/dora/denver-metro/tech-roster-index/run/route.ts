import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { computeAddressId } from "@/backend/lib/dora/address-id";
import { doraDenverTablesAbs, doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";

function pick(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

async function readJson(abs: string) {
  const s = await fs.readFile(abs, "utf8");
  return JSON.parse(s);
}
async function writeJsonAtomic(abs: string, obj: any) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, abs);
}

export async function POST() {
  const tablesDir = doraDenverTablesAbs();
  const derivedDir = doraDenverDerivedAbs();

  // These filenames MUST match your actual artifacts.
  // If yours are prefixed (vmb_*), adjust here once.
  const licenseesPathCandidates = [
    path.join(tablesDir, "licensees.json"),
    path.join(tablesDir, "vmb_licensees.json"),
    path.join(tablesDir, "vmb_licensees_attached.json"),
  ];

  let licenseesAbs: string | null = null;
  for (const c of licenseesPathCandidates) {
    try { await fs.stat(c); licenseesAbs = c; break; } catch {}
  }
  if (!licenseesAbs) {
    return NextResponse.json({
      ok: false,
      error: "licensees table not found",
      tried: licenseesPathCandidates,
      tablesDir,
    }, { status: 400 });
  }

  const licensees = await readJson(licenseesAbs);
  const rows: any[] = Array.isArray(licensees) ? licensees : (licensees.rows || []);

  // Build tech_by_id and tech_ids_by_address
  const techById: Record<string, any> = {};
  const techIdsByAddress: Record<string, string[]> = {};

  let skippedNoAddr = 0;

  for (const t of rows) {
    const licenseId = pick(t, [
      "License Number",
      "licenseId",
      "license_id",
      "license_number",
      "License",
    ]);
    if (!licenseId) continue;

    // Map your fields here (adjust keys once, but keep stable output)
    const firstName = pick(t, ["First Name", " firstName", "firstName", " First Name"]);
    const lastName = pick(t, ["Last Name", "lastName"]);
    const name =
      pick(t, ["Formatted Name", "name", "fullName", "Entity Name"]) ||
      `${firstName} ${lastName}`.trim() ||
      "UNKNOWN";

    const street1 = pick(t, [
      "Street Address",
      "Address Line 1",
      "street1",
      "address1",
      "address",
      "street",
      "Mail Street Address",
    ]);
    const street2 = pick(t, [
      "Street Address 2",
      "Address Line 2",
      "street2",
      "address2",
    ]);
    const city = pick(t, ["City", "city"]);
    const state = pick(t, ["State", "state"]) || "CO";
    const zip = pick(t, ["Mail Zip Code", "Zip Code", "zip", "zipCode"]);

    if (!street1 || !city) {
      skippedNoAddr++;
      continue;
    }

    const { addressId } = computeAddressId({ street1, street2, city, state, zip });

    const tech = {
      licenseId,
      name,
      licenseType:
        pick(t, ["License Type", "licenseType", "type", "profession"]) || "Unknown",
      status:
        pick(t, ["License Status Description", "status", "licenseStatus"]) || "Unknown",
      expireDate:
        pick(t, ["Expiration Date", "License Expiration Date", "expireDate", "expirationDate", "expiration"]) ||
        null,
      renewBy:
        pick(t, ["Renewal Date", "License Last Renewed Date", "renewBy", "renewalDate"]) ||
        null,
      addressId,
      city,
      state,
      zip,
    };

    techById[licenseId] = tech;
    if (!techIdsByAddress[addressId]) techIdsByAddress[addressId] = [];
    techIdsByAddress[addressId].push(licenseId);
  }

  // De-dupe + stable sort for deterministic UI
  for (const k of Object.keys(techIdsByAddress)) {
    const set = Array.from(new Set(techIdsByAddress[k]));
    set.sort();
    techIdsByAddress[k] = set;
  }

  const outTechById = path.join(derivedDir, "tech_by_id.json");
  const outByAddr = path.join(derivedDir, "tech_ids_by_address.json");

  await writeJsonAtomic(outTechById, { ok: true, updatedAt: new Date().toISOString(), techById });
  await writeJsonAtomic(outByAddr, { ok: true, updatedAt: new Date().toISOString(), techIdsByAddress });

  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    inputs: { licenseesAbs },
    outputs: { outTechById, outByAddr },
    counts: {
      techs: Object.keys(techById).length,
      addressesWithAnyTech: Object.keys(techIdsByAddress).length,
      skippedNoAddr,
    },
  });
}
