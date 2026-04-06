export type FetchedPage = {
  finalUrl: string;
  statusCode: number;
  html: string;
  contentType: string;
};

const SUPPORTED_DOMAIN_HINTS = [
  "instagram.com",
  "yelp.com",
  "glossgenius.com",
  "vagaro.com",
  "styleseat.com",
  "booksy.com",
  "fresha.com",
  "square.site",
  "phenixsalonsuites.com",
  "solasalonstudios.com",
  "mysalonsuite.com",
  "salonlofts.com",
];

function parseHttpUrl(input: string): URL | undefined {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function hostIsSupported(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SUPPORTED_DOMAIN_HINTS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
  return !host.includes("google.");
}

export async function fetchCandidatePage(url: string, timeoutMs = 12000): Promise<FetchedPage> {
  const parsed = parseHttpUrl(url);
  if (!parsed || !hostIsSupported(parsed.hostname)) {
    return {
      finalUrl: url,
      statusCode: 0,
      html: "",
      contentType: "",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "vmb-operator-acquisition/1.0",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("text/html") || contentType.includes("application/ld+json")
      ? (await response.text()).slice(0, 500_000)
      : "";

    return {
      finalUrl: response.url || parsed.toString(),
      statusCode: response.status,
      html: body,
      contentType,
    };
  } catch {
    return {
      finalUrl: parsed.toString(),
      statusCode: 0,
      html: "",
      contentType: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

