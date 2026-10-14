import { cookies } from "next/headers";
import { getSessionUserFromCookies } from "@/lib/auth/access";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUserFromCookies(await cookies());
  return <DashboardShell member={sessionUser?.role !== "admin"}>{children}</DashboardShell>;
}
