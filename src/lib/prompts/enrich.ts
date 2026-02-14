import type { AgentConfig } from "@/lib/types";

const SECTION_CONTEXT: Record<string, string> = {
  identity: `You are reviewing the Identity section of an AI agent configuration.
Focus on: name clarity, vibe/personality consistency, tone appropriateness, greeting quality.
Suggest improvements that make the agent more memorable and distinctive.`,

  purpose: `You are reviewing the Purpose section of an AI agent configuration.
Focus on: description clarity (should be 1-3 sentences), task completeness (2-5 tasks), task specificity.
Suggest concrete tasks the user may have missed based on the description.`,

  audience: `You are reviewing the Audience section of an AI agent configuration.
Focus on: audience specificity, scope appropriateness for the use case.
Only suggest if audience details are vague or missing.`,

  workflow: `You are reviewing the Workflow section (capabilities + triggers) of an AI agent configuration.
Focus on: capability completeness, appropriate access levels, trigger relevance.
Suggest capabilities that align with the agent's tasks and mission.`,

  memory: `You are reviewing the Memory Protocol section of an AI agent configuration.
Focus on: strategy appropriateness for the use case, what-to-remember completeness.
Suggest memory items based on the agent's mission and capabilities.`,

  boundaries: `You are reviewing the Boundaries section of an AI agent configuration.
Focus on: rule clarity, completeness, contradiction detection with other sections.
Suggest guardrails that protect against common failure modes for this type of agent.`,
};

export function buildEnrichmentPrompt(
  section: string,
  sectionData: Record<string, unknown>,
  fullConfig: AgentConfig
): string {
  const context = SECTION_CONTEXT[section] || "You are reviewing an AI agent configuration section.";

  return `${context}

Current section data:
${JSON.stringify(sectionData, null, 2)}

Full agent config (for cross-reference):
${JSON.stringify(fullConfig, null, 2)}

Generate genuinely useful feedback. No filler. Cross-reference other sections for consistency.
Only generate suggestions/ideas/questions when they add real value.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "suggestions": [
    {
      "field": "fieldName",
      "original": "what the user wrote",
      "improved": "better version",
      "reason": "why this is better (1 sentence)"
    }
  ],
  "ideas": [
    {
      "type": "task|capability|trigger|guardrail|remember",
      "value": "the suggested item (string for simple items, object for capabilities/triggers)",
      "reason": "why this would help (1 sentence)"
    }
  ],
  "questions": [
    {
      "question": "What you need to know",
      "options": ["Option A", "Option B", "Option C"],
      "affects": ["fieldName1", "fieldName2"],
      "reason": "why this matters (1 sentence)"
    }
  ]
}

Rules:
- Return empty arrays for categories with no feedback
- Maximum 2 suggestions, 3 ideas, 1 question per response
- Only suggest improvements that are meaningfully better, not just wordsmithed
- Ideas should be concrete and actionable, not generic
- Questions should only ask things that significantly affect the config
- If the section looks good, return all empty arrays`;
}
