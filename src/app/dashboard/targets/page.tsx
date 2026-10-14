import TargetsClient from "./TargetsClient";

export const metadata = { title: "Targets · Shared catalog" };

export default async function TargetsPage({ searchParams }: { searchParams?: Promise<{ listId?: string }> }) {
  const params = await searchParams;
  return <TargetsClient initialListId={params?.listId} />;
}
