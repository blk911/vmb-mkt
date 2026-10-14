import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Target · Shared catalog" };

export default async function TargetPage({ searchParams }: { searchParams?: Promise<{ listId?: string }> }) {
  const params = await searchParams;
  return <CatalogWorkspace title="Target" initialListId={params?.listId} admin />;
}
