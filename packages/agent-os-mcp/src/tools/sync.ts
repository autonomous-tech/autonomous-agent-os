import type { AgentOsClient } from "../api-client.js";

export async function handleSyncSession(
  client: AgentOsClient,
  args: {
    agent_slug: string;
    summary: string;
    decisions?: string[];
    preferences?: string[];
    knowledge?: string[];
    task_updates?: string[];
  }
): Promise<string> {
  const agent = await client.getAgentBySlug(args.agent_slug);

  const result = await client.syncSession(agent.id, {
    summary: args.summary,
    decisions: args.decisions,
    preferences: args.preferences,
    knowledge: args.knowledge,
    taskUpdates: args.task_updates,
  });

  return JSON.stringify({
    success: true,
    message: "Session synced — memory updated",
    persisted: result.persisted,
  }, null, 2);
}
