import { NextRequest, NextResponse } from "next/server";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";

// GET /api/letta/agents/[lettaId]/memory — List all memory blocks
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lettaId: string }> }
) {
  if (!isLettaEnabled() || !lettaClient) {
    return NextResponse.json({ error: "Letta not configured" }, { status: 503 });
  }

  try {
    const { lettaId } = await params;
    const blocksPage = await lettaClient.agents.blocks.list(lettaId);
    const blocks = [];
    for await (const b of blocksPage) {
      blocks.push({
        id: b.id,
        label: b.label,
        value: b.value,
        limit: b.limit,
        description: b.description,
        readOnly: b.read_only,
      });
    }

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[letta/memory] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to fetch memory blocks" }, { status: 500 });
  }
}
