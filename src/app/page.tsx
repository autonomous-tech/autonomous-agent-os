import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/builder/AgentCard";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const agents = await prisma.agentProject.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <h1 className="text-lg font-bold tracking-tight">Agent OS</h1>
          <Link href="/agents/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Agent
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <p className="text-muted-foreground text-center">
              No agents yet. Create your first one to get started.
            </p>
            <Link href="/agents/new">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                New Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                id={agent.id}
                name={agent.name}
                description={agent.description}
                status={agent.status}
                createdAt={agent.createdAt.toISOString()}
                slug={agent.slug}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
