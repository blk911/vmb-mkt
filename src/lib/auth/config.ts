export function getAdminUser() {
  return process.env.MKT_ADMIN_USER || process.env.ADMIN_BASIC_USER || "";
}

export function getAdminPass() {
  return process.env.MKT_ADMIN_PASS || process.env.ADMIN_BASIC_PASS || "";
}

export function getSessionSecret() {
  return process.env.MKT_ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "";
}
