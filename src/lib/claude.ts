import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-5-20250929";

/**
 * Send a conversation to Claude and return the response text.
 */
export async function chat(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : "";
}

/**
 * Takes a one-sentence agent description and returns an inferred config
 * with mission, identity, capabilities, etc.
 */
export async function inferFromDescription(
  description: string
): Promise<{
  name: string;
  config: Record<string, unknown>;
}> {
  const systemPrompt = `You are an AI agent configuration expert. Given a one-sentence description of an AI agent, infer a reasonable starting configuration.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "name": "Short Agent Name (1-3 words)",
  "config": {
    "mission": {
      "description": "one-line description under 100 chars",
      "tasks": ["task 1", "task 2", "task 3"],
      "exclusions": ["exclusion 1"],
      "audience": { "primary": "target users", "scope": "public" }
    },
    "identity": {
      "name": "Short Agent Name",
      "tone": "friendly|professional|casual|formal",
      "vibe": "1-2 sentence personality description",
      "greeting": "A sample greeting from the agent"
    },
    "capabilities": {
      "tools": [
        { "name": "Tool Name", "access": "read-only", "description": "what it does" }
      ]
    },
    "memory": {
      "strategy": "conversational",
      "remember": ["what to remember"],
      "daily_logs": true,
      "curated_memory": true,
      "max_memory_size": "500 lines"
    },
    "triggers": {
      "triggers": [
        { "type": "message", "description": "when it activates" }
      ]
    },
    "guardrails": {
      "behavioral": ["rule 1", "rule 2"],
      "prompt_injection_defense": "strict",
      "resource_limits": { "max_turns_per_session": 50, "escalation_threshold": 3 }
    }
  }
}

Be creative but practical. Infer reasonable defaults from the description. The name should be memorable and short.`;

  const response = await chat(systemPrompt, [
    { role: "user", content: description },
  ]);

  try {
    // Try to extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();
    }
    return JSON.parse(jsonStr);
  } catch {
    // If parsing fails, return a basic structure
    return {
      name: "New Agent",
      config: {
        mission: {
          description: description,
          tasks: [],
          exclusions: [],
          audience: { primary: "General users", scope: "public" },
        },
        identity: {
          name: "New Agent",
          tone: "friendly",
          vibe: "Helpful and knowledgeable",
        },
      },
    };
  }
}
