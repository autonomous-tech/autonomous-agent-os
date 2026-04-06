export interface McpConfig {
  baseUrl: string;
  defaultSlug?: string;
}

function validateBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid --url value: "${raw}" is not a valid URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid --url protocol: only http: and https: are allowed, got "${parsed.protocol}"`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const blockedHosts = ["169.254.169.254", "metadata.google.internal", "[fd00:ec2::254]"];
  if (blockedHosts.includes(hostname)) {
    throw new Error(`Invalid --url: "${hostname}" is a blocked metadata endpoint`);
  }

  return parsed.origin;
}

export function parseConfig(argv: string[] = process.argv.slice(2)): McpConfig {
  let baseUrl = process.env.AGENT_OS_URL ?? "http://localhost:3000";
  let defaultSlug: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--url" || arg === "-u") && argv[i + 1]) {
      baseUrl = argv[++i];
    } else if ((arg === "--agent" || arg === "-a") && argv[i + 1]) {
      defaultSlug = argv[++i];
    } else if (arg.startsWith("--url=")) {
      baseUrl = arg.split("=")[1];
    } else if (arg.startsWith("--agent=")) {
      defaultSlug = arg.split("=")[1];
    }
  }

  baseUrl = validateBaseUrl(baseUrl.replace(/\/+$/, ""));

  return { baseUrl, defaultSlug };
}
