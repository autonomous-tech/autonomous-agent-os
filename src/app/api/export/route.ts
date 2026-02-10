import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAgent, generateZip } from "@/lib/export";
import type { AgentConfig, StageData } from "@/lib/types";

// POST /api/export -- validate + generate ZIP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: projectId" },
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

    // Run validation
    const validation = validateAgent(config, stages);

    // If structural errors exist, return 400 with validation results
    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Generate ZIP
    const zipBuffer = await generateZip(agent);

    // Mark as exported
    await prisma.agentProject.update({
      where: { id: projectId },
      data: {
        status: "exported",
        exportedAt: new Date(),
      },
    });

    // Return the ZIP as a binary download
    const uint8 = new Uint8Array(zipBuffer);
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${agent.slug.replace(/[^a-z0-9_-]/gi, "")}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Export error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to export agent" },
      { status: 500 }
    );
  }
}
