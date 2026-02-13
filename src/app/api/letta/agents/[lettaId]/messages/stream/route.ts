import { NextRequest, NextResponse } from "next/server";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
import { lettaToStreamEvent, encodeSSE } from "@/lib/letta/messages";
import type { StreamEvent } from "@/lib/letta/messages";

const MAX_MESSAGE_LENGTH = 10000;

// POST /api/letta/agents/[lettaId]/messages/stream — SSE streaming chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lettaId: string }> }
): Promise<Response> {
  if (!isLettaEnabled() || !lettaClient) {
    return NextResponse.json({ error: "Letta not configured" }, { status: 503 });
  }

  const { lettaId } = await params;

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message } = body;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds ${MAX_MESSAGE_LENGTH} character limit` },
      { status: 400 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastMessageId = "";

      try {
        const lettaStream = await lettaClient!.agents.messages.create(lettaId, {
          messages: [{ role: "user", content: message }],
          streaming: true,
          stream_tokens: true,
        });

        for await (const chunk of lettaStream) {
          const event = lettaToStreamEvent(chunk as Record<string, unknown>);
          if (event) {
            if (
              event.type === "text" &&
              (chunk as { id?: string }).id
            ) {
              lastMessageId = (chunk as { id?: string }).id ?? "";
            }
            controller.enqueue(encoder.encode(encodeSSE(event)));
          }
        }

        const doneEvent: StreamEvent = { type: "done", messageId: lastMessageId };
        controller.enqueue(encoder.encode(encodeSSE(doneEvent)));
      } catch (error) {
        console.error("[letta/stream] Error:", error);
        const errorEvent: StreamEvent = {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        };
        controller.enqueue(encoder.encode(encodeSSE(errorEvent)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
