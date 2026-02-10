import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inferFromDescription } from "@/lib/claude";
import { defaultStageData, defaultConversations } from "@/lib/types";
import { generateSlug } from "@/lib/slug";
import type { AgentConfig, StageData } from "@/lib/types";

// GET /api/agents -- list all agent projects
export async function GET() {
  try {
    const agents = await prisma.agentProject.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      agents.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        exportedAt: a.exportedAt,
      }))
    );
  } catch (error) {
    console.error("Failed to list agents:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to list agents" },
      { status: 500 }
    );
  }
}

// POST /api/agents -- create a new agent project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initialDescription, templateId } = body;

    let name = "New Agent";
    let config: AgentConfig = {};
    let stages: StageData = defaultStageData();

    // If templateId is provided, copy from template
    if (templateId) {
      const template = await prisma.agentTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      name = template.name;
      config = JSON.parse(template.config);
      stages = JSON.parse(template.stages);
    }
    // If description is provided, infer config from Claude
    else if (initialDescription) {
      try {
        const inferred = await inferFromDescription(initialDescription);
        name = inferred.name || "New Agent";
        config = inferred.config as AgentConfig;

        // Set mission stage to draft since we have inferred data
        if (config.mission) {
          stages.mission = { status: "draft", data: {} };
        }
        if (config.identity) {
          stages.identity = { status: "draft", data: {} };
        }
      } catch (inferError) {
        console.error("Failed to infer from description:", inferError);
        // Continue with basic defaults
        config = {
          mission: {
            description: initialDescription,
            tasks: [],
            exclusions: [],
          },
        };
        stages.mission = { status: "draft", data: {} };
      }
    }

    // Generate slug from name with timestamp suffix for uniqueness
    const slug = generateSlug(name) + "-" + Date.now().toString(36);

    const agent = await prisma.agentProject.create({
      data: {
        name,
        slug,
        description: initialDescription || config.mission?.description || "",
        status: templateId ? "building" : "draft",
        config: JSON.stringify(config),
        stages: JSON.stringify(stages),
        conversations: JSON.stringify(defaultConversations()),
        templateId: templateId || null,
      },
    });

    return NextResponse.json(
      {
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
        status: agent.status,
        config: JSON.parse(agent.config),
        stages: JSON.parse(agent.stages),
        createdAt: agent.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create agent:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
