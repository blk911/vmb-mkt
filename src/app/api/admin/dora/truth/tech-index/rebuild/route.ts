import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { doraDenverTablesAbs, doraDenverTechIndexAbs } from "@/backend/lib/paths/data-root";
import { computeAddressKey } from "@/backend/lib/dora/truth/addressKey";
import { computeCityKey } from "@/backend/lib/dora/truth/keys";

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
    .replace(/\u00a0/g, " ")
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

function pickLicenseNumber(r: any) {
  return String(getField(r, "License Number") || "").trim();
}
function pickName(r: any) {
  return String(getField(r, "Formatted Name") || getField(r, "First Name") + " " + getField(r, "Last Name") || "").trim();
}
function pickLicenseType(r: any) {
  return String(getField(r, "License Type") || "").trim();
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
    const techDir = doraDenverTechIndexAbs();

    const licAbs = path.join(tablesDir, "vmb_licensees_attached.json");
    const licJson = JSON.parse(await fs.readFile(licAbs, "utf8"));
    const licRows = toRows(licJson);

    // Group by license number (techId = license number)
    const byTech = new Map<string, any>();

    for (const r of licRows) {
      const licenseNumber = pickLicenseNumber(r);
      if (!licenseNumber) continue;

      const techId = licenseNumber; // techId = license number for now
      const name = pickName(r);
      const licenseType = pickLicenseType(r);
      const street1 = pickStreet(r);
      const city = pickCity(r);
      const state = pickState(r);
      const zip = pickZip(r);

      if (!city) continue; // Must have at least city

      const akey = computeAddressKey(street1, city, state, zip);
      const ckey = computeCityKey(akey.city, akey.state);

      let tech = byTech.get(techId);
      if (!tech) {
        tech = {
          techId,
          licenseNumber,
          name: name || licenseNumber,
          licenses: [],
          services: [],
          active: true,
          salons: [],
          addresses: [],
          signals: {
            densityScore: 0,
            demandScore: 0,
            networkScore: 0,
          },
        };
        byTech.set(techId, tech);
      }

      // Add license if not already present
      if (!tech.licenses.find((l: any) => l.licenseNumber === licenseNumber)) {
        tech.licenses.push({
          licenseNumber,
          licenseType,
          status: String(getField(r, "License Status Description") || "").trim(),
          expireDate: String(getField(r, "License Expiration Date") || "").trim() || null,
          renewedDate: String(getField(r, "License Last Renewed Date") || "").trim() || null,
        });
      }

      // Add service (license type = service for now)
      if (licenseType && !tech.services.includes(licenseType)) {
        tech.services.push(licenseType);
      }

      // Add address if not already present
      const addrEntry = {
        addressId: akey.addressId,
        street1: akey.street1,
        city: akey.city,
        state: akey.state,
        zip5: akey.zip5,
        cityKey: ckey.cityKey,
        cityLabel: ckey.cityLabel,
        active: true,
      };

      if (!tech.addresses.find((a: any) => a.addressId === akey.addressId)) {
        tech.addresses.push(addrEntry);
      }

      // Salon affiliation (PH1: infer from address; later we'll have explicit salon data)
      // For now, each unique address = potential salon
      // TODO: Map to actual salon IDs when available
    }

    // Compute signals (simplified PH1)
    const techs = Array.from(byTech.values());
    for (const tech of techs) {
      // Density: number of addresses
      tech.signals.densityScore = tech.addresses.length;

      // Demand: number of services (license types)
      tech.signals.demandScore = tech.services.length;

      // Network: number of unique cities
      const cities = new Set(tech.addresses.map((a: any) => a.cityKey));
      tech.signals.networkScore = cities.size;
    }

    // Write index.json
    const indexAbs = path.join(techDir, "index.json");
    await writeJsonAtomic(indexAbs, {
      ok: true,
      updatedAt: new Date().toISOString(),
      counts: {
        techs: techs.length,
        licenseRows: licRows.length,
      },
      rows: techs,
    });

    // Write by_license indexes
    const byLicenseDir = path.join(techDir, "by_license");
    await fs.mkdir(byLicenseDir, { recursive: true });
    for (const tech of techs) {
      for (const license of tech.licenses) {
        const licenseFile = path.join(byLicenseDir, `${license.licenseNumber}.json`);
        await writeJsonAtomic(licenseFile, { ok: true, tech });
      }
    }

    // Write by_address indexes
    const byAddressDir = path.join(techDir, "by_address");
    await fs.mkdir(byAddressDir, { recursive: true });
    const byAddress = new Map<string, any[]>();
    for (const tech of techs) {
      for (const addr of tech.addresses) {
        if (!byAddress.has(addr.addressId)) {
          byAddress.set(addr.addressId, []);
        }
        byAddress.get(addr.addressId)!.push(tech);
      }
    }
    for (const [addressId, techsAtAddr] of byAddress.entries()) {
      const addrFile = path.join(byAddressDir, `${addressId}.json`);
      await writeJsonAtomic(addrFile, { ok: true, techs: techsAtAddr });
    }

    // Write by_service indexes (simplified - by license type)
    const byServiceDir = path.join(techDir, "by_service");
    await fs.mkdir(byServiceDir, { recursive: true });
    const byService = new Map<string, any[]>();
    for (const tech of techs) {
      for (const service of tech.services) {
        if (!byService.has(service)) {
          byService.set(service, []);
        }
        byService.get(service)!.push(tech);
      }
    }
    for (const [service, techsWithService] of byService.entries()) {
      // Sanitize service name for filename
      const safeService = service.replace(/[^a-zA-Z0-9]/g, "_");
      const serviceFile = path.join(byServiceDir, `${safeService}.json`);
      await writeJsonAtomic(serviceFile, { ok: true, service, techs: techsWithService });
    }

    return NextResponse.json({
      ok: true,
      techDir,
      counts: {
        techs: techs.length,
        licenseRows: licRows.length,
        byLicense: byLicenseDir,
        byAddress: byAddressDir,
        byService: byServiceDir,
      },
      sample: techs.slice(0, 3),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
