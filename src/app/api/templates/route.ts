import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/templates -- list all available templates
export async function GET() {
  try {
    const templates = await prisma.agentTemplate.findMany();

    // If no templates exist in DB, return hardcoded defaults
    if (templates.length === 0) {
      return NextResponse.json({
        templates: [
          {
            id: "tpl_support",
            name: "Customer Support Agent",
            description: "Answers FAQs, logs issues, escalates to humans",
            category: "customer_support",
          },
          {
            id: "tpl_research",
            name: "Research Assistant",
            description: "Monitors topics, summarizes findings, maintains knowledge",
            category: "research",
          },
          {
            id: "tpl_sales",
            name: "Sales Support Agent",
            description: "Drafts outreach, researches prospects, prepares for calls",
            category: "sales",
          },
        ],
      });
    }

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
      })),
    });
  } catch (error) {
    console.error("Failed to list templates:", error);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 }
    );
  }
}
