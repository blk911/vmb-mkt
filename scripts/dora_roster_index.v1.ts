import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT_PATH = "data/co/dora/denver_metro/dora/derived/dora_roster_index.v1.json";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDirForFile(p: string) {
  const dir = p.replace(/[\\/][^\\/]+$/, "");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function norm(s: string) {
  return (s || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normStreet(s: string) {
  let x = norm(s);

  // remove punctuation noise
  x = x.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

  // strip common unit/suite tokens at end (keeps premise match stable)
  // Examples: "STE 200", "SUITE 200", "APT 4", "UNIT B", "#200"
  x = x.replace(/\s+(STE|SUITE|APT|APARTMENT|UNIT|FL|FLOOR)\s+[A-Z0-9\-]+$/g, "");
  x = x.replace(/\s+#\s*[A-Z0-9\-]+$/g, "");

  // expand/standardize common road words
  x = x
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bWAY\b/g, "WAY");

  // cardinal directions (full words -> single letter)
  x = x
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W");

  // compress spaces again
  x = x.replace(/\s+/g, " ").trim();

  return x;
}

function stripUnitTokens(street: string) {
  let x = normStreet(street);
  x = x.replace(/\s+(STE|SUITE|APT|APARTMENT|UNIT|FL|FLOOR)\s+[A-Z0-9\-]+$/g, "");
  x = x.replace(/\s+#\s*[A-Z0-9\-]+$/g, "");
  return x.trim();
}

function makeAddressKey(street: string, city: string, state: string, zip: string) {
  const s = normStreet(street);
  const c = norm(city);
  const st = norm(state);
  const z = norm(zip).replace(/[^0-9]/g, "").slice(0, 5);
  if (!s || !c || !st || !z) return "";
  return `${s} | ${c} | ${st} | ${z}`;
}

function sniffFormat(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jsonl") return "jsonl";
  if (ext === ".json") return "json";
  if (ext === ".csv") return "csv";
  return "unknown";
}

function parseCsv(text: string) {
  // Minimal CSV parser that handles quoted commas.
  // Assumes first row is header.
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  function pushCell() {
    row.push(cur);
    cur = "";
  }
  function pushRow() {
    // ignore empty trailing rows
    if (row.length === 1 && row[0].trim() === "") return;
    rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ",") {
      pushCell();
      continue;
    }

    if (!inQuotes && ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    if (!inQuotes && ch === "\r") continue;

    cur += ch;
  }

  pushCell();
  pushRow();

  if (rows.length === 0) return { header: [], records: [] as any[] };

  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const obj: any = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = (r[j] ?? "").trim();
    return obj;
  });

  return { header, records };
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return String(obj[k]).trim();
  }
  return "";
}

function main() {
  // If the derived index already exists, allow the pipeline to proceed without rebuilding it.
  // This prevents env churn when you're running downstream joins/enrichment.
  if (!process.env.VMB_DORA_ROSTER_PATH) {
    if (fs.existsSync(OUT_PATH)) {
      console.log({ ok: true, skipped: "dora:index", reason: "derived_exists", rel: OUT_PATH });
      process.exit(0);
    }
    console.error({
      ok: false,
      error: "missing_env",
      hint: "Set VMB_DORA_ROSTER_PATH to your roster file path (csv/jsonl/json) OR ensure derived index exists at " + OUT_PATH,
    });
    process.exit(1);
  }

  const inputPath = process.env.VMB_DORA_ROSTER_PATH;

  if (!fs.existsSync(inputPath)) {
    if (fs.existsSync(OUT_PATH)) {
      console.log({ ok: true, skipped: "dora:index", reason: "input_missing_but_derived_exists", inputPath, rel: OUT_PATH });
      process.exit(0);
    }
    console.error({ ok: false, error: "missing_input", path: inputPath });
    process.exit(1);
  }

  const format = sniffFormat(inputPath);
  const raw = fs.readFileSync(inputPath, "utf8");

  let records: any[] = [];

  if (format === "jsonl") {
    records = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } else if (format === "json") {
    const j = JSON.parse(raw);
    records = Array.isArray(j) ? j : (j.rows || j.data || []);
  } else if (format === "csv") {
    records = parseCsv(raw).records;
  } else {
    console.error({ ok: false, error: "unknown_format", format, path: inputPath });
    process.exit(1);
  }

  // Normalize into a joinable roster row
  const outRows = records.map((r, idx) => {
    // Try common column names; you can extend this list as you confirm your actual headers
    const first = pick(r, ["first_name", "FirstName", "FIRST_NAME", "First Name", "FIRST NAME"]);
    const last = pick(r, ["last_name", "LastName", "LAST_NAME", "Last Name", "LAST NAME"]);
    const fullName =
      pick(r, [
        "name",
        "Name",
        "FULL_NAME",
        "FullName",
        "Licensee",
        "Licensee Name",
        "Formatted Name",
      ]) ||
      `${first} ${last}`.trim();

    const street =
      pick(r, [
        "address",
        "Address",
        "address1",
        "Address1",
        "Address Line 1",
        "street",
        "Street",
        "Mailing Address",
        "Business Address",
      ]) || "";

    const city = pick(r, ["city", "City", "CITY"]) || "";
    const state = pick(r, ["state", "State", "STATE"]) || "CO";
    const zip =
      pick(r, [
        "zip",
        "Zip",
        "ZIP",
        "postal",
        "Postal",
        "PostalCode",
        "Postal Code",
        "Mail Zip Code",
      ]) || "";

    const licenseType =
      pick(r, ["license_type", "LicenseType", "LICENSE_TYPE", "Type", "Credential", "License Type"]) || "";
    const licenseStatus =
      pick(r, [
        "status",
        "Status",
        "STATUS",
        "LicenseStatus",
        "License Status",
        "License Status Description",
      ]) || "";

    const addressKey = makeAddressKey(street, city, state, zip);
    const streetBase = stripUnitTokens(street);
    const addressKeyBase = makeAddressKey(streetBase, city, state, zip);

    return {
      rowId: `${idx + 1}`,
      fullName: norm(fullName),
      street: normStreet(street),
      streetBase: normStreet(streetBase),
      city: norm(city),
      state: norm(state),
      zip: norm(zip).replace(/[^0-9]/g, "").slice(0, 5),
      addressKey,
      addressKeyBase,
      licenseType: norm(licenseType),
      licenseStatus: norm(licenseStatus),
      raw: r, // keep raw for forensic debugging; we can strip later if it gets big
    };
  });

  const withAddressKey = outRows.filter((x) => x.addressKey);

  // Build lookups
  const byAddressKey: Record<string, any[]> = {};
  for (const x of withAddressKey) {
    byAddressKey[x.addressKey] ||= [];
    byAddressKey[x.addressKey].push(x);
  }
  const byAddressKeyBase: Record<string, any[]> = {};
  for (const x of withAddressKey) {
    const kb = x.addressKeyBase;
    if (!kb) continue;
    byAddressKeyBase[kb] ||= [];
    byAddressKeyBase[kb].push(x);
  }
  const byAddressSummary: Record<string, any> = {};
  for (const key of Object.keys(byAddressKey)) {
    const rows = byAddressKey[key] || [];
    const uniqueNamesSet = new Set<string>();
    let active = 0;
    const uniqueTypesSet = new Set<string>();
    for (const r of rows) {
      const name = String(r?.fullName || "").trim();
      if (name) uniqueNamesSet.add(name);
      if (String(r?.licenseStatus || "").toUpperCase().includes("ACTIVE")) active++;
      const lt = String(r?.licenseType || "").trim();
      if (lt) uniqueTypesSet.add(lt);
    }
    byAddressSummary[key] = {
      total: rows.length,
      active,
      uniqueNames: uniqueNamesSet.size,
      uniqueTypes: uniqueTypesSet.size,
    };
  }

  const out = {
    ok: true,
    kind: "dora_roster_index",
    version: "v1",
    source: {
      rel: inputPath,
      format,
      sha256: sha256(raw),
      records: records.length,
    },
    counts: {
      rows: outRows.length,
      withAddressKey: withAddressKey.length,
      uniqAddressKey: Object.keys(byAddressKey).length,
      uniqAddressKeyBase: Object.keys(byAddressKeyBase).length,
    },
    byAddressKey, // primary join key
    byAddressKeyBase,
    byAddressSummary,
    updatedAt: new Date().toISOString(),
  };

  ensureDirForFile(OUT_PATH);
  const outText = JSON.stringify(out, null, 2);
  fs.writeFileSync(OUT_PATH, outText, "utf8");

  console.log({
    ok: true,
    wrote: OUT_PATH,
    counts: out.counts,
    sha256: {
      source: out.source.sha256,
      derived: sha256(outText),
    },
  });
}

main();
