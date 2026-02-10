import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/claude";
import type { AgentConfig } from "@/lib/types";
import { getTools } from "@/lib/types";

// POST /api/test -- test agent in sandbox (Claude role-plays as the agent)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, message, conversationHistory } = body;

    if (!projectId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, message" },
        { status: 400 }
      );
    }

    if (typeof projectId !== "string" || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid field types" },
        { status: 400 }
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: "Message exceeds maximum length" },
        { status: 400 }
      );
    }

    const agent = await prisma.agentProject.findUnique({
      where: { id: projectId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const config: AgentConfig = JSON.parse(agent.config);
    const { identity, mission, guardrails } = config;
    const tools = getTools(config);

    // Build a system prompt that makes Claude role-play as the agent
    const agentName = identity?.name || agent.name || "Agent";
    const systemPrompt = `You are ${agentName}. You are role-playing as this AI agent for testing purposes. Stay completely in character.

IDENTITY:
- Name: ${agentName}
- Tone: ${identity?.tone || "friendly"}
- Vibe: ${identity?.vibe || "Helpful and professional"}
- Greeting: ${identity?.greeting || `Hi! I'm ${agentName}. How can I help?`}

MISSION:
${mission?.description || "General purpose assistant"}
${mission?.tasks ? `Key Tasks:\n${mission.tasks.map((t) => `- ${t}`).join("\n")}` : ""}
${mission?.exclusions ? `Exclusions (NEVER do these):\n${mission.exclusions.map((e) => `- ${e}`).join("\n")}` : ""}

CAPABILITIES:
${tools.length > 0
    ? tools.map((t) => `- ${t.name} (${t.access}): ${t.description}`).join("\n")
    : "No specific tools configured."}

GUARDRAILS:
${guardrails?.behavioral ? guardrails.behavioral.map((g) => `- ${g}`).join("\n") : "- Follow general safety guidelines"}

IMPORTANT:
- Stay in character as ${agentName} at all times
- Use the specified tone and personality
- Respect all guardrails and exclusions
- If asked about something outside your mission, politely redirect
- Keep responses concise (2-4 sentences typically)

Respond as ${agentName} would. Do NOT break character. Do NOT mention that you are Claude or that this is a test.

After your response, on a new line, add a JSON metadata block wrapped in <metadata> tags:
<metadata>
{
  "capabilitiesUsed": ["list of capability IDs used in this response"],
  "guardrailsActive": ["list of guardrails that influenced this response"],
  "tone": "${identity?.tone || "friendly"}"
}
</metadata>`;

    // Build message history (cap to prevent unbounded growth)
    const rawHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
    const history = rawHistory.slice(-40).map(
      (m: { role: string; content: string }) => ({
        role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })
    );

    const messages = [...history, { role: "user" as const, content: message }];

    const response = await chat(systemPrompt, messages);

    // Parse response and extract metadata
    let content = response;
    let metadata = {
      capabilitiesUsed: [] as string[],
      guardrailsActive: [] as string[],
      tone: identity?.tone || "friendly",
    };

    const metadataMatch = response.match(/<metadata>\s*([\s\S]*?)\s*<\/metadata>/);
    if (metadataMatch) {
      content = response.replace(/<metadata>[\s\S]*?<\/metadata>/, "").trim();
      try {
        metadata = JSON.parse(metadataMatch[1]);
      } catch {
        // Keep default metadata
      }
    }

    return NextResponse.json({
      role: "agent",
      content,
      metadata,
    });
  } catch (error) {
    console.error("Test error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to test agent" },
      { status: 500 }
    );
  }
}
