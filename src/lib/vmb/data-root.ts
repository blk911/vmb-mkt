import path from "node:path";

export function repoRoot() {
  return process.cwd();
}

export function dataAbs(relFromDataRoot: string) {
  const rel = String(relFromDataRoot || "").replaceAll("\\", "/").trim();

  // 🚫 Firewall: absolutely forbid backend/data paths in vmb-mkt
  if (rel.includes("backend/data") || rel.startsWith("backend/")) {
    throw new Error(
      `[VMB-MKT FIREWALL] Illegal data path "${rel}". ` +
        `This repo must ONLY read from "data/...".`,
    );
  }

  // enforce that callers pass a path under data/
  const clean = rel.startsWith("data/") ? rel : `data/${rel}`;
  return path.join(repoRoot(), clean);
}
