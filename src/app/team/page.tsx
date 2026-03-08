import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUserFromCookies } from "@/lib/auth/access";

const TEAM_APP_ROOT = "https://vmb-team-planner.vercel.app/";
const TEAM_ADMIN_ROOT = "https://vmb-team-planner.vercel.app/admin";

export default async function TeamPage() {
  const cookieStore = await cookies();
  const sessionUser = await getSessionUserFromCookies(cookieStore);
  if (!sessionUser) {
    redirect("/auth/login?next=/team");
  }

  redirect(sessionUser.role === "admin" ? TEAM_ADMIN_ROOT : TEAM_APP_ROOT);
}
