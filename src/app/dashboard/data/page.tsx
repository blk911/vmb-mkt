import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export const metadata = { title: "DataStore · Shared catalog" };

export default async function DataPage({ searchParams }: { searchParams?: Promise<{ listId?: string }> }) {
  const params = await searchParams;
  return <CatalogWorkspace title="DataStore" initialListId={params?.listId} />;
}
