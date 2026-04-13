export function SimilarityReasonsList({ reasons }: { reasons: string[] }) {
  if (!reasons.length) {
    return <div className="text-sm text-neutral-500">No similarity reasons recorded.</div>;
  }

  return (
    <ul className="grid gap-1 text-sm text-neutral-700">
      {reasons.map((reason) => (
        <li key={reason}>- {reason}</li>
      ))}
    </ul>
  );
}
