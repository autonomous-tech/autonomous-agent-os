import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isLettaEnabled } from "@/lib/letta/client";
import { hydrateSystemPromptWithMemory } from "@/lib/letta/memory";
import { syncSessionMemory } from "@/lib/letta/memory-extract";
import type { AgentConfig } from "@/lib/types";
import type { RuntimeMessage } from "@/lib/runtime/types";
import type { McpServerDefinition } from "@/lib/runtime/tools.types";
import { processMessage } from "@/lib/runtime/engine";

// POST /api/runtime/[slug]/chat — Public runtime chat endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { message, sessionToken } = body;

    // Input validation
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
    }
    if (message.length > 10000) {
      return NextResponse.json({ error: "Message exceeds maximum length" }, { status: 400 });
    }

    // Look up active deployment by slug
    const agent = await prisma.agentProject.findUnique({ where: { slug } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // All chat goes through the Claude engine
    const deployment = await prisma.deployment.findFirst({
      where: { agentId: agent.id, status: "active" },
    });
    if (!deployment) {
      return NextResponse.json({ error: "Agent is not currently deployed" }, { status: 404 });
    }

    const config: AgentConfig = JSON.parse(deployment.config);

    // Hydrate system prompt with Letta memory if available
    let systemPrompt = deployment.systemPrompt;
    if (agent.lettaAgentId && isLettaEnabled()) {
      systemPrompt = await hydrateSystemPromptWithMemory(systemPrompt, agent.lettaAgentId);
    }

    // Parse MCP server definitions from the deployment snapshot
    let mcpServers: McpServerDefinition[] = [];
    try {
      if (deployment.mcpConfig) {
        mcpServers = JSON.parse(deployment.mcpConfig);
      }
    } catch (err) {
      console.error(
        `[runtime/chat] Deployment ${deployment.id}: Failed to parse mcpConfig. Agent will operate without tools.`,
        err instanceof Error ? err.message : err
      );
      mcpServers = [];
    }

    // Find or create session
    let session;
    let isNewSession = false;

    if (sessionToken && typeof sessionToken === "string") {
      session = await prisma.chatSession.findUnique({
        where: { token: sessionToken },
      });
    }

    if (!session) {
      const token = generateSessionToken();
      session = await prisma.chatSession.create({
        data: {
          deploymentId: deployment.id,
          token,
          messages: "[]",
          turnCount: 0,
          failedAttempts: 0,
          status: "active",
          metadata: "{}",
        },
      });
      isNewSession = true;
    }

    // Parse existing messages
    const history: RuntimeMessage[] = JSON.parse(session.messages);

    // Process the message through the runtime engine
    const result = await processMessage(
      systemPrompt,
      config,
      session.status,
      session.turnCount,
      session.failedAttempts,
      history,
      message,
      mcpServers.length > 0 ? mcpServers : undefined
    );

    // Build the user message to persist
    const userMsg: RuntimeMessage = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Update session in database
    const updatedMessages = [...history, userMsg, result.response];
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        messages: JSON.stringify(updatedMessages),
        turnCount: result.sessionUpdates.turnCount,
        failedAttempts: result.sessionUpdates.failedAttempts,
        status: result.sessionUpdates.status,
      },
    });

    // Log tool executions if any occurred
    if (result.toolExecutions && result.toolExecutions.length > 0) {
      await prisma.toolExecutionLog.createMany({
        data: result.toolExecutions.map((exec) => ({
          sessionId: session.id,
          deploymentId: deployment.id,
          toolName: exec.toolName,
          serverName: exec.serverName,
          input: JSON.stringify(exec.input),
          output: exec.output,
          isError: exec.isError,
          durationMs: exec.durationMs,
        })),
      });
    }

    // Sync memory to Letta periodically (every 10 turns or at session end)
    const turnCount = result.sessionUpdates.turnCount;
    const sessionEnding = result.sessionUpdates.status !== "active";
    if (agent.lettaAgentId && isLettaEnabled() && (sessionEnding || turnCount % 10 === 0)) {
      // Fire-and-forget — don't block the response
      const recentMessages = updatedMessages.slice(-20).map((m) => `${m.role}: ${m.content}`).join("\n");
      syncSessionMemory(agent.lettaAgentId, { summary: recentMessages }).catch((err) => {
        console.error("[runtime/chat] Memory sync failed (non-blocking):", err instanceof Error ? err.message : err);
      });
    }

    // Build response
    const maxTurns = config.guardrails?.resource_limits?.max_turns_per_session ?? 50;
    const responseBody: Record<string, unknown> = {
      message: result.response,
      session: {
        token: session.token,
        turnCount: result.sessionUpdates.turnCount,
        status: result.sessionUpdates.status,
        maxTurns,
      },
    };

    if (result.toolExecutions && result.toolExecutions.length > 0) {
      responseBody.toolsUsed = result.toolExecutions.map((exec) => exec.toolName);
    }

    if (result.guardrailNotice) {
      responseBody.guardrailNotice = result.guardrailNotice;
    }

    const response = NextResponse.json(responseBody);

    // Set session cookie for new sessions
    if (isNewSession) {
      response.cookies.set("agent_session", session.token, {
        httpOnly: true,
        sameSite: "lax",
        path: `/a/${slug}`,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    return response;
  } catch (error) {
    console.error("Runtime chat error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}

function generateSessionToken(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
