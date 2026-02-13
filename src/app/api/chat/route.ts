import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/claude";
import type {
  AgentConfig,
  StageData,
  ConversationData,
  StageName,
  ChatMessage,
  ChatResponse,
} from "@/lib/types";
import { STAGES } from "@/lib/types";

import { BASE_SYSTEM_PROMPT, STAGE_PROMPTS } from "@/lib/prompts/index";

const MAX_MESSAGE_LENGTH = 10000;
const MAX_HISTORY_MESSAGES = 40; // 20 user + 20 assistant turns

// POST /api/chat -- send a message to Claude with stage context
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, stage, message } = body;

    if (!projectId || !stage || !message) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, stage, message" },
        { status: 400 }
      );
    }

    if (typeof projectId !== "string" || typeof stage !== "string" || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid field types" },
        { status: 400 }
      );
    }

    if (!STAGES.includes(stage as StageName)) {
      return NextResponse.json(
        { error: "Invalid stage name" },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` },
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
    const stages: StageData = JSON.parse(agent.stages);
    const conversations: ConversationData = JSON.parse(agent.conversations);

    const stageName = stage as StageName;

    // Build system prompt
    const stagePrompt = STAGE_PROMPTS[stageName] || "";
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

--- CURRENT STAGE: ${stageName.toUpperCase()} ---
${stagePrompt}

--- CURRENT PROJECT CONTEXT ---
Agent Name: ${config.identity?.name || agent.name || "Not yet named"}
Description: ${config.mission?.description || agent.description || "Not yet described"}
Current Config: ${JSON.stringify(config, null, 2)}
Stage Status: ${JSON.stringify(stages, null, 2)}

--- RESPONSE FORMAT ---
You MUST respond with ONLY valid JSON (no markdown, no code fences). Use this exact structure:
{
  "reply": "Your conversational response to the user",
  "previewUpdates": [
    { "field": "fieldName", "value": "new value or array" }
  ],
  "quickReplies": ["Option 1", "Option 2", "Option 3"],
  "stageStatus": "draft"
}

Rules for your response:
- "reply" is your conversational message (2-3 sentences typically)
- "previewUpdates" contains any changes to the current stage's config. Use field names matching the config structure for the ${stageName} section. Only include if something changed.
- "quickReplies" are 2-4 suggested quick responses the user can click
- "stageStatus" is "draft" if still collecting info, "approved" if the user has approved the stage configuration

For the ${stageName} stage, valid field names for previewUpdates are:
${getFieldNames(stageName)}`;

    // Build message history for this stage (cap to prevent unbounded growth)
    const stageHistory: ChatMessage[] = (conversations[stageName] || []).slice(-MAX_HISTORY_MESSAGES);
    const messages = [
      ...stageHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Call Claude
    const response = await chat(systemPrompt, messages);

    // Parse the response
    let parsed: ChatResponse;
    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      // If Claude doesn't return valid JSON, wrap the response
      parsed = {
        reply: response,
        previewUpdates: [],
        quickReplies: [],
        stageStatus: stages[stageName]?.status || "draft",
      };
    }

    // Save conversation history
    const updatedHistory: ChatMessage[] = [
      ...stageHistory,
      { role: "user", content: message },
      { role: "assistant", content: parsed.reply },
    ];
    conversations[stageName] = updatedHistory;

    // Apply preview updates to config
    if (parsed.previewUpdates && parsed.previewUpdates.length > 0) {
      const stageConfig = (config[stageName as keyof AgentConfig] || {}) as Record<string, unknown>;
      for (const update of parsed.previewUpdates) {
        stageConfig[update.field] = update.value;
      }
      (config as Record<string, unknown>)[stageName] = stageConfig;

      // Update name if identity name is set
      if (stageName === "identity" && stageConfig.name) {
        await prisma.agentProject.update({
          where: { id: projectId },
          data: { name: stageConfig.name as string },
        });
      }
    }

    // Update stage status
    if (parsed.stageStatus) {
      stages[stageName] = {
        ...stages[stageName],
        status: parsed.stageStatus,
      };
    }

    // Persist changes
    await prisma.agentProject.update({
      where: { id: projectId },
      data: {
        config: JSON.stringify(config),
        stages: JSON.stringify(stages),
        conversations: JSON.stringify(conversations),
        status: "building",
      },
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Chat error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

function getFieldNames(stage: StageName): string {
  const fieldMap: Record<StageName, string> = {
    mission:
      '- "description": one-line description\n- "tasks": array of key tasks\n- "exclusions": array of exclusions\n- "audience": { "primary": "...", "scope": "owner-only|team|public" }',
    identity:
      '- "name": agent name\n- "emoji": optional emoji\n- "vibe": personality description\n- "tone": communication tone\n- "greeting": sample greeting',
    capabilities:
      '- "tools": array of { "name": "...", "access": "read-only|write|full", "description": "..." }',
    memory:
      '- "strategy": "conversational|task-based|minimal"\n- "remember": array of what to remember',
    triggers:
      '- "triggers": array of { "type": "message|event|schedule", "description": "...", "channels": ["..."], "source": "..." }',
    guardrails:
      '- "behavioral": array of behavioral rules\n- "prompt_injection_defense": "strict|moderate|none"\n- "resource_limits": { "max_turns_per_session": number, "escalation_threshold": number }',
  };
  return fieldMap[stage];
}
