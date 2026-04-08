export type ContainerStrategyName = "sola" | "phenix" | "mysalonsuite" | "solera" | "spectra";

export type ContainerRegistryEntry = {
  brand: string;
  domains: string[];
  strategy: ContainerStrategyName;
};

const CONTAINER_REGISTRY: ContainerRegistryEntry[] = [
  {
    brand: "sola",
    domains: ["solasalons.com", "solasalonstudios.com"],
    strategy: "sola",
  },
  {
    brand: "phenix",
    domains: ["phenixsalonsuites.com"],
    strategy: "phenix",
  },
  {
    brand: "mysalonsuite",
    domains: ["mysalonsuite.com"],
    strategy: "mysalonsuite",
  },
  {
    brand: "solera",
    domains: ["solerasalons.com"],
    strategy: "solera",
  },
  {
    brand: "spectra",
    domains: ["spectrasalons.com"],
    strategy: "spectra",
  },
];

function matchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const target = domain.toLowerCase();
  return host === target || host.endsWith(`.${target}`);
}

export function getContainerRegistry(): ContainerRegistryEntry[] {
  return CONTAINER_REGISTRY;
}

export function getContainerRegistryEntry(url: string): ContainerRegistryEntry | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return CONTAINER_REGISTRY.find((entry) => entry.domains.some((domain) => matchesDomain(host, domain)));
  } catch {
    return undefined;
  }
}

export function isContainerDomain(url: string): boolean {
  return Boolean(getContainerRegistryEntry(url));
}
