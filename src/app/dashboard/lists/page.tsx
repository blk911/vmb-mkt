import CatalogWorkspace from "@/components/catalog/CatalogWorkspace";

export const metadata = { title: "Lists · Shared catalog" };

export default async function ListsPage({ searchParams }: { searchParams?: Promise<{ listId?: string }> }) {
  const params = await searchParams;
  return <CatalogWorkspace title="Working lists" initialView="lists" initialListId={params?.listId} />;
}
