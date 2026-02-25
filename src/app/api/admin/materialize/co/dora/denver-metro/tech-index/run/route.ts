import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";

function dataRootDenver() {
  return path.join(process.cwd(), "data", "co", "dora", "denver_metro");
}

function readJson(abs: string) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeAtomicJson(abs: string, obj: any) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, abs);
}

function safeStr(v: any) {
  if (v == null) return "";
  return String(v).trim();
}

function s(v: any): string {
  return String(v || "").trim();
}

export async function POST() {
  try {
    const root = dataRootDenver();
    const updatedAt = new Date().toISOString();

    const srcAbs = path.join(root, "tables", "vmb_licensees_attached.json");
    if (!fs.existsSync(srcAbs)) {
      return NextResponse.json({ ok: false, error: "missing input", tried: [srcAbs] }, { status: 400 });
    }

    const rawRows: any[] = readJson(srcAbs);
    const rowsArray = Array.isArray(rawRows) ? rawRows : rawRows?.rows || [];

    let licenseMissing = 0;
    let nameMissing = 0;
    let addressMissing = 0;
    let addressCountMax = 0;

    const rows = rowsArray.map((row, i) => {
      const licenseNumber =
        s(row["License Number"]) ||
        s(row.licenseNumber) ||
        s(row.license_number) ||
        s(row.license) ||
        s(row.lic) ||
        s(row.id);

      if (!licenseNumber) licenseMissing++;

      const name =
        s(row["Formatted Name"]) ||
        s(row.name) ||
        [s(row["First Name"] || row.firstName || row.first_name), s(row["Last Name"] || row.lastName || row.last_name)]
          .filter(Boolean)
          .join(" ")
          .trim();

      if (!name) nameMissing++;

      // Canonical rollup/area key for joins (matches vmb_address_rollup.json rollupKey)
      const rollupKey = s(row["rollupKey"]);
      const addressKey = s(row["addressKey"]);
      const city = s(row["City"]);
      const state = s(row["State"]);
      const zip5 = s(row["Mail Zip Code"]) || s(row["Zip"]) || s(row["zip5"]);

      const areaKey =
        rollupKey ||
        addressKey ||
        (city && state ? `${city} ${state}` : "") ||
        zip5 ||
        "";

      const line1 = s(row["Address Line 1"]);
      const line2 = s(row["Address Line 2"]);
      const county = s(row["County"]);

      const hasAnyAddress = Boolean(line1 || city || zip5 || rollupKey || addressKey);
      if (!hasAnyAddress) addressMissing++;

      const addresses = hasAnyAddress
        ? [
            {
              line1: line1,
              line2: line2,
              city,
              state,
              zip5,
              county,
              addressKey,
              rollupKey,
            },
          ]
        : [];

      const addressCount = addresses.length;
      if (addressCount > addressCountMax) addressCountMax = addressCount;

      const techId = licenseNumber ? `co_dora_${licenseNumber}` : `row_${i}`;

      return {
        techId,
        licenseNumber,
        name,
        // NOTE: This source table does NOT contain salon affiliations.
        salons: [] as any[],
        addresses,
        salonCount: 0,
        addressCount,
        // IMPORTANT: this enables density joins in signals
        areaKey,
        signals: null,
      };
    });

    const outAbs = path.join(root, "tech", "index.json");
    writeAtomicJson(outAbs, {
      ok: true,
      updatedAt,
      counts: {
        rows: rows.length,
        licenseMissing,
        nameMissing,
        addressMissing,
        addressCountMax,
      },
      rows,
    });

    return NextResponse.json({
      ok: true,
      rel: "data/co/dora/denver_metro/tech/index.json",
      counts: { rows: rows.length, licenseMissing, nameMissing, addressMissing, addressCountMax },
      updatedAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
