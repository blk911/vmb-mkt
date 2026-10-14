"use client";

import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export default function TargetsClient({ initialListId }: { initialListId?: string }) {
  return <CatalogWorkspace title="Targets" initialListId={initialListId} />;
}
