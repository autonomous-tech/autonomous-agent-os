import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/claude";
import { buildEnrichmentPrompt } from "@/lib/prompts/enrich";
import type { AgentConfig, EnrichmentResponse } from "@/lib/types";

const VALID_SECTIONS = ["identity", "purpose", "audience", "workflow", "memory", "boundaries"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { section, sectionData, fullConfig } = body;

    if (!section || !sectionData) {
      return NextResponse.json(
        { error: "Missing section or sectionData" },
        { status: 400 }
      );
    }

    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json(
        { error: `Invalid section: ${section}` },
        { status: 400 }
      );
    }

    if (typeof sectionData !== "object" || Array.isArray(sectionData)) {
      return NextResponse.json(
        { error: "sectionData must be an object" },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.agentProject.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    let config: AgentConfig;
    if (fullConfig && typeof fullConfig === "object" && !Array.isArray(fullConfig)) {
      config = fullConfig as AgentConfig;
    } else {
      config = JSON.parse(agent.config);
    }

    const prompt = buildEnrichmentPrompt(section, sectionData, config);

    const response = await chat(
      "You are an AI agent configuration expert. Return only valid JSON.",
      [{ role: "user", content: prompt }],
      { maxTokens: 1024 }
    );

    // Parse response
    let enrichment: EnrichmentResponse;
    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();
      }
      enrichment = JSON.parse(jsonStr);
    } catch {
      console.warn("[enrich] Failed to parse Claude response as JSON. Raw (first 200 chars):", response.slice(0, 200));
      enrichment = { suggestions: [], ideas: [], questions: [] };
    }

    // Ensure arrays exist
    enrichment.suggestions = enrichment.suggestions || [];
    enrichment.ideas = enrichment.ideas || [];
    enrichment.questions = enrichment.questions || [];

    return NextResponse.json(enrichment);
  } catch (error) {
    console.error("Enrichment error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Enrichment failed" },
      { status: 500 }
    );
  }
}
