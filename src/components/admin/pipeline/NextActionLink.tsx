import Link from "next/link";

export default function NextActionLink({ href, text }: { href: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">Next</div>
      <Link className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline" href={href}>
        {text}
      </Link>
    </div>
  );
}
