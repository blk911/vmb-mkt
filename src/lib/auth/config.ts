export type ConfiguredAuthRole = "member" | "admin" | "external";

export type ConfiguredAuthUser = {
  username: string;
  password: string;
  role: ConfiguredAuthRole;
};

export function getAdminUser() {
  return process.env.MKT_ADMIN_USER || "";
}

export function getAdminPass() {
  return process.env.MKT_ADMIN_PASS || "";
}

export function getSessionSecret() {
  return process.env.MKT_ADMIN_SESSION_SECRET || "";
}

function normalizeRole(role: string): ConfiguredAuthRole {
  if (role === "admin") return "admin";
  if (role === "external") return "external";
  return "member";
}

export function getConfiguredAuthUsers(): ConfiguredAuthUser[] {
  const json = String(process.env.MKT_AUTH_USERS_JSON || "").trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as Array<{
        username?: string;
        password?: string;
        role?: string;
      }>;
      return parsed
        .map((entry) => ({
          username: String(entry?.username || "").trim(),
          password: String(entry?.password || ""),
          role: normalizeRole(String(entry?.role || "member").trim().toLowerCase()),
        }))
        .filter((entry) => entry.username && entry.password);
    } catch {
      return [];
    }
  }

  const adminUser = getAdminUser();
  const adminPass = getAdminPass();
  if (!adminUser || !adminPass) return [];
  return [{ username: adminUser, password: adminPass, role: "admin" }];
}

export function getConfiguredAuthUser(username: string) {
  const normalized = String(username || "").trim();
  if (!normalized) return null;
  return getConfiguredAuthUsers().find((entry) => entry.username === normalized) || null;
}
