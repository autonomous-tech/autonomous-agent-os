export interface ServerConfig {
  agentOsUrl: string;
  agentSlug: string;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseConfig(): ServerConfig {
  const args = process.argv.slice(2);
  let agentOsUrl = process.env.AGENT_OS_URL || "http://localhost:3000";
  let agentSlug = process.env.AGENT_OS_AGENT || "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      agentOsUrl = args[++i];
    } else if (args[i] === "--agent" && args[i + 1]) {
      agentSlug = args[++i];
    }
  }

  if (!isValidUrl(agentOsUrl)) {
    throw new Error(`Invalid Agent OS URL: ${agentOsUrl}`);
  }

  if (!agentSlug) {
    throw new Error("Agent slug is required. Use --agent <slug> or set AGENT_OS_AGENT env var.");
  }

  return { agentOsUrl, agentSlug };
}
