import fs from "node:fs";
import path from "node:path";
import { loadResolverRegistry } from "./registry-store";
import { normalizeName } from "./normalize";
import type { ResolverOperator } from "./types";

const CHILD_AUDIT_PATH = path.join(process.cwd(), "runtime-data/child_operator_audit.json");

type ChildAuditSummary = {
  totalChildOperators: number;
  withCanonicalBooking: number;
  withCanonicalInstagram: number;
  withCanonicalWebsite: number;
  withNoDirectSurface: number;
  withSlugLikeOrProvisionalName: number;
};

type ParentGroupRow = {
  parentContainerId: string;
  childCount: number;
  weakCount: number;
  childIds: string[];
};

type PotentialDuplicateRow = {
  parentContainerId: string;
  childA: string;
  childB: string;
  nameA?: string;
  nameB?: string;
  similarity: number;
};

function isChildOperator(op: ResolverOperator): boolean {
  return !op.isContainer && Boolean(op.parentContainerId);
}

function isProvisionalName(value?: string): boolean {
  const text = normalizeName(value);
  if (!text) return true;
  if (!text.includes(" ")) return true;
  if (/[-_]/.test(value || "")) return true;
  if (/(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(text)) return true;
  return false;
}

function hasDirectSurface(op: ResolverOperator): boolean {
  return Boolean(op.canonicalBooking || op.canonicalInstagram || op.canonicalWebsite);
}

function tokenSet(text: string): Set<string> {
  return new Set(text.split(" ").map((x) => x.trim()).filter(Boolean));
}

function jaccard(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const value of sa) if (sb.has(value)) inter += 1;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

export function buildChildOperatorAudit(inputOperators?: ResolverOperator[]) {
  const operators = inputOperators || loadResolverRegistry();
  const children = operators.filter(isChildOperator);
  const summary: ChildAuditSummary = {
    totalChildOperators: children.length,
    withCanonicalBooking: children.filter((x) => Boolean(x.canonicalBooking)).length,
    withCanonicalInstagram: children.filter((x) => Boolean(x.canonicalInstagram)).length,
    withCanonicalWebsite: children.filter((x) => Boolean(x.canonicalWebsite)).length,
    withNoDirectSurface: children.filter((x) => !hasDirectSurface(x)).length,
    withSlugLikeOrProvisionalName: children.filter((x) => isProvisionalName(x.canonicalName)).length,
  };

  const byParentMap = new Map<string, ResolverOperator[]>();
  for (const child of children) {
    const parentId = child.parentContainerId || "unknown_parent";
    const bucket = byParentMap.get(parentId) || [];
    bucket.push(child);
    byParentMap.set(parentId, bucket);
  }

  const groupedByParent: ParentGroupRow[] = [...byParentMap.entries()]
    .map(([parentContainerId, rows]) => ({
      parentContainerId,
      childCount: rows.length,
      weakCount: rows.filter((row) => !hasDirectSurface(row)).length,
      childIds: [...new Set(rows.map((row) => row.id))],
    }))
    .sort((a, b) => b.childCount - a.childCount);

  const potentialDuplicates: PotentialDuplicateRow[] = [];
  for (const [parentContainerId, rows] of byParentMap.entries()) {
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i];
        const b = rows[j];
        if (a.id === b.id) continue;
        const nameA = normalizeName(a.canonicalName);
        const nameB = normalizeName(b.canonicalName);
        const similarity = jaccard(nameA, nameB);
        if (similarity < 0.66) continue;
        potentialDuplicates.push({
          parentContainerId,
          childA: a.id,
          childB: b.id,
          nameA: a.canonicalName,
          nameB: b.canonicalName,
          similarity: Number(similarity.toFixed(3)),
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
    groupedByParent,
    potentialDuplicates,
  };
}

export function writeChildOperatorAudit(inputOperators?: ResolverOperator[]): string {
  const audit = buildChildOperatorAudit(inputOperators);
  fs.mkdirSync(path.dirname(CHILD_AUDIT_PATH), { recursive: true });
  fs.writeFileSync(CHILD_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  return "runtime-data/child_operator_audit.json";
}

