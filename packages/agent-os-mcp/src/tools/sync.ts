import type { AgentOsApiClient } from "../api-client.js";

export async function handleSyncSession(
  client: AgentOsApiClient,
  agentId: string,
  args: { summary: string }
): Promise<string> {
  const result = await client.syncSession(agentId, args.summary);

  if (result.success) {
    return "Session memory synced successfully.";
  }
  return "Session sync completed but no learnings were extracted.";
}
