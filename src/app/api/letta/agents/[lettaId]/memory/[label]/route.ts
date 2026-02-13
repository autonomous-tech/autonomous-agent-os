import { NextRequest, NextResponse } from "next/server";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";

// GET /api/letta/agents/[lettaId]/memory/[label] — Get specific block
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lettaId: string; label: string }> }
) {
  if (!isLettaEnabled() || !lettaClient) {
    return NextResponse.json({ error: "Letta not configured" }, { status: 503 });
  }

  try {
    const { lettaId, label } = await params;
    const block = await lettaClient.agents.blocks.retrieve(label, {
      agent_id: lettaId,
    });

    return NextResponse.json({
      id: block.id,
      label: block.label,
      value: block.value,
      limit: block.limit,
      description: block.description,
      readOnly: block.read_only,
    });
  } catch (error) {
    console.error("[letta/memory/label] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to fetch memory block" }, { status: 500 });
  }
}

// PUT /api/letta/agents/[lettaId]/memory/[label] — Update block content
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ lettaId: string; label: string }> }
) {
  if (!isLettaEnabled() || !lettaClient) {
    return NextResponse.json({ error: "Letta not configured" }, { status: 503 });
  }

  try {
    const { lettaId, label } = await params;
    const body = await request.json();

    if (!body.value || typeof body.value !== "string") {
      return NextResponse.json({ error: "Missing or invalid value" }, { status: 400 });
    }
    if (body.value.length > 10000) {
      return NextResponse.json({ error: "Value exceeds 10000 character limit" }, { status: 400 });
    }

    const updated = await lettaClient.agents.blocks.update(label, {
      agent_id: lettaId,
      value: body.value,
    });

    return NextResponse.json({
      id: updated.id,
      label: updated.label,
      value: updated.value,
      limit: updated.limit,
    });
  } catch (error) {
    console.error("[letta/memory/label] Update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to update memory block" }, { status: 500 });
  }
}
