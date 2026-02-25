import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTablesAbs, doraDenverDerivedAbs } from "@/backend/lib/paths/data-root";
import { computeCityKey } from "@/backend/lib/dora/truth/keys";
import { computeAddressKey } from "@/backend/lib/dora/truth/addressKey";

function toRows(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.rows)) return j.rows;
  if (Array.isArray(j.data)) return j.data;
  return [];
}

async function writeJsonAtomic(abs: string, obj: any) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, abs);
}

function normKey(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ") // NBSP -> space
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getField(r: any, wanted: string) {
  const w = normKey(wanted);
  for (const k of Object.keys(r || {})) {
    if (normKey(k) === w) return r[k];
  }
  return undefined;
}

function pickStreet(r: any) {
  return String(getField(r, "Address Line 1") || "").trim();
}
function pickCity(r: any) {
  return String(getField(r, "City") || "").trim();
}
function pickState(r: any) {
  return String(getField(r, "State") || "CO").trim();
}
function pickZip(r: any) {
  return String(getField(r, "Mail Zip Code") || "").trim();
}

export async function POST() {
  try {
    const tablesDir = doraDenverTablesAbs();
    const derivedDir = doraDenverDerivedAbs();

    const licAbs = path.join(tablesDir, "vmb_licensees_attached.json");
    const candAbs = path.join(tablesDir, "vmb_attach_candidates.json");

    const licJson = JSON.parse(await fs.readFile(licAbs, "utf8"));
    const licRows = toRows(licJson);

    const sample = licRows[0] || null;

    const wanted = ["Address Line 1", "Mail Zip Code", "City", "State"].map((w) => {
      const keys = Object.keys(sample || {});
      const foundKey = keys.find((k) => normKey(k) === normKey(w)) || null;
      return {
        wanted: w,
        foundKey,
        value: sample ? getField(sample, w) ?? null : null,
      };
    });

    const sampleStreet = sample ? pickStreet(sample) : "";
    const sampleZip = sample ? pickZip(sample) : "";

    // Hard guard: ensure we have rows
    if (!sample) throw new Error("licensees_attached has 0 rows");

    if (!sampleStreet) {
      throw new Error("pickStreet() empty — key mismatch (see diag.wanted)");
    }
    if (!sampleZip) {
      throw new Error("pickZip() empty — key mismatch (see diag.wanted)");
    }

    const candJson = await fs.readFile(candAbs, "utf8").then(s => JSON.parse(s)).catch(() => null);
    const candRows = toRows(candJson);

    // Candidate set by computed addressId (we'll compute same way)
    const candSet = new Set<string>();
    for (const c of candRows) {
      const k = computeAddressKey(pickStreet(c), pickCity(c), pickState(c), pickZip(c));
      candSet.add(k.addressId);
    }

    const byAddr = new Map<string, any>();

    let skippedNoLocation = 0;

    for (const r of licRows) {
      const street1 = pickStreet(r);
      const city = pickCity(r);
      const state = pickState(r);
      const zip = pickZip(r);

      // Must have at least city+state to be usable; but ideally street too
      if (!String(city || "").trim()) {
        skippedNoLocation++;
        continue;
      }

      const akey = computeAddressKey(street1, city, state, zip);
      const ckey = computeCityKey(akey.city, akey.state);

      const cur = byAddr.get(akey.addressId) || {
        addressId: akey.addressId,
        street1: akey.street1,
        city: akey.city,
        state: akey.state,
        zip5: akey.zip5,
        addressLabel: `${akey.street1} - ${akey.city} ${akey.state} ${akey.zip5}`.trim(),
        cityKey: ckey.cityKey,
        cityLabel: ckey.cityLabel,
        techCount: 0,
        regCount: 0, // will stay 0 in this builder (REG comes from facility side later)
        cand: 0,
      };

      cur.techCount += 1;
      if (candSet.has(akey.addressId)) cur.cand = 1;

      byAddr.set(akey.addressId, cur);
    }

    const rows = Array.from(byAddr.values());

    const outAbs = path.join(derivedDir, "address_truth_rollup.json");
    await writeJsonAtomic(outAbs, {
      ok: true,
      updatedAt: new Date().toISOString(),
      counts: {
        licenseRows: licRows.length,
        addressRows: rows.length,
        skippedNoLocation,
      },
      rows,
    });

    return NextResponse.json({
      ok: true,
      outAbs,
      counts: { licenseRows: licRows.length, addressRows: rows.length, skippedNoLocation },
      sample: rows.slice(0, 3),
      diag: {
        wanted,
        sampleStreet,
        sampleZip,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
