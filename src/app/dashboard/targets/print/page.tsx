import CatalogPrint from "@/components/catalog/CatalogPrint";

export default async function TargetsPrintPage({ searchParams }: { searchParams?: Promise<{ listId?: string }> }) {
  const params = await searchParams;
  return <CatalogPrint listId={params?.listId || ""} />;
}
