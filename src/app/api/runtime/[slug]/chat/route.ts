import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lettaClient, isLettaEnabled } from "@/lib/letta/client";
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

    // Letta proxy path — if agent has a Letta backend, use it directly
    if (agent.lettaAgentId && isLettaEnabled() && lettaClient) {
      const lettaResponse = await lettaClient.agents.messages.create(
        agent.lettaAgentId,
        {
          messages: [{ role: "user", content: message }],
        }
      );

      // Extract the assistant response from the Letta message array
      let responseText = "";
      if (Array.isArray(lettaResponse)) {
        // Find the last message with role "assistant" or fall back to the last message's content
        for (let i = lettaResponse.length - 1; i >= 0; i--) {
          const msg = lettaResponse[i] as Record<string, unknown>;
          if (msg.role === "assistant" && msg.content) {
            responseText = String(msg.content);
            break;
          }
        }
        // Fallback: use the last message's content if no assistant message found
        if (!responseText && lettaResponse.length > 0) {
          const lastMsg = lettaResponse[lettaResponse.length - 1] as Record<string, unknown>;
          if (lastMsg.content) {
            responseText = String(lastMsg.content);
          }
        }
      }

      return NextResponse.json({
        message: {
          id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content: responseText,
          timestamp: new Date().toISOString(),
        },
        session: {
          token: "letta",
          turnCount: 0,
          status: "active",
          maxTurns: 999,
        },
      });
    }

    // Existing engine path below
    const deployment = await prisma.deployment.findFirst({
      where: { agentId: agent.id, status: "active" },
    });
    if (!deployment) {
      return NextResponse.json({ error: "Agent is not currently deployed" }, { status: 404 });
    }

    const config: AgentConfig = JSON.parse(deployment.config);

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
      deployment.systemPrompt,
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
