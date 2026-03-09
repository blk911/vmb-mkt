import { redirect } from "next/navigation";

function sanitizeNextPath(nextPath?: string) {
  const value = String(nextPath || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "";
  }
  if (value === "/auth/login" || value.startsWith("/auth/login?")) {
    return "";
  }
  return value;
}

export default function AdminLoginRedirectPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextPath = sanitizeNextPath(searchParams?.next);
  redirect(nextPath ? `/auth/login?next=${encodeURIComponent(nextPath)}` : "/auth/login");
}
