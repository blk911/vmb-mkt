"use client";

import React from "react";
import type { AdminQueryState, AdminCategory } from "../_lib/adminQueryState";
import { buildFranchiseTree } from "../_lib/ldap/buildFranchiseTree";

type LeftNavLdapProps = {
  state: AdminQueryState;
  onChange: (next: AdminQueryState) => void;
};

type TreeNode = {
  kind: "corp" | "brand" | "facility" | "address" | "franchisee" | "owner" | "bucket" | "franchise_brand";
  id: string;
  label: string;
  count?: number;
  children?: TreeNode[];
};

export default function LeftNavLdap({ state, onChange }: LeftNavLdapProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [franchiseBrands, setFranchiseBrands] = React.useState<Array<{ id: string; label: string; count: number }>>([]);
  const [franchiseRegistry, setFranchiseRegistry] = React.useState<any>(null);

  const categories: AdminCategory[] = [
    "corp_owned",
    "corp_franchise",
    "indie",
    "solo_at_salon",
    "solo_at_solo",
  ];

  const categoryLabels: Record<AdminCategory, string> = {
    corp_owned: "Corp Owned",
    corp_franchise: "Corp Franchise",
    indie: "Indie",
    solo_at_salon: "Solo Tech (At Salon)",
    solo_at_solo: "Solo Tech (Solo Addr)",
  };

  // Load franchise registry
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/reference/franchise-registry", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          if (j.ok) {
            setFranchiseRegistry(j);
          }
        }
      } catch (e) {
        console.error("Failed to load franchise registry:", e);
      }
    })();
  }, []);

  // Build tree model from rollups data
  const buildTree = React.useCallback(async (category: AdminCategory): Promise<TreeNode[]> => {
    if (category === "corp_franchise") {
      // Fetch categorized facilities and build franchise-brand counts.
      try {
        const res = await fetch("/api/admin/dora/truth/facilities/index?category=corp_franchise&page=1&pageSize=500", { cache: "no-store" });
        if (!res.ok) return [];
        const j = await res.json();
        if (!j.ok || !j.rows) return [];

        const franchiseTree = buildFranchiseTree(
          (j.rows || []).map((r: any) => ({
            ...r,
            facilityId: r.addressKey || r.rollupKey || r.id,
          }))
        );
        
        // Enrich with display names from registry
        const enriched = franchiseTree.map((brand) => {
          const registryBrand = franchiseRegistry?.brands?.find(
            (b: any) => b.brandId === brand.brandId
          );
          return {
            kind: "franchise_brand" as const,
            id: brand.brandId,
            label: registryBrand?.displayName || brand.brandId,
            count: brand.count,
          };
        });

        setFranchiseBrands(enriched);
        return enriched;
      } catch (e) {
        console.error("Failed to build franchise tree:", e);
        return [];
      }
    }

    // For other categories, return empty for now
    return [];
  }, [franchiseRegistry]);

  const [treeData, setTreeData] = React.useState<TreeNode[]>([]);

  React.useEffect(() => {
    buildTree(state.category).then(setTreeData);
  }, [state.category, buildTree]);

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  const handleNodeClick = (node: TreeNode) => {
    onChange({
      ...state,
      node: { kind: node.kind, id: node.id },
    });
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="text-xs font-bold opacity-70 mb-2">Category</div>
        <div className="space-y-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onChange({ ...state, category: cat, node: undefined })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${
                state.category === cat
                  ? "bg-black text-white"
                  : "bg-neutral-100 hover:bg-neutral-200"
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-4">
        <div className="text-xs font-bold opacity-70 mb-2">Navigation</div>
        
        {/* PATCH 9a: Hardcoded navigation links */}
        <div className="space-y-1">
          <a
            href="/admin/vmb/tech"
            className="block w-full text-left px-3 py-2 rounded-lg text-sm font-bold bg-neutral-100 hover:bg-neutral-200"
          >
            Tech Targeting
          </a>
          <a
            href="/admin"
            className="block w-full text-left px-3 py-2 rounded-lg text-sm font-bold bg-neutral-100 hover:bg-neutral-200"
          >
            Facility Targeting
          </a>
          <a
            href="/admin/vmb/targets"
            className="block w-full text-left px-3 py-2 rounded-lg text-sm font-bold bg-neutral-100 hover:bg-neutral-200"
          >
            Target Lists
          </a>
        </div>

        {/* PATCH 2B: Show franchise brands for corp_franchise category */}
        {state.category === "corp_franchise" && franchiseBrands.length > 0 && (
          <div className="mb-2 mt-4">
            {franchiseBrands.map((brand, idx) => {
              const isSelected = state.node?.kind === "franchise_brand" && state.node?.id === brand.id;
              return (
                <button
                  key={`${brand.id}-${idx}`}
                  onClick={() =>
                    onChange({
                      ...state,
                      category: "corp_franchise",
                      node: { kind: "franchise_brand", id: brand.id },
                    })
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold mb-1 ${
                    isSelected
                      ? "bg-black text-white"
                      : "bg-neutral-100 hover:bg-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{brand.label}</span>
                    <span className="opacity-70">({brand.count})</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <TreeNodeList
          nodes={treeData}
          level={0}
          expanded={expanded}
          onToggle={toggleExpanded}
          onNodeClick={handleNodeClick}
          selectedId={state.node?.id}
        />
      </div>
    </div>
  );
}

function TreeNodeList({
  nodes,
  level,
  expanded,
  onToggle,
  onNodeClick,
  selectedId,
}: {
  nodes: TreeNode[];
  level: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNodeClick: (node: TreeNode) => void;
  selectedId?: string;
}) {
  if (nodes.length === 0) {
    return (
      <div className="text-xs opacity-50 italic pl-4">
        {level === 0 ? "Loading..." : "No items"}
      </div>
    );
  }

  return (
    <div>
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const isSelected = selectedId === node.id;

        return (
          <div key={node.id}>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${
                isSelected ? "bg-black text-white" : "hover:bg-neutral-100"
              }`}
              style={{ paddingLeft: `${8 + level * 16}px` }}
              onClick={() => onNodeClick(node)}
            >
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center"
                >
                  {isExpanded ? "▼" : "▶"}
                </button>
              )}
              {!hasChildren && <span className="w-4" />}
              <span className="flex-1 truncate">{node.label}</span>
              {node.count !== undefined && (
                <span className="opacity-70">({node.count})</span>
              )}
            </div>
            {hasChildren && isExpanded && (
              <TreeNodeList
                nodes={node.children!}
                level={level + 1}
                expanded={expanded}
                onToggle={onToggle}
                onNodeClick={onNodeClick}
                selectedId={selectedId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
