import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Bot, FolderKanban } from "lucide-react";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  active: { label: "Active", variant: "default" },
  archived: { label: "Archived", variant: "secondary" },
};

export default async function TeamsPage() {
  const teams = await prisma.agentTeam.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
              <Users className="h-4 w-4 text-zinc-300" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">Teams</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Agents
            </Link>
            <Link href="/teams/new">
              <Button size="sm" className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
                <Plus className="h-4 w-4 mr-1.5" />
                New Team
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {teams.length > 0 && (
        <div className="border-b border-zinc-800/50">
          <div className="mx-auto flex max-w-6xl gap-8 px-6 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-zinc-400">{teams.length} teams</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Bot className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-zinc-400">
                {teams.reduce((sum, t) => sum + t._count.members, 0)} total members
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FolderKanban className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-zinc-400">
                {teams.reduce((sum, t) => sum + t._count.projects, 0)} projects
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800">
              <Users className="h-8 w-8 text-zinc-500" />
            </div>
            <p className="text-zinc-400 text-center max-w-md">
              Create your first team to enable multi-agent collaboration. Teams can work together on projects with shared memory and coordinated workflows.
            </p>
            <Link href="/teams/new">
              <Button className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
                <Plus className="h-4 w-4 mr-1.5" />
                New Team
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const status = statusConfig[team.status] || statusConfig.draft;

              return (
                <Link key={team.id} href={`/teams/${team.id}`}>
                  <Card className="group cursor-pointer bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                          <Users className="h-4 w-4 text-zinc-400" />
                          {team.name}
                        </CardTitle>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {team.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                          {team.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            {team._count.members}
                          </span>
                          <span className="flex items-center gap-1">
                            <FolderKanban className="h-3 w-3" />
                            {team._count.projects}
                          </span>
                        </div>
                        <span>
                          {new Date(team.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            {/* Quick-create card */}
            <Link href="/teams/new">
              <Card className="cursor-pointer border-dashed border-zinc-800 hover:border-zinc-600 bg-transparent transition-all h-full flex items-center justify-center min-h-[140px]">
                <CardContent className="flex flex-col items-center gap-2 py-6">
                  <Plus className="h-6 w-6 text-zinc-600" />
                  <span className="text-sm text-zinc-500">New Team</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
