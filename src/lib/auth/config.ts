export function getAdminUser() {
  return process.env.MKT_ADMIN_USER || "";
}

export function getAdminPass() {
  return process.env.MKT_ADMIN_PASS || "";
}

export function getSessionSecret() {
  return process.env.MKT_ADMIN_SESSION_SECRET || "";
}
