import TargetsClient from "./TargetsClient";

export const metadata = {
  title: "Targets — Tech First",
};

export default function TargetsPage({ searchParams }: { searchParams: { listId?: string } }) {
  return <TargetsClient initialListId={searchParams?.listId} />;
}
