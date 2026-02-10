import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STAGES, type StageName, type StageData, type AgentConfig } from "@/lib/types";

// PUT /api/agents/[id]/stages/[stage] -- direct edit of a single stage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  try {
    const { id, stage } = await params;

    // Validate stage name
    if (!STAGES.includes(stage as StageName)) {
      return NextResponse.json(
        { error: `Invalid stage: ${stage}. Valid stages: ${STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const stageName = stage as StageName;
    const body = await request.json();
    const { status, data, configUpdate } = body;

    const agent = await prisma.agentProject.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Update stage data
    const stages: StageData = JSON.parse(agent.stages);
    if (status) {
      stages[stageName] = {
        ...stages[stageName],
        status,
      };
    }
    if (data !== undefined) {
      stages[stageName] = {
        ...stages[stageName],
        data: { ...stages[stageName].data, ...data },
      };
    }

    // Update config if configUpdate is provided
    let config: AgentConfig = JSON.parse(agent.config);
    if (configUpdate) {
      config = {
        ...config,
        [stageName]: {
          ...(config[stageName as keyof AgentConfig] as Record<string, unknown> || {}),
          ...configUpdate,
        },
      };
    }

    const updated = await prisma.agentProject.update({
      where: { id },
      data: {
        stages: JSON.stringify(stages),
        config: JSON.stringify(config),
      },
    });

    return NextResponse.json({
      stage: stageName,
      status: stages[stageName].status,
      data: stages[stageName].data,
      config: JSON.parse(updated.config),
    });
  } catch (error) {
    console.error("Failed to update stage:", error);
    return NextResponse.json(
      { error: "Failed to update stage" },
      { status: 500 }
    );
  }
}
