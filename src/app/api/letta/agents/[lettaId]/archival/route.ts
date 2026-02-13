import { NextRequest, NextResponse } from "next/server";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";

// GET /api/letta/agents/[lettaId]/archival — Search archival memory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lettaId: string }> }
) {
  if (!isLettaEnabled() || !lettaClient) {
    return NextResponse.json({ error: "Letta not configured" }, { status: 503 });
  }

  try {
    const { lettaId } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (query) {
      // Semantic search
      const result = await lettaClient.agents.passages.search(lettaId, { query });
      return NextResponse.json({
        passages: result.results.map((r) => ({
          id: r.id,
          content: r.content,
          timestamp: r.timestamp,
          tags: r.tags,
        })),
        count: result.count,
      });
    }

    // List all (paginated)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const passagesPage = await lettaClient.agents.passages.list(lettaId, { limit });
    const passages = [];
    for await (const p of passagesPage) {
      passages.push({
        id: p.id,
        text: p.text,
        created_at: p.created_at,
        tags: p.tags,
      });
    }

    return NextResponse.json({ passages });
  } catch (error) {
    console.error("[letta/archival] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to search archival memory" }, { status: 500 });
  }
}

// POST /api/letta/agents/[lettaId]/archival — Insert into archival memory
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lettaId: string }> }
) {
  if (!isLettaEnabled() || !lettaClient) {
    return NextResponse.json({ error: "Letta not configured" }, { status: 503 });
  }

  try {
    const { lettaId } = await params;
    const body = await request.json();

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json({ error: "Missing or invalid text" }, { status: 400 });
    }
    if (body.text.length > 50000) {
      return NextResponse.json({ error: "Text exceeds 50000 character limit" }, { status: 400 });
    }

    const passages = await lettaClient.agents.passages.create(lettaId, {
      text: body.text,
      ...(body.tags ? { tags: body.tags } : {}),
    });

    return NextResponse.json({ passages }, { status: 201 });
  } catch (error) {
    console.error("[letta/archival] Insert error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to insert into archival memory" }, { status: 500 });
  }
}
