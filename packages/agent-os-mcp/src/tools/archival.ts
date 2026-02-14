import type { AgentOsApiClient } from "../api-client.js";

export async function handleArchivalSearch(
  client: AgentOsApiClient,
  lettaAgentId: string,
  args: { query: string }
): Promise<string> {
  const passages = await client.searchArchival(lettaAgentId, args.query);

  if (passages.length === 0) {
    return `No archival passages found for query: "${args.query}"`;
  }

  const lines: string[] = [`Found ${passages.length} passage(s):\n`];
  for (const p of passages) {
    const content = p.content || p.text || "";
    lines.push(`---`);
    lines.push(content);
    if (p.tags?.length) {
      lines.push(`Tags: ${p.tags.join(", ")}`);
    }
  }
  return lines.join("\n");
}

export async function handleArchivalInsert(
  client: AgentOsApiClient,
  lettaAgentId: string,
  args: { content: string }
): Promise<string> {
  if (args.content.length > 50000) {
    return "Error: Content exceeds the 50,000 character limit.";
  }

  await client.insertArchival(lettaAgentId, args.content);
  return "Successfully inserted into archival memory.";
}
