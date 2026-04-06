import type { AgentOsClient } from "../api-client.js";

const WRITABLE_LABELS = new Set([
  "persona",
  "scratchpad",
  "decisions",
  "task_board",
  "brand",
  "project",
]);

function assertWritableLabel(label: string): string | null {
  if (!WRITABLE_LABELS.has(label)) {
    return JSON.stringify({
      error: `Block "${label}" is not writable through MCP tools`,
      hint: `Writable blocks: ${[...WRITABLE_LABELS].join(", ")}`,
    });
  }
  return null;
}

export async function handleGetMemoryBlocks(
  client: AgentOsClient,
  args: { letta_agent_id: string }
): Promise<string> {
  const blocks = await client.getMemoryBlocks(args.letta_agent_id);
  return JSON.stringify(
    blocks.map((b) => ({
      label: b.label,
      value: b.value,
      limit: b.limit,
      readOnly: b.readOnly,
      usage: `${b.value.length}/${b.limit}`,
    })),
    null,
    2
  );
}

export async function handleCoreMemoryReplace(
  client: AgentOsClient,
  args: { letta_agent_id: string; label: string; old_text: string; new_text: string }
): Promise<string> {
  const labelError = assertWritableLabel(args.label);
  if (labelError) return labelError;

  const block = await client.getMemoryBlock(args.letta_agent_id, args.label);

  if (block.readOnly) {
    return JSON.stringify({ error: `Block "${args.label}" is read-only` });
  }

  if (!block.value.includes(args.old_text)) {
    return JSON.stringify({
      error: `Text not found in block "${args.label}"`,
      hint: "Check the exact text — it must match character-for-character",
    });
  }

  const newValue = block.value.replace(args.old_text, args.new_text);

  if (newValue.length > block.limit) {
    return JSON.stringify({
      error: `Replacement would exceed block limit (${newValue.length}/${block.limit})`,
      hint: "Make the replacement shorter or remove other content first",
    });
  }

  const updated = await client.updateMemoryBlock(args.letta_agent_id, args.label, newValue);
  return JSON.stringify({
    success: true,
    label: updated.label,
    usage: `${updated.value.length}/${updated.limit}`,
  });
}

export async function handleCoreMemoryAppend(
  client: AgentOsClient,
  args: { letta_agent_id: string; label: string; text: string }
): Promise<string> {
  const labelError = assertWritableLabel(args.label);
  if (labelError) return labelError;

  const block = await client.getMemoryBlock(args.letta_agent_id, args.label);

  if (block.readOnly) {
    return JSON.stringify({ error: `Block "${args.label}" is read-only` });
  }

  const newValue = block.value + "\n" + args.text;

  if (newValue.length > block.limit) {
    return JSON.stringify({
      error: `Append would exceed block limit (${newValue.length}/${block.limit})`,
      hint: "Use core_memory_replace to update existing content, or store in archival memory",
    });
  }

  const updated = await client.updateMemoryBlock(args.letta_agent_id, args.label, newValue);
  return JSON.stringify({
    success: true,
    label: updated.label,
    usage: `${updated.value.length}/${updated.limit}`,
  });
}
