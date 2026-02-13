import type { RuntimeMessage } from "@/lib/runtime/types";

/**
 * SSE event types we send to the frontend from our proxy.
 */
export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_call"; name: string; arguments: string; id: string }
  | { type: "tool_result"; result: string; status: "success" | "error"; id: string }
  | { type: "memory_update"; label: string; action: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

/**
 * Convert a Letta streaming message into our RuntimeMessage format.
 * Only converts user and assistant messages — tool calls and reasoning
 * are handled separately in the streaming path.
 */
export function lettaToRuntimeMessage(msg: {
  id: string;
  message_type?: string;
  content?: string | unknown[];
  date?: string;
}): RuntimeMessage | null {
  const msgType = msg.message_type;
  if (msgType === "user_message" || msgType === "assistant_message") {
    return {
      id: msg.id,
      role: msgType === "user_message" ? "user" : "assistant",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      timestamp: msg.date ?? new Date().toISOString(),
    };
  }
  return null;
}

/**
 * Convert a Letta streaming response chunk into an SSE StreamEvent for the frontend.
 * Handles all Letta streaming message types including pings and stop reasons.
 */
export function lettaToStreamEvent(chunk: {
  id?: string;
  message_type?: string;
  content?: string | unknown[];
  reasoning?: string;
  tool_call?: { name: string; arguments: string; tool_call_id: string };
  tool_calls?: unknown[];
  tool_return?: string | unknown[];
  status?: string;
  tool_call_id?: string;
}): StreamEvent | null {
  const msgType = chunk.message_type;

  switch (msgType) {
    case "assistant_message": {
      const content = chunk.content;
      if (!content) return null;
      return {
        type: "text",
        content: typeof content === "string" ? content : JSON.stringify(content),
      };
    }

    case "reasoning_message": {
      if (!chunk.reasoning) return null;
      return {
        type: "reasoning",
        content: chunk.reasoning,
      };
    }

    case "tool_call_message": {
      const toolCall = chunk.tool_call;
      if (!toolCall) return null;

      // Detect memory mutation tools for UI indicators
      if (isMemoryTool(toolCall.name)) {
        return {
          type: "memory_update",
          label: extractMemoryLabel(toolCall.name, toolCall.arguments),
          action: toolCall.name,
        };
      }
      return {
        type: "tool_call",
        name: toolCall.name,
        arguments: toolCall.arguments,
        id: toolCall.tool_call_id,
      };
    }

    case "tool_return_message": {
      const result = typeof chunk.tool_return === "string"
        ? chunk.tool_return
        : JSON.stringify(chunk.tool_return);
      return {
        type: "tool_result",
        result,
        status: (chunk.status === "success" || chunk.status === "error") ? chunk.status : "success",
        id: chunk.tool_call_id ?? "",
      };
    }

    // Ignore pings, stop reasons, usage stats, system messages
    default:
      return null;
  }
}

/** Encode an SSE event as a string for writing to a ReadableStream. */
export function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Check if a tool name is a Letta built-in memory tool. */
function isMemoryTool(name: string): boolean {
  return [
    "core_memory_append",
    "core_memory_replace",
    "archival_memory_insert",
    "archival_memory_search",
  ].includes(name);
}

/** Extract the memory block label from tool arguments. */
function extractMemoryLabel(toolName: string, argsJson: string): string {
  try {
    const args = JSON.parse(argsJson);
    if (args.label) return args.label;
    if (args.name) return args.name;
    if (toolName.startsWith("archival_")) return "archival";
    return "unknown";
  } catch {
    return "unknown";
  }
}
