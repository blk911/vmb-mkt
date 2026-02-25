import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

type AnyObj = Record<string, any>;

function s(v: any) {
  return String(v ?? "").trim();
}
function up(v: any) {
  return s(v).toUpperCase();
}
function normZip5(v: any) {
  const z = s(v).replace(/[^\d]/g, "");
  if (!z) return "";
  return z.length >= 5 ? z.slice(0, 5) : z;
}

function mkdirp(absDir: string) {
  fssync.mkdirSync(absDir, { recursive: true });
}

function writeAtomicJson(abs: string, obj: any) {
  mkdirp(path.dirname(abs));
  const tmp = abs + ".tmp";
  fssync.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fssync.renameSync(tmp, abs);
}

function exists(abs: string) {
  try {
    return fssync.existsSync(abs);
  } catch {
    return false;
  }
}

/**
 * CSV headers in your file include leading spaces, e.g. " First Name", " License Status Description"
 * This function normalizes keys so downstream mapping is stable.
 */
function normalizeHeaderKey(k: string) {
  return String(k ?? "")
    .replace(/\uFEFF/g, "") // BOM
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Build a stable addressKey for joining:
 * - not just "CITY STATE" (too lossy)
 * - uses addr1 + city + state + zip5
 * - uppercase, collapsed whitespace
 */
function buildAddressKey(addr1: string, city: string, state: string, zip5: string) {
  const a1 = up(addr1).replace(/\s+/g, " ");
  const c = up(city).replace(/\s+/g, " ");
  const st = up(state).replace(/\s+/g, " ");
  const z = normZip5(zip5);
  return up(`${a1}|${c}|${st}|${z}`).replace(/\|+/g, "|").replace(/\s+/g, " ").trim();
}

/**
 * rollupKey for your app appears to be "CITY STATE" (e.g., "ARVADA CO")
 */
function buildRollupKey(city: string, state: string) {
  const c = up(city).replace(/\s+/g, " ").trim();
  const st = up(state).replace(/\s+/g, " ").trim();
  if (!c || !st) return "";
  return `${c} ${st}`.trim();
}

export async function POST(req: Request) {
  try {
    const repo = process.cwd();

    const rawDir = path.join(repo, "data", "co", "dora", "denver_metro", "raw");
    const tablesDir = path.join(repo, "data", "co", "dora", "denver_metro", "tables");

    // Default raw file (your confirmed path)
    const url = new URL(req.url);
    const rawRel = url.searchParams.get("file")?.trim() || "cosmetology_registrations_raw_2026-02-20.csv";
    const rawAbs = path.isAbsolute(rawRel) ? rawRel : path.join(rawDir, rawRel);

    if (!exists(rawAbs)) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing raw registrations csv",
          rawAbs,
          hint: `Put your CSV here: ${rawDir} OR call with ?file=<filename.csv>`,
        },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const csvText = await fs.readFile(rawAbs, "utf8");

    // Tolerant parse: your sample shows weird quotes like: "Ab"solutely Nails & More ..."
    // These options intentionally try to "just get rows out" rather than failing.
    const records: AnyObj[] = parse(csvText, {
      columns: (hdr: string[]) => hdr.map(normalizeHeaderKey),
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
      quote: '"',
      escape: '"',
      delimiter: ",",
      trim: false, // we trim ourselves per-field
    });

    // Detect canonical field names (post-normalization)
    const F = {
      entityName: "Entity Name",
      formattedName: "Formatted Name",
      attention: "Attention",
      addr1: "Address Line 1",
      addr2: "Address Line 2",
      city: "City",
      state: "State",
      county: "County",
      mailZip: "Mail Zip Code",
      mailZip4: "Mail Zip Code + 4",
      licenseType: "License Type",
      subCategory: "Sub Category",
      licenseNumber: "License Number",
      firstIssue: "License First Issue Date",
      lastRenewed: "License Last Renewed Date",
      expiration: "License Expiration Date",
      status: "License Status Description", // normalized from " License Status Description"
      specialty: "Specialty",
      title: "Title",
      degree: "Degree(s)",
      caseNumber: "Case Number",
      programAction: "Program Action",
      disciplineEff: "Discipline Effective Date",
      disciplineComp: "Discipline Complete Date",
    };

    const parsedRows = records.length;
    let keptRows = 0;
    let droppedNoAddress = 0;
    let droppedNoName = 0;
    let badState = 0;

    // Dedup: best key for “a registered shop record” is licenseNumber
    // If licenseNumber missing, fallback to addressKey + entityName.
    const byKey = new Map<string, AnyObj>();

    for (const r of records) {
      const entityName = s(r[F.entityName]);
      const formattedName = s(r[F.formattedName]);
      const businessName = entityName || formattedName; // best effort

      const addr1 = s(r[F.addr1]);
      const addr2 = s(r[F.addr2]);
      const city = s(r[F.city]);
      const state = s(r[F.state]);
      const zip5 = normZip5(r[F.mailZip]);

      if (!businessName) {
        droppedNoName++;
        continue;
      }
      if (!addr1 || !city || !state) {
        droppedNoAddress++;
        continue;
      }

      // This ingest is for CO; if state is missing/odd we keep it but count it
      if (up(state) !== "CO") badState++;

      const addressKey = buildAddressKey(addr1, city, state, zip5);
      const rollupKey = buildRollupKey(city, state);

      const licenseNumber = s(r[F.licenseNumber]);
      const dedupKey = licenseNumber ? `LIC:${licenseNumber}` : `ADDR:${addressKey}|NAME:${up(businessName)}`;

      const out = {
        // identity
        businessName,
        entityName,
        formattedName,
        attention: s(r[F.attention]),

        // location
        address1: addr1,
        address2: addr2,
        city,
        state,
        county: s(r[F.county]),
        zip5,

        // join keys
        addressKey,
        rollupKey,

        // registration / license
        licenseType: s(r[F.licenseType]),
        subCategory: s(r[F.subCategory]),
        licenseNumber,
        firstIssueDate: s(r[F.firstIssue]),
        lastRenewedDate: s(r[F.lastRenewed]),
        expirationDate: s(r[F.expiration]),
        status: s(r[F.status]) || s((r as any)[" License Status Description"]), // belt + suspenders
        specialty: s(r[F.specialty]),
        title: s(r[F.title]),
        degrees: s(r[F.degree]),

        // discipline
        caseNumber: s(r[F.caseNumber]),
        programAction: s(r[F.programAction]),
        disciplineEffectiveDate: s(r[F.disciplineEff]),
        disciplineCompleteDate: s(r[F.disciplineComp]),
      };

      // Prefer “Active” record if we see duplicates
      const prev = byKey.get(dedupKey);
      if (!prev) {
        byKey.set(dedupKey, out);
      } else {
        const prevActive = up(prev.status).includes("ACTIVE");
        const nextActive = up(out.status).includes("ACTIVE");
        if (!prevActive && nextActive) byKey.set(dedupKey, out);
      }

      keptRows++;
    }

    const rows = Array.from(byKey.values());

    // Light sort to make file stable
    rows.sort((a, b) => {
      const ra = String(a.rollupKey || "").localeCompare(String(b.rollupKey || ""));
      if (ra !== 0) return ra;
      return String(a.businessName || "").localeCompare(String(b.businessName || ""));
    });

    const outAbs = path.join(tablesDir, "vmb_registrations.json");
    writeAtomicJson(outAbs, {
      ok: true,
      updatedAt,
      source: path.basename(rawAbs),
      counts: {
        parsedRows,
        keptRows,
        dedupedRows: rows.length,
        droppedNoName,
        droppedNoAddress,
        badState,
      },
      rows,
    });

    return NextResponse.json({
      ok: true,
      rel: "data/co/dora/denver_metro/tables/vmb_registrations.json",
      updatedAt,
      counts: {
        parsedRows,
        keptRows,
        dedupedRows: rows.length,
        droppedNoName,
        droppedNoAddress,
        badState,
      },
      inputs: {
        rawAbs,
        outAbs,
      },
      sample: rows.slice(0, 3),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
