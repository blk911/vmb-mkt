export const REQUESTED_ACCESS_ROLES = ["external", "member"] as const;

export type RequestedAccessRole = (typeof REQUESTED_ACCESS_ROLES)[number];

export type AccessRequestInput = {
  name?: string;
  email?: string;
  organization?: string;
  requestedRole?: string;
  notes?: string;
};

export type AccessRequestForm = {
  name: string;
  email: string;
  organization: string;
  requestedRole: RequestedAccessRole;
  notes: string;
};

export type AccessRequestValidation =
  | { ok: true; value: AccessRequestForm }
  | { ok: false; error: string };

function compact(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function validateAccessRequest(input: AccessRequestInput): AccessRequestValidation {
  const name = compact(input.name, 120);
  const email = compact(input.email, 160).toLowerCase();
  const organization = compact(input.organization, 160);
  const requestedRole = compact(input.requestedRole, 32);
  const notes = compact(input.notes, 1200);

  if (!name) return { ok: false, error: "missing_name" };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "invalid_email" };
  if (!organization) return { ok: false, error: "missing_organization" };

  const normalizedRole = REQUESTED_ACCESS_ROLES.includes(requestedRole as RequestedAccessRole)
    ? (requestedRole as RequestedAccessRole)
    : "external";

  return {
    ok: true,
    value: {
      name,
      email,
      organization,
      requestedRole: normalizedRole,
      notes,
    },
  };
}
