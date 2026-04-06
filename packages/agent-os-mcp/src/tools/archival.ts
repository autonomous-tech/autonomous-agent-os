import type { AgentOsClient } from "../api-client.js";

export async function handleArchivalSearch(
  client: AgentOsClient,
  args: { letta_agent_id: string; query: string }
): Promise<string> {
  const result = await client.searchArchival(args.letta_agent_id, args.query);
  const passages = result.passages.map((p) => ({
    id: p.id,
    content: p.content || p.text,
    tags: p.tags,
  }));

  if (passages.length === 0) {
    return JSON.stringify({
      results: [],
      message: "No matching passages found in archival memory",
    });
  }

  return JSON.stringify({ results: passages, count: result.count ?? passages.length }, null, 2);
}

export async function handleArchivalInsert(
  client: AgentOsClient,
  args: { letta_agent_id: string; text: string; tags?: string[] }
): Promise<string> {
  if (args.text.length > 50000) {
    return JSON.stringify({
      error: "Text exceeds 50000 character limit",
      hint: "Break into smaller passages and insert separately",
    });
  }

  await client.insertArchival(args.letta_agent_id, args.text, args.tags);
  return JSON.stringify({
    success: true,
    message: "Stored in archival memory",
    length: args.text.length,
    tags: args.tags ?? [],
  });
}
