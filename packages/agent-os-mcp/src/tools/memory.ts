import type { AgentOsApiClient } from "../api-client.js";

export async function handleGetMemoryBlocks(
  client: AgentOsApiClient,
  lettaAgentId: string
): Promise<string> {
  const blocks = await client.getMemoryBlocks(lettaAgentId);

  if (blocks.length === 0) {
    return "No memory blocks found.";
  }

  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(`## ${block.label}`);
    lines.push(block.value);
    lines.push(`(${block.value.length}/${block.limit} chars)`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function handleCoreMemoryReplace(
  client: AgentOsApiClient,
  lettaAgentId: string,
  args: { label: string; old_value: string; new_value: string }
): Promise<string> {
  const block = await client.getMemoryBlock(lettaAgentId, args.label);

  if (!block.value.includes(args.old_value)) {
    return `Error: Could not find "${args.old_value}" in the ${args.label} block.`;
  }

  const newValue = block.value.replace(args.old_value, args.new_value);

  if (newValue.length > 10000) {
    return `Error: Replacement would exceed the 10,000 character limit (result: ${newValue.length} chars).`;
  }

  await client.updateMemoryBlock(lettaAgentId, args.label, newValue);
  return `Successfully updated ${args.label} block. Replaced "${args.old_value}" with "${args.new_value}".`;
}

export async function handleCoreMemoryAppend(
  client: AgentOsApiClient,
  lettaAgentId: string,
  args: { label: string; content: string }
): Promise<string> {
  const block = await client.getMemoryBlock(lettaAgentId, args.label);
  const newValue = block.value + "\n" + args.content;

  if (newValue.length > 10000) {
    return `Error: Append would exceed the 10,000 character limit (current: ${block.value.length}, adding: ${args.content.length + 1}).`;
  }

  await client.updateMemoryBlock(lettaAgentId, args.label, newValue);
  return `Successfully appended to ${args.label} block.`;
}
