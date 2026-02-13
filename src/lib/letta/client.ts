import Letta from "@letta-ai/letta-client";

const globalForLetta = globalThis as unknown as {
  lettaClient: Letta | undefined;
};

/**
 * Singleton Letta client. Returns null if LETTA_BASE_URL is not configured,
 * allowing the app to fall back to the existing Claude-based runtime.
 */
function createLettaClient(): Letta | null {
  const baseUrl = process.env.LETTA_BASE_URL;
  if (!baseUrl) return null;

  return new Letta({
    baseURL: baseUrl,
    apiKey: process.env.LETTA_SERVER_PASSWORD ?? "letta",
  });
}

export const lettaClient: Letta | null =
  globalForLetta.lettaClient ?? createLettaClient();

if (process.env.NODE_ENV !== "production" && lettaClient) {
  globalForLetta.lettaClient = lettaClient;
}

/** Returns true if Letta is configured and available. */
export function isLettaEnabled(): boolean {
  return lettaClient !== null;
}
