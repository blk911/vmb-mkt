export async function validateUrl(url?: string): Promise<"valid" | "dead" | "missing"> {
  if (!url) return "missing";
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.status >= 200 && res.status < 400) return "valid";
    return "dead";
  } catch {
    return "dead";
  }
}

export async function validateInstagram(url?: string) {
  return validateUrl(url);
}

export async function validateBooking(url?: string) {
  return validateUrl(url);
}

export async function validateWebsite(url?: string) {
  return validateUrl(url);
}
